"use client";

import React from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { PRICING_PLANS } from "@/lib/config/pricing";
import {
  CreditCard,
  CheckCircle,
  ShieldCheck,
  Calendar,
  Lock,
  Layers,
  Info,
} from "lucide-react";

export default function SubscriptionOverviewPage() {
  const { workspace, subscription } = useAuth();

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Subscription &amp; Entitlements
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your current tier entitlements, usage limits, and available subscription packages.
        </p>
      </div>

      {/* Active Subscription Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {subscription?.planName || "Free Starter"}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {subscription?.status || "Active"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Workspace ID: <code className="font-mono text-slate-700">{workspace?.id}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-600">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Activated On
              </span>
              <span className="font-semibold text-slate-800">
                {subscription?.startDate
                  ? new Date(subscription.startDate).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Term Expiry
              </span>
              <span className="font-semibold text-slate-800">
                {subscription?.planId === "free"
                  ? "Perpetual Free Tier"
                  : subscription?.expiryDate
                  ? new Date(subscription.expiryDate).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Entitlements & Limits Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Usage Limits */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Current Usage Limits</span>
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Max Products in Catalog:</span>
                <span className="font-bold text-slate-900">
                  {subscription?.limits.maxProducts.toLocaleString() || 100}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Monthly Invoices:</span>
                <span className="font-bold text-slate-900">
                  {subscription?.limits.maxMonthlyInvoices.toLocaleString() || 150}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Customer Records:</span>
                <span className="font-bold text-slate-900">
                  {subscription?.limits.maxCustomers.toLocaleString() || 100}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600">Staff Accounts:</span>
                <span className="font-bold text-slate-900">
                  {subscription?.limits.maxStaffAccounts || 1}
                </span>
              </div>
            </div>
          </div>

          {/* Feature Flags */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Feature Entitlements</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Offline PWA &amp; IndexedDB Engine:</span>
                <span className="font-semibold text-emerald-600">Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Customer Udhar / Khata Ledger:</span>
                <span className="font-semibold text-emerald-600">Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">PDF Invoice &amp; Receipt Export:</span>
                <span className="font-semibold text-emerald-600">Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Wholesale Volume Pricing Tiers:</span>
                <span
                  className={
                    subscription?.features.wholesalePricing
                      ? "font-semibold text-emerald-600"
                      : "text-slate-400"
                  }
                >
                  {subscription?.features.wholesalePricing ? "Enabled" : "Upgrade Required"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Multi-Device Cloud Sync:</span>
                <span
                  className={
                    subscription?.features.multiDeviceSync
                      ? "font-semibold text-emerald-600"
                      : "text-slate-400"
                  }
                >
                  {subscription?.features.multiDeviceSync ? "Enabled" : "Upgrade Required"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Rule Notice */}
        <div className="mt-6 p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex items-start gap-3 text-xs text-indigo-900">
          <Lock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Server-Side Security Enforcement:</strong> Subscription tiers and entitlements are secured by Firestore Security Rules.
            Client applications cannot elevate paid tiers. In upcoming phases, paid plans will be activated exclusively via verified server-side payment webhooks.
          </p>
        </div>
      </div>

      {/* Available Plans Comparison */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Available Subscription Packages
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRICING_PLANS.map((plan) => {
            const isCurrent = (subscription?.planId || "free") === plan.id;
            return (
              <div
                key={plan.id}
                className={`p-5 rounded-2xl bg-white border flex flex-col justify-between ${
                  isCurrent
                    ? "border-emerald-500 ring-2 ring-emerald-500/10"
                    : "border-slate-200"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-sm">{plan.name}</h3>
                    {isCurrent && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-slate-900">
                      {plan.displayPrice}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {plan.durationMonths === 120 ? "/ lifetime" : `/ ${plan.durationMonths} mo`}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    {plan.billingDescription}
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600">
                    <div>• Up to {plan.limits.maxProducts.toLocaleString()} items</div>
                    <div>• Up to {plan.limits.maxMonthlyInvoices.toLocaleString()} invoices</div>
                    <div>• Up to {plan.limits.maxStaffAccounts} staff accounts</div>
                    <div>• {plan.features.wholesalePricing ? "Wholesale pricing included" : "Basic retail billing"}</div>
                  </div>
                </div>

                <div className="mt-6">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 bg-slate-100 text-slate-400 font-semibold text-xs rounded-xl cursor-default"
                    >
                      Active Plan
                    </button>
                  ) : (
                    <button
                      disabled
                      title="Payment gateway integration will be introduced in the next phase."
                      className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs rounded-xl transition-colors cursor-not-allowed"
                    >
                      Payment Gateway (Phase 2)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
