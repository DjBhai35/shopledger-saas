"use client";

import React from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { OfflineDemoAudit } from "@/components/OfflineDemoAudit";
import Link from "next/link";
import {
  Building2,
  Package,
  ShoppingCart,
  Users,
  CreditCard,
  ShieldCheck,
  ArrowUpRight,
  TrendingUp,
  Boxes,
  HelpCircle,
  Settings,
} from "lucide-react";

export default function DashboardOverviewPage() {
  const { workspace, subscription, memberships } = useAuth();

  return (
    <div className="space-y-6">
      {/* Top Welcome & Workspace Summary Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 lg:p-8 text-white shadow-sm relative overflow-hidden">
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
                Category: <strong>{workspace?.categoryLabel}</strong> • Base Currency: <strong>{workspace?.currency} ({workspace?.currencySymbol})</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/subscription"
                className="bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all backdrop-blur-md flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5 text-indigo-300" />
                <span>Plan: {subscription?.planName || "Free Starter"}</span>
              </Link>
              <Link
                href="/dashboard/settings"
                className="bg-white text-slate-900 hover:bg-slate-100 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Architecture / Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Subscription Status</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              ✓
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2 capitalize">
            {subscription?.status || "Active"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Tier: {subscription?.planId.toUpperCase()}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Authorized Team</span>
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2">
            {memberships.length} Active Member
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Max Staff Limit: {subscription?.limits.maxStaffAccounts || 1}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Catalog Capacity</span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2">
            {subscription?.limits.maxProducts.toLocaleString() || 100} Items
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Free Starter Entitlement
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Security Architecture</span>
            <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2">
            Firestore Rules
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Tenant Isolation Verified
          </div>
        </div>
      </div>

      {/* Module Operational Status Board */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Module Roadmap &amp; Availability Status
            </h2>
            <p className="text-xs text-slate-500">
              Only modules with verified, working logic are marked operational.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">Multi-Tenant Onboarding</div>
              <div className="text-[11px] text-slate-500">Isolated workspace &amp; roles</div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Operational
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">Offline IndexedDB Engine</div>
              <div className="text-[11px] text-slate-500">Idempotent mutation queue</div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Operational
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">Subscription Entitlements</div>
              <div className="text-[11px] text-slate-500">Configurable plans &amp; security</div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Operational
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-700">Products &amp; Barcode Inventory</div>
              <div className="text-[11px] text-slate-400">Batches, IMEI, variations</div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600">
              Phase 2
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-700">POS Sales &amp; Cash Drawer</div>
              <div className="text-[11px] text-slate-400">Offline receipt generation</div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600">
              Phase 2
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-700">Customer &amp; Supplier Ledger</div>
              <div className="text-[11px] text-slate-400">Khata/udhar balance tracking</div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600">
              Phase 2
            </span>
          </div>
        </div>
      </div>

      {/* Part 8 Live Demonstration: Offline Persistence & Sync Queue */}
      <OfflineDemoAudit />
    </div>
  );
}
