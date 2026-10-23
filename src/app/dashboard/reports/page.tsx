"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { BusinessReportSummary, generateBusinessReport } from "@/lib/services/reportsService";
import {
  BarChart3,
  Calendar,
  TrendingUp,
  DollarSign,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Boxes,
  Users,
  Truck,
  Sparkles,
  PieChart,
} from "lucide-react";

export default function ReportsPage() {
  const { workspace } = useAuth();
  const [report, setReport] = useState<BusinessReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Time preset filter
  const [preset, setPreset] = useState<"today" | "week" | "month" | "all">("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const cur = workspace?.currencySymbol || "$";

  const loadReport = async () => {
    if (!workspace) return;
    setLoading(true);

    try {
      let start: number | undefined;
      let end: number | undefined;
      const now = new Date();

      if (preset === "today") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      } else if (preset === "week") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        start = d.getTime();
      } else if (preset === "month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      } else if (startDate && endDate) {
        start = new Date(startDate).getTime();
        end = new Date(endDate).getTime() + 86400000;
      }

      const data = await generateBusinessReport(workspace.id, { startDate: start, endDate: end });
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [workspace, preset, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Header & Date Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Business Intelligence &amp; P&amp;L Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real financial statements computed directly from your recorded sales, COGS, inward purchases, and expenses.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 text-xs shadow-2xs">
          {(["today", "week", "month", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPreset(p);
                setStartDate("");
                setEndDate("");
              }}
              className={`px-3 py-1.5 rounded-lg capitalize font-bold transition-all ${
                preset === p
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {p === "all" ? "All Time" : `This ${p}`}
            </button>
          ))}
        </div>
      </div>

      {loading || !report ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Computing financial models and cost of goods sold...</span>
        </div>
      ) : (
        <>
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">Gross Sales Revenue</span>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {cur}
                {report.salesMetrics.totalRevenue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {report.salesMetrics.invoiceCount} invoices issued
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">
                Gross Profit (Revenue - COGS)
              </span>
              <div
                className={`text-2xl font-bold mt-1 font-mono ${
                  report.cogsAndProfit.grossProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {cur}
                {report.cogsAndProfit.grossProfit.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Margin: {report.cogsAndProfit.grossProfitMarginPercent.toFixed(1)}%
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">Operating Expenses</span>
              <div className="text-2xl font-bold text-rose-600 mt-1 font-mono">
                {cur}
                {report.cogsAndProfit.totalExpenses.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Overhead &amp; shop expenses</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">Net Operating Result</span>
              <div
                className={`text-2xl font-bold mt-1 font-mono ${
                  report.cogsAndProfit.netOperatingResult >= 0
                    ? "text-indigo-600 font-extrabold"
                    : "text-rose-600"
                }`}
              >
                {cur}
                {report.cogsAndProfit.netOperatingResult.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">After all recorded expenses</div>
            </div>
          </div>

          {/* Income Statement & Balance Sheet Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Profit & Loss Statement Card */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <span>Profit &amp; Loss Breakdown</span>
              </h2>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Total Billed Sales Revenue:</span>
                  <span className="font-bold text-slate-900">
                    +{cur}
                    {report.salesMetrics.totalRevenue.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-500 pl-4">
                  <span>• Cash Received Immediately:</span>
                  <span>
                    {cur}
                    {report.salesMetrics.cashCollected.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-500 pl-4">
                  <span>• Credit Extended (Udhar):</span>
                  <span>
                    {cur}
                    {report.salesMetrics.creditSales.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100 text-rose-600">
                  <span>Cost of Goods Sold (COGS - Purchase Cost Basis):</span>
                  <span className="font-bold">
                    -{cur}
                    {report.cogsAndProfit.cogs.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between py-2 bg-slate-50 px-3 rounded-lg font-bold text-slate-900">
                  <span>GROSS PROFIT:</span>
                  <span
                    className={
                      report.cogsAndProfit.grossProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                    }
                  >
                    {cur}
                    {report.cogsAndProfit.grossProfit.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-100 text-rose-600">
                  <span>Total Shop Overhead &amp; Expenses:</span>
                  <span className="font-bold">
                    -{cur}
                    {report.cogsAndProfit.totalExpenses.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between py-3 bg-indigo-50/70 border border-indigo-200 px-3 rounded-xl font-bold text-sm text-indigo-950">
                  <span>NET OPERATING RESULT:</span>
                  <span
                    className={
                      report.cogsAndProfit.netOperatingResult >= 0
                        ? "text-indigo-700"
                        : "text-rose-700"
                    }
                  >
                    {cur}
                    {report.cogsAndProfit.netOperatingResult.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Balance Sheet Asset & Liability Card */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-600" />
                <span>Working Capital &amp; Valuation</span>
              </h2>

              <div className="space-y-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Total Inventory Valuation (Cost Basis)
                  </span>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                    {cur}
                    {report.balanceSheetMetrics.inventoryValuationCost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {report.balanceSheetMetrics.totalStockUnits.toLocaleString()} units in{" "}
                    {report.balanceSheetMetrics.totalProductsCount} items
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Accounts Receivable (Customer Udhar Owed to Shop)
                  </span>
                  <div className="text-lg font-bold text-rose-600 font-mono mt-0.5">
                    {cur}
                    {report.balanceSheetMetrics.accountsReceivable.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Accounts Payable (Bills Owed to Wholesale Suppliers)
                  </span>
                  <div className="text-lg font-bold text-amber-600 font-mono mt-0.5">
                    {cur}
                    {report.balanceSheetMetrics.accountsPayable.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Selling Products Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Top 10 Fast-Moving Products</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Product Name</th>
                    <th className="px-3 py-2.5">SKU</th>
                    <th className="px-3 py-2.5 text-center">Units Sold</th>
                    <th className="px-3 py-2.5 text-right">Revenue</th>
                    <th className="px-3 py-2.5 text-right">Profit Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.topSellingProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-400">
                        No sales recorded during this date period.
                      </td>
                    </tr>
                  ) : (
                    report.topSellingProducts.map((p) => (
                      <tr key={p.productId} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-slate-800">{p.productName}</td>
                        <td className="px-3 py-2 font-mono text-slate-400 text-[11px]">{p.sku}</td>
                        <td className="px-3 py-2 text-center font-bold font-mono">
                          {p.quantitySold}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-slate-800">
                          {cur}
                          {p.revenue.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">
                          +{cur}
                          {p.profit.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
