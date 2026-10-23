import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { resetDBConnection } from "@/lib/offline/db";
import { createProduct, getProductByBarcodeOrSku } from "@/lib/services/productService";
import { createSupplier, getSupplierById } from "@/lib/services/customerSupplierService";
import {
  createPurchase,
  processPurchaseReturn,
  getPurchases,
  getPurchaseById,
} from "@/lib/services/purchaseService";
import { getSupplierLedger } from "@/lib/services/ledgerExpenseService";

describe("Purchases & Inward Stock Management", () => {
  const wsId = "ws_purchase_test";
  const authorUid = "inventory_manager_1";

  beforeEach(() => {
    resetDBConnection();
  });

  it("should receive purchase goods, increment stock, update unit cost, and manage supplier credit payable", async () => {
    // 1. Create supplier
    const supplier = await createSupplier(
      {
        workspaceId: wsId,
        name: "Shenzhen Wholesale Electronics Ltd",
        contactPerson: "Mr. Zhang",
        phone: "+86 755 12345678",
        openingBalance: 0,
      },
      authorUid
    );

    // 2. Create product with initial 10 units @ $5 cost
    const product = await createProduct(
      {
        workspaceId: wsId,
        name: "Fast Charging Cable 65W",
        sku: "FCC-65W",
        category: "Accessories",
        costPrice: 5,
        sellingPrice: 12,
        quantity: 10,
        minStockAlert: 5,
        unit: "pcs",
      },
      authorUid
    );

    // 3. Receive purchase order of 100 units at new cost of $4.50. Paid $150, remaining $300 on credit
    const purchase = await createPurchase({
      workspaceId: wsId,
      supplierId: supplier.id,
      items: [
        {
          productId: product.id,
          quantity: 100,
          unitCost: 4.5,
        },
      ],
      discountTotal: 0,
      taxPercent: 0,
      paidAmount: 150,
      paymentMethod: "bank_transfer",
      notes: "Batch #B2026-03 imported via air freight",
      authorUid,
    });

    expect(purchase.id).toBeDefined();
    expect(purchase.purchaseNumber).toMatch(/^PO-/);
    expect(purchase.totalAmount).toBe(450);
    expect(purchase.paidAmount).toBe(150);
    expect(purchase.balanceDue).toBe(300);

    // 4. Verify product stock increased from 10 to 110, and costPrice updated to 4.5
    const updatedProd = await getProductByBarcodeOrSku(wsId, "FCC-65W");
    expect(updatedProd?.quantity).toBe(110);
    expect(updatedProd?.costPrice).toBe(4.5);

    // 5. Verify supplier payable balance increased to 300
    const updatedSupp = await getSupplierById(wsId, supplier.id);
    expect(updatedSupp?.currentPayableBalance).toBe(300);

    // 6. Verify Supplier Ledger entry
    const ledger = await getSupplierLedger(wsId, supplier.id);
    expect(ledger.length).toBe(1);
    expect(ledger[0].type).toBe("purchase_credit");
    expect(ledger[0].credit).toBe(300);
    expect(ledger[0].runningBalance).toBe(300);
  });

  it("should process purchase return to vendor, reduce stock, and credit vendor payable balance", async () => {
    const supplier = await createSupplier(
      {
        workspaceId: wsId,
        name: "Metro General Goods",
        openingBalance: 0,
      },
      authorUid
    );

    const product = await createProduct(
      {
        workspaceId: wsId,
        name: "Wireless Earphone Case",
        sku: "CASE-WE-01",
        category: "Accessories",
        costPrice: 8,
        sellingPrice: 15,
        quantity: 50,
        minStockAlert: 5,
        unit: "pcs",
      },
      authorUid
    );

    // Inward purchase: 20 units @ $8 = $160 on credit ($0 paid)
    const purchase = await createPurchase({
      workspaceId: wsId,
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 20, unitCost: 8 }],
      paidAmount: 0,
      paymentMethod: "credit",
      authorUid,
    });

    // Stock should now be 70 (50 + 20)
    let prod = await getProductByBarcodeOrSku(wsId, "CASE-WE-01");
    expect(prod?.quantity).toBe(70);

    // Return 5 defective units back to supplier
    const pReturn = await processPurchaseReturn({
      workspaceId: wsId,
      purchaseId: purchase.id,
      items: [{ productId: product.id, quantity: 5 }],
      reason: "Defective hinges in lot",
      authorUid,
    });

    expect(pReturn.refundAmount).toBe(40); // 5 * $8

    // Stock must be reduced from 70 to 65
    prod = await getProductByBarcodeOrSku(wsId, "CASE-WE-01");
    expect(prod?.quantity).toBe(65);

    // Supplier balance should be reduced from 160 to 120
    const supp = await getSupplierById(wsId, supplier.id);
    expect(supp?.currentPayableBalance).toBe(120);

    // Verify supplier ledger reflects return / debit note
    const ledger = await getSupplierLedger(wsId, supplier.id);
    expect(ledger.length).toBe(2);
    const returnEntry = ledger.find((e) => e.type === "purchase_return");
    expect(returnEntry).toBeDefined();
    expect(returnEntry?.debit).toBe(40);
    expect(returnEntry?.runningBalance).toBe(120);
  });

  it("should prevent returning more items than were originally purchased", async () => {
    const supplier = await createSupplier({ workspaceId: wsId, name: "Alpha Traders" }, authorUid);
    const product = await createProduct(
      {
        workspaceId: wsId,
        name: "Test Item",
        sku: "TEST-01",
        category: "General",
        costPrice: 10,
        sellingPrice: 20,
        quantity: 10,
        minStockAlert: 1,
        unit: "pcs",
      },
      authorUid
    );

    const purchase = await createPurchase({
      workspaceId: wsId,
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 5, unitCost: 10 }],
      paidAmount: 50,
      paymentMethod: "cash",
      authorUid,
    });

    await expect(
      processPurchaseReturn({
        workspaceId: wsId,
        purchaseId: purchase.id,
        items: [{ productId: product.id, quantity: 10 }], // only 5 purchased
        reason: "Excess return test",
        authorUid,
      })
    ).rejects.toThrow(/Invalid return quantity/);
  });
});
