import { getLocalDB } from "@/lib/offline/db";
import { Product, Sale, Expense, Customer, Supplier } from "@/types";

export interface DateRangeFilter {
  startDate?: number;
  endDate?: number;
}

export interface BusinessReportSummary {
  dateRange: {
    startDate?: number;
    endDate?: number;
  };
  salesMetrics: {
    totalRevenue: number;
    cashCollected: number;
    creditSales: number;
    invoiceCount: number;
    totalDiscountGiven: number;
    totalTaxCollected: number;
  };
  cogsAndProfit: {
    cogs: number; // Cost of Goods Sold based on recorded purchase unit cost
    grossProfit: number; // totalRevenue - cogs
    grossProfitMarginPercent: number;
    totalExpenses: number;
    netOperatingResult: number; // grossProfit - totalExpenses
  };
  balanceSheetMetrics: {
    inventoryValuationCost: number; // sum of product.quantity * product.costPrice
    totalStockUnits: number;
    totalProductsCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    accountsReceivable: number; // customers owed balance
    accountsPayable: number; // suppliers payable balance
  };
  topSellingProducts: {
    productId: string;
    productName: string;
    sku: string;
    quantitySold: number;
    revenue: number;
    profit: number;
  }[];
}

export async function generateBusinessReport(
  workspaceId: string,
  filter: DateRangeFilter = {}
): Promise<BusinessReportSummary> {
  const db = await getLocalDB();

  // 1. Fetch sales
  const allSales = await db.getAllFromIndex("sales", "by_workspace", workspaceId);
  const sales = allSales.filter((s) => {
    if (s.status === "cancelled") return false;
    if (filter.startDate && s.createdAt < filter.startDate) return false;
    if (filter.endDate && s.createdAt > filter.endDate) return false;
    return true;
  });

  // 2. Fetch expenses
  const allExpenses = await db.getAllFromIndex("expenses", "by_workspace", workspaceId);
  const expenses = allExpenses.filter((e) => {
    if (filter.startDate && e.date < filter.startDate) return false;
    if (filter.endDate && e.date > filter.endDate) return false;
    return true;
  });

  // 3. Fetch products
  const allProducts = await db.getAllFromIndex("products", "by_workspace", workspaceId);
  const activeProducts = allProducts.filter((p) => !p.isArchived);

  // 4. Fetch customers & suppliers
  const allCustomers = await db.getAllFromIndex("customers", "by_workspace", workspaceId);
  const allSuppliers = await db.getAllFromIndex("suppliers", "by_workspace", workspaceId);

  // Calculate Sales & COGS
  let totalRevenue = 0;
  let cashCollected = 0;
  let creditSales = 0;
  let totalDiscountGiven = 0;
  let totalTaxCollected = 0;
  let cogs = 0;

  const productSalesMap = new Map<
    string,
    { productName: string; sku: string; quantity: number; revenue: number; cost: number }
  >();

  for (const sale of sales) {
    totalRevenue += sale.totalAmount;
    cashCollected += sale.paidAmount;
    creditSales += sale.balanceDue;
    totalDiscountGiven += sale.discountTotal;
    totalTaxCollected += sale.taxTotal;

    for (const item of sale.items) {
      const lineCost = item.quantity * item.unitCost;
      cogs += lineCost;

      const existing = productSalesMap.get(item.productId) || {
        productName: item.productName,
        sku: item.sku,
        quantity: 0,
        revenue: 0,
        cost: 0,
      };

      existing.quantity += item.quantity;
      existing.revenue += item.total;
      existing.cost += lineCost;
      productSalesMap.set(item.productId, existing);
    }
  }

  // Calculate Expenses
  let totalExpenses = 0;
  for (const exp of expenses) {
    totalExpenses += exp.amount;
  }

  // Profit calculations
  const grossProfit = totalRevenue - cogs;
  const grossProfitMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netOperatingResult = grossProfit - totalExpenses;

  // Inventory valuation
  let inventoryValuationCost = 0;
  let totalStockUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const prod of activeProducts) {
    const qty = prod.quantity;
    totalStockUnits += Math.max(0, qty);
    inventoryValuationCost += Math.max(0, qty) * prod.costPrice;

    if (qty <= 0) {
      outOfStockCount++;
    } else if (qty <= prod.minStockAlert) {
      lowStockCount++;
    }
  }

  // Receivables & Payables
  let accountsReceivable = 0;
  for (const cust of allCustomers) {
    if (!cust.isArchived && cust.currentBalance > 0) {
      accountsReceivable += cust.currentBalance;
    }
  }

  let accountsPayable = 0;
  for (const supp of allSuppliers) {
    if (!supp.isArchived && supp.currentPayableBalance > 0) {
      accountsPayable += supp.currentPayableBalance;
    }
  }

  // Top products ranking
  const topSellingProducts = Array.from(productSalesMap.entries())
    .map(([productId, info]) => ({
      productId,
      productName: info.productName,
      sku: info.sku,
      quantitySold: info.quantity,
      revenue: info.revenue,
      profit: info.revenue - info.cost,
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 10);

  return {
    dateRange: filter,
    salesMetrics: {
      totalRevenue,
      cashCollected,
      creditSales,
      invoiceCount: sales.length,
      totalDiscountGiven,
      totalTaxCollected,
    },
    cogsAndProfit: {
      cogs,
      grossProfit,
      grossProfitMarginPercent,
      totalExpenses,
      netOperatingResult,
    },
    balanceSheetMetrics: {
      inventoryValuationCost,
      totalStockUnits,
      totalProductsCount: activeProducts.length,
      lowStockCount,
      outOfStockCount,
      accountsReceivable,
      accountsPayable,
    },
    topSellingProducts,
  };
}
