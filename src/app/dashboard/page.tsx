"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { OfflineDemoAudit } from "@/components/OfflineDemoAudit";
import { getProducts } from "@/lib/services/productService";
import { getSales } from "@/lib/services/salesPosService";
import { getCustomers, getSuppliers } from "@/lib/services/customerSupplierService";
import Link from "next/link";
import {
  Building2,
  Package,
  ShoppingCart,
  Users,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  Boxes,
  Receipt,
  Truck,
  DollarSign,
  Plus,
  BookOpen,
  ArrowRight,
} from "lucide-react";

export default function DashboardOverviewPage() {
  const { workspace, subscription, memberships } = useAuth();

  const [metrics, setMetrics] = useState({
    productsCount: 0,
    totalStockValuation: 0,
    totalSalesCount: 0,
    todaySalesRevenue: 0,
    totalReceivables: 0,
    totalPayables: 0,
    lowStockCount: 0,
  });

  const cur = workspace?.currencySymbol || "$";

  useEffect(() => {
    if (!workspace) return;
    const loadLiveMetrics = async () => {
      try {
        const [allProds, allSales, allCusts, allSupps] = await Promise.all([
          getProducts(workspace.id),
          getSales(workspace.id),
          getCustomers(workspace.id),
          getSuppliers(workspace.id),
        ]);

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const todaySales = allSales.filter((s) => s.createdAt >= startOfToday.getTime());
        const todayRevenue = todaySales.reduce((acc, s) => acc + s.totalAmount, 0);
        const valuation = allProds.reduce(
          (acc, p) => acc + Math.max(0, p.quantity) * p.costPrice,
          0
        );
        const receivables = allCusts.reduce(
          (acc, c) => acc + (c.currentBalance > 0 ? c.currentBalance : 0),
          0
        );
        const payables = allSupps.reduce(
          (acc, s) => acc + (s.currentPayableBalance > 0 ? s.currentPayableBalance : 0),
          0
        );
        const lowStock = allProds.filter(
          (p) => p.quantity > 0 && p.quantity <= p.minStockAlert
        ).length;

        setMetrics({
          productsCount: allProds.length,
          totalStockValuation: valuation,
          totalSalesCount: allSales.length,
          todaySalesRevenue: todayRevenue,
          totalReceivables: receivables,
          totalPayables: payables,
          lowStockCount: lowStock,
        });
      } catch (err) {
        console.error("Error loading dashboard metrics:", err);
      }
    };

    loadLiveMetrics();
  }, [workspace]);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Workspace Summary Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 rounded-2xl p-6 lg:p-8 text-white shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-medium text-indigo-200 mb-3 border border-white/10">
                <Building2 className="w-3.5 h-3.5" />
                <span>Tenant ID: {workspace?.id}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {workspace?.name}
              </h1>
              <p className="text-xs sm:text-sm text-indigo-200 mt-1">
                Category: <strong>{workspace?.categoryLabel}</strong> • Base Currency:{" "}
                <strong>
                  {workspace?.currency} ({cur})
                </strong>
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/dashboard/sales"
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Open POS Counter</span>
              </Link>
              <Link
                href="/dashboard/products"
                className="bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all backdrop-blur-md flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </Link>
              <Link
                href="/dashboard/purchases"
                className="bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all backdrop-blur-md flex items-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Inward Stock</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Live Financial & Inventory Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Today's Sales Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2 font-mono">
            {cur}
            {metrics.todaySalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {metrics.totalSalesCount} all-time sales recorded
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Inventory Valuation</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2 font-mono">
            {cur}
            {metrics.totalStockValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {metrics.productsCount} catalog items
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Customer Udhar (Receivables)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-600 mt-2 font-mono">
            {cur}
            {metrics.totalReceivables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Pending customer collections</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Supplier Payables</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-600 mt-2 font-mono">
            {cur}
            {metrics.totalPayables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Owed for inward stock bills</div>
        </div>
      </div>

      {/* Operational Modules Navigation Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
        <h2 className="text-sm font-bold text-slate-900 mb-1">
          Operational Shop Ledger Modules
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          All core business modules are fully functional with offline IndexedDB and Firestore synchronization.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <Link
            href="/dashboard/products"
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 group-hover:text-indigo-600">Products</div>
              <Package className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Catalog, SKUs, Barcodes, &amp; category attributes
            </p>
          </Link>

          <Link
            href="/dashboard/sales"
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 group-hover:text-indigo-600">POS Billing</div>
              <ShoppingCart className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Thermal receipts, credit sales &amp; stock sync
            </p>
          </Link>

          <Link
            href="/dashboard/customers"
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 group-hover:text-indigo-600">
                Customers &amp; Khata
              </div>
              <Users className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Customer directories &amp; credit ledger statements
            </p>
          </Link>

          <Link
            href="/dashboard/purchases"
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 group-hover:text-indigo-600">Purchases</div>
              <Receipt className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Inward shipments &amp; supplier bills
            </p>
          </Link>

          <Link
            href="/dashboard/suppliers"
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 group-hover:text-indigo-600">Suppliers</div>
              <Truck className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Distributor profiles &amp; accounts payable
            </p>
          </Link>

          <Link
            href="/dashboard/ledger"
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 group-hover:text-indigo-600">General Ledger</div>
              <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Dual-entry debit/credit reconciliation
            </p>
          </Link>

          <Link
            href="/dashboard/expenses"
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 group-hover:text-indigo-600">Expenses</div>
              <DollarSign className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Shop rent, utilities &amp; staff salaries
            </p>
          </Link>

          <Link
            href="/dashboard/reports"
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-900 group-hover:text-indigo-600">P&amp;L Reports</div>
              <TrendingUp className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              COGS, gross profit &amp; net operating result
            </p>
          </Link>
        </div>
      </div>

      {/* Offline Sync Engine & Interactive Lab */}
      <OfflineDemoAudit />
    </div>
  );
}
