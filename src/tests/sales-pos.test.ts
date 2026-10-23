import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { resetDBConnection } from "@/lib/offline/db";
import { createProduct } from "@/lib/services/productService";
import { createCustomer } from "@/lib/services/customerSupplierService";
import {
  createSale,
  processSaleReturn,
  getSales,
  getSaleById,
  generateThermalReceiptContent,
} from "@/lib/services/salesPosService";
import { Workspace } from "@/types";

describe("Sales & POS Counter Module", () => {
  const wsId = "ws_pos_test";
  const authorUid = "cashier_user_1";

  const mockWorkspace: Workspace = {
    id: wsId,
    name: "Al-Rehman Mobile & Electronics",
    slug: "al-rehman-mobile",
    ownerUid: "owner_1",
    businessCategory: "mobile_phones",
    currency: "USD",
    currencySymbol: "$",
    address: "Shop 14, Hafeez Centre, Lahore",
    phone: "+92 300 1234567",
    settings: {
      allowNegativeInventory: false,
      invoicePrefix: "INV-",
      receiptFooterMessage: "Warranty claim valid for 7 days with invoice.",
      vatOrTaxPercentage: 5,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    resetDBConnection();
  });

  it("should complete a full-payment sale, decrement product stock atomically, and generate thermal receipt", async () => {
    // 1. Create a product with 10 units in stock
    const product = await createProduct(
      {
        workspaceId: wsId,
        name: "Samsung Galaxy A54",
        sku: "SAM-A54-128",
        barcode: "880609123456",
        category: "Mobile Phones",
        costPrice: 280,
        sellingPrice: 350,
        quantity: 10,
        minStockAlert: 2,
        unit: "pcs",
      },
      authorUid
    );

    // 2. Checkout sale for 2 units
    const sale = await createSale(
      {
        workspaceId: wsId,
        customerId: null, // Walk-in
        customerName: "Walk-in Customer",
        items: [
          {
            productId: product.id,
            quantity: 2,
            unitPrice: 350,
            discount: 10, // $10 off per unit => unit net 340, total line 680
          },
        ],
        discountTotal: 0,
        taxPercent: 5, // 5% tax on 680 = 34 => total 714
        paidAmount: 714,
        paymentMethod: "cash",
        authorUid,
      },
      mockWorkspace
    );

    expect(sale.id).toBeDefined();
    expect(sale.invoiceNumber).toMatch(/^INV-/);
    expect(sale.subtotal).toBe(680);
    expect(sale.taxTotal).toBe(34);
    expect(sale.totalAmount).toBe(714);
    expect(sale.paidAmount).toBe(714);
    expect(sale.balanceDue).toBe(0);

    // 3. Verify product stock is decremented
    const { getProducts } = await import("@/lib/services/productService");
    const products = await getProducts(wsId);
    const updatedProd = products.find((p) => p.id === product.id);
    expect(updatedProd?.quantity).toBe(8);

    // 4. Test 58mm and 80mm thermal receipt generation
    const receipt80 = generateThermalReceiptContent(sale, mockWorkspace, "80mm");
    expect(receipt80.text).toContain("AL-REHMAN MOBILE");
    expect(receipt80.text).toContain(sale.invoiceNumber);
    expect(receipt80.text).toContain("Samsung Galaxy");
    expect(receipt80.text).toContain("TOTAL:         $714.00");
    expect(receipt80.html).toContain("width: 80mm");

    const receipt58 = generateThermalReceiptContent(sale, mockWorkspace, "58mm");
    expect(receipt58.html).toContain("width: 58mm");
    expect(receipt58.text).toContain("Samsung Galaxy");
  });

  it("should prevent overselling when allowNegativeInventory is false", async () => {
    const product = await createProduct(
      {
        workspaceId: wsId,
        name: "Limited Edition Earbuds",
        sku: "EAR-LTD-1",
        category: "Accessories",
        costPrice: 40,
        sellingPrice: 80,
        quantity: 1,
        minStockAlert: 1,
        unit: "pcs",
      },
      authorUid
    );

    await expect(
      createSale(
        {
          workspaceId: wsId,
          customerId: null,
          items: [{ productId: product.id, quantity: 2, unitPrice: 80 }],
          paidAmount: 160,
          paymentMethod: "cash",
          authorUid,
        },
        mockWorkspace
      )
    ).rejects.toThrow(/Insufficient stock/);
  });

  it("should record partial payment credit sale (Udhar), update customer balance, and log customer ledger entry", async () => {
    // 1. Create registered customer with 0 balance
    const customer = await createCustomer(
      {
        workspaceId: wsId,
        name: "Chaudhry Nadeem",
        phone: "+92 321 9876543",
        openingBalance: 0,
      },
      authorUid
    );

    const product = await createProduct(
      {
        workspaceId: wsId,
        name: "iPhone Screen Guard",
        sku: "SCR-IP15",
        category: "Accessories",
        costPrice: 2,
        sellingPrice: 10,
        quantity: 50,
        minStockAlert: 5,
        unit: "pcs",
      },
      authorUid
    );

    // 2. Buy 5 screen guards @ $10 = $50. Customer pays $20 cash, remaining $30 credit/udhar
    const sale = await createSale(
      {
        workspaceId: wsId,
        customerId: customer.id,
        customerName: customer.name,
        items: [{ productId: product.id, quantity: 5, unitPrice: 10 }],
        paidAmount: 20,
        paymentMethod: "credit",
        authorUid,
      },
      mockWorkspace
    );

    expect(sale.totalAmount).toBe(50);
    expect(sale.paidAmount).toBe(20);
    expect(sale.balanceDue).toBe(30);

    // 3. Customer balance should now be $30
    const { getCustomerById } = await import("@/lib/services/customerSupplierService");
    const updatedCust = await getCustomerById(wsId, customer.id);
    expect(updatedCust?.currentBalance).toBe(30);

    // 4. Verify Customer Ledger contains credit_sale entry
    const { getCustomerLedger } = await import("@/lib/services/ledgerExpenseService");
    const ledger = await getCustomerLedger(wsId, customer.id);
    expect(ledger.length).toBe(1);
    expect(ledger[0].type).toBe("credit_sale");
    expect(ledger[0].debit).toBe(30);
    expect(ledger[0].runningBalance).toBe(30);
  });

  it("should reject credit sale if customer is walk-in / anonymous", async () => {
    const product = await createProduct(
      {
        workspaceId: wsId,
        name: "Power Bank 20000mAh",
        sku: "PB-20K",
        category: "Accessories",
        costPrice: 15,
        sellingPrice: 30,
        quantity: 10,
        minStockAlert: 2,
        unit: "pcs",
      },
      authorUid
    );

    await expect(
      createSale(
        {
          workspaceId: wsId,
          customerId: null, // Anonymous walk-in
          items: [{ productId: product.id, quantity: 1, unitPrice: 30 }],
          paidAmount: 10, // Unpaid 20
          paymentMethod: "credit",
          authorUid,
        },
        mockWorkspace
      )
    ).rejects.toThrow(/Credit sales \(Udhar\) require selecting a registered customer/);
  });

  it("should process sale returns, restore product stock, and adjust customer balance", async () => {
    const customer = await createCustomer(
      {
        workspaceId: wsId,
        name: "Malik Usman",
        openingBalance: 0,
      },
      authorUid
    );

    const product = await createProduct(
      {
        workspaceId: wsId,
        name: "Bluetooth Speaker",
        sku: "SPK-BT-01",
        category: "Electronics",
        costPrice: 20,
        sellingPrice: 40,
        quantity: 15,
        minStockAlert: 2,
        unit: "pcs",
      },
      authorUid
    );

    // Create credit sale of 3 units ($120 total, $0 paid, balance $120)
    const sale = await createSale(
      {
        workspaceId: wsId,
        customerId: customer.id,
        customerName: customer.name,
        items: [{ productId: product.id, quantity: 3, unitPrice: 40 }],
        paidAmount: 0,
        paymentMethod: "credit",
        authorUid,
      },
      mockWorkspace
    );

    // Stock should now be 12 (15 - 3)
    let prod = (await import("@/lib/services/productService")).getProductByBarcodeOrSku(wsId, "SPK-BT-01");
    expect((await prod)?.quantity).toBe(12);

    // Process return of 1 speaker
    const saleReturn = await processSaleReturn({
      workspaceId: wsId,
      saleId: sale.id,
      items: [{ productId: product.id, quantity: 1 }],
      reason: "Customer changed mind",
      authorUid,
    });

    expect(saleReturn.refundAmount).toBe(40);

    // Stock must be restored from 12 back to 13
    prod = (await import("@/lib/services/productService")).getProductByBarcodeOrSku(wsId, "SPK-BT-01");
    expect((await prod)?.quantity).toBe(13);

    // Customer balance must be reduced from 120 down to 80
    const { getCustomerById } = await import("@/lib/services/customerSupplierService");
    const cust = await getCustomerById(wsId, customer.id);
    expect(cust?.currentBalance).toBe(80);

    // Verify invoice return history
    const updatedSale = await getSaleById(wsId, sale.id);
    expect(updatedSale?.items[0].returnedQuantity).toBe(1);
  });
});
