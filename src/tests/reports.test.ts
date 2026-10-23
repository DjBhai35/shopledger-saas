import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { resetDBConnection } from "@/lib/offline/db";
import { createProduct } from "@/lib/services/productService";
import { createCustomer, createSupplier } from "@/lib/services/customerSupplierService";
import { createSale } from "@/lib/services/salesPosService";
import { createExpense } from "@/lib/services/ledgerExpenseService";
import { generateBusinessReport } from "@/lib/services/reportsService";

describe("Business Intelligence & Financial Reports Service", () => {
  const wsId = "ws_reports_test";
  const authorUid = "analyst_1";

  beforeEach(() => {
    resetDBConnection();
  });

  it("should accurately compute Revenue, COGS, Gross Profit, Expenses, Net Operating Result, and Inventory Valuation", async () => {
    // 1. Setup products:
    // Product A: 10 units, cost $100, sell $150
    const prodA = await createProduct(
      {
        workspaceId: wsId,
        name: "Wireless Router AX3000",
        sku: "RTR-AX3000",
        category: "Networking",
        costPrice: 100,
        sellingPrice: 150,
        quantity: 10,
        minStockAlert: 2,
        unit: "pcs",
      },
      authorUid
    );

    // Product B: 20 units, cost $20, sell $35
    const prodB = await createProduct(
      {
        workspaceId: wsId,
        name: "Ethernet Cable Cat6 10m",
        sku: "CAB-CAT6-10",
        category: "Accessories",
        costPrice: 20,
        sellingPrice: 35,
        quantity: 20,
        minStockAlert: 5,
        unit: "pcs",
      },
      authorUid
    );

    // Product C: 1 unit, cost $50, min stock 3 (low stock test)
    await createProduct(
      {
        workspaceId: wsId,
        name: "USB-C Hub Multiport",
        sku: "HUB-USBC",
        category: "Accessories",
        costPrice: 50,
        sellingPrice: 75,
        quantity: 1,
        minStockAlert: 3,
        unit: "pcs",
      },
      authorUid
    );

    // 2. Setup Customer with receivables
    const customer = await createCustomer(
      {
        workspaceId: wsId,
        name: "Tech Solutions Co.",
        openingBalance: 200,
      },
      authorUid
    );

    // 3. Setup Supplier with payables
    await createSupplier(
      {
        workspaceId: wsId,
        name: "Global Hardware Wholesalers",
        openingBalance: 500,
      },
      authorUid
    );

    // 4. Record Sales:
    // Sale 1: 2 units of ProdA @ $150 = $300. Paid $200, $100 credit.
    // COGS for ProdA = 2 * $100 = $200.
    await createSale(
      {
        workspaceId: wsId,
        customerId: customer.id,
        customerName: customer.name,
        items: [{ productId: prodA.id, quantity: 2, unitPrice: 150 }],
        paidAmount: 200,
        paymentMethod: "credit",
        authorUid,
      }
    );

    // Sale 2: 4 units of ProdB @ $35 = $140 cash sale.
    // COGS for ProdB = 4 * $20 = $80.
    await createSale(
      {
        workspaceId: wsId,
        customerId: null,
        customerName: "Walk-in Customer",
        items: [{ productId: prodB.id, quantity: 4, unitPrice: 35 }],
        paidAmount: 140,
        paymentMethod: "cash",
        authorUid,
      }
    );

    // Total Revenue = 300 + 140 = $440
    // Total COGS = 200 + 80 = $280
    // Gross Profit = 440 - 280 = $160
    // Gross Profit Margin % = (160 / 440) * 100 = 36.36%

    // 5. Record Expenses:
    // Rent $50, Electricity $20 = Total $70
    await createExpense(
      {
        workspaceId: wsId,
        category: "rent",
        amount: 50,
        paymentMethod: "cash",
        description: "Space rental",
      },
      authorUid
    );

    await createExpense(
      {
        workspaceId: wsId,
        category: "utilities",
        amount: 20,
        paymentMethod: "cash",
        description: "Power bill",
      },
      authorUid
    );

    // Net Operating Result = Gross Profit ($160) - Expenses ($70) = $90

    // 6. Generate Business Report
    const report = await generateBusinessReport(wsId);

    // Verify Sales Metrics
    expect(report.salesMetrics.totalRevenue).toBe(440);
    expect(report.salesMetrics.cashCollected).toBe(340); // 200 + 140
    expect(report.salesMetrics.creditSales).toBe(100);
    expect(report.salesMetrics.invoiceCount).toBe(2);

    // Verify COGS & Profit
    expect(report.cogsAndProfit.cogs).toBe(280);
    expect(report.cogsAndProfit.grossProfit).toBe(160);
    expect(report.cogsAndProfit.grossProfitMarginPercent).toBeCloseTo(36.36, 1);
    expect(report.cogsAndProfit.totalExpenses).toBe(70);
    expect(report.cogsAndProfit.netOperatingResult).toBe(90);

    // Verify Balance Sheet Metrics:
    // Remaining stock:
    // ProdA: 10 - 2 = 8 units @ $100 = $800
    // ProdB: 20 - 4 = 16 units @ $20 = $320
    // ProdC: 1 unit @ $50 = $50
    // Total stock units = 8 + 16 + 1 = 25
    // Inventory valuation = 800 + 320 + 50 = $1170
    expect(report.balanceSheetMetrics.totalStockUnits).toBe(25);
    expect(report.balanceSheetMetrics.inventoryValuationCost).toBe(1170);
    expect(report.balanceSheetMetrics.totalProductsCount).toBe(3);
    expect(report.balanceSheetMetrics.lowStockCount).toBe(1); // ProdC has qty 1 <= alert 3

    // Receivables = opening 200 + credit sale 100 = 300
    expect(report.balanceSheetMetrics.accountsReceivable).toBe(300);
    // Payables = opening 500
    expect(report.balanceSheetMetrics.accountsPayable).toBe(500);

    // Verify Top Selling Products
    expect(report.topSellingProducts.length).toBe(2);
    expect(report.topSellingProducts[0].productId).toBe(prodB.id); // 4 units sold
    expect(report.topSellingProducts[0].quantitySold).toBe(4);
    expect(report.topSellingProducts[1].productId).toBe(prodA.id); // 2 units sold
    expect(report.topSellingProducts[1].quantitySold).toBe(2);
  });
});
