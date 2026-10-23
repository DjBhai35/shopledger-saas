"use client";

import React from "react";
import Link from "next/link";
import { PRICING_PLANS } from "@/lib/config/pricing";
import { BUSINESS_CATEGORIES } from "@/lib/config/categories";
import {
  ShieldCheck,
  WifiOff,
  Building2,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Smartphone,
  Cpu,
  Layers,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/30">
              SL
            </div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">
              ShopLedger SaaS
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold text-slate-700 hover:text-indigo-600 px-3 py-2 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm shadow-indigo-600/20 transition-all hover:scale-[1.02]"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 lg:py-24 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Production-Ready Multi-Tenant Architecture</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Next-Generation Shop &amp; Wholesale <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 bg-clip-text text-transparent">
            Management SaaS
          </span>
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Engineered for retailers, wholesale distributors, mobile shops, and commercial trades.
          Real Firebase tenant isolation, true offline-first IndexedDB persistence, and seamless Google authentication.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <span>Launch Your Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#pricing"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold transition-colors"
          >
            View Pricing Plans
          </a>
        </div>

        {/* Feature Badges */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <ShieldCheck className="w-6 h-6 text-indigo-600 mb-2" />
            <h2 className="text-xs font-bold text-slate-900">Tenant Isolation</h2>
            <p className="text-[11px] text-slate-500 mt-1">
              Enforced at the database level by strict Firestore Security Rules.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <WifiOff className="w-6 h-6 text-emerald-600 mb-2" />
            <h2 className="text-xs font-bold text-slate-900">Offline-First Engine</h2>
            <p className="text-[11px] text-slate-500 mt-1">
              IndexedDB local storage with automatic idempotent queue synchronization.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <Building2 className="w-6 h-6 text-blue-600 mb-2" />
            <h2 className="text-xs font-bold text-slate-900">Multi-Workspace</h2>
            <p className="text-[11px] text-slate-500 mt-1">
              Role-based access (Owner, Admin, Manager, Cashier) for businesses.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <Layers className="w-6 h-6 text-amber-600 mb-2" />
            <h2 className="text-xs font-bold text-slate-900">Industry Adapters</h2>
            <p className="text-[11px] text-slate-500 mt-1">
              Preset workflows for Mobile, Electronics, Apparel, and Wholesalers.
            </p>
          </div>
        </div>
      </section>

      {/* Business Categories Supported */}
      <section className="py-12 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
              Versatile Multi-Industry Architecture
            </h2>
            <p className="text-xl font-bold text-slate-900 mt-1">
              Built for Every Type of Trade &amp; Retail Store
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {BUSINESS_CATEGORIES.map((cat) => (
              <div
                key={cat.key}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition-all text-left"
              >
                <div className="text-xs font-semibold text-slate-900">
                  {cat.label}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {cat.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
            Simple, Transparent Pricing
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Predictable Plans for Growing Merchants
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            Free forever starter plan. Upgrade when you need bulk wholesale distribution and multi-device cloud synchronization.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 bg-white border transition-all flex flex-col justify-between ${
                plan.isPopular
                  ? "border-indigo-600 shadow-md ring-2 ring-indigo-600/10 relative"
                  : "border-slate-200 shadow-xs"
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  Most Popular
                </div>
              )}

              <div>
                <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {plan.displayPrice}
                  </span>
                  <span className="text-xs text-slate-500 font-normal">
                    / {plan.durationMonths === 120 ? "forever" : `${plan.durationMonths} mo`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  {plan.billingDescription}
                </p>

                <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Up to {plan.limits.maxProducts.toLocaleString()} Products</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Up to {plan.limits.maxMonthlyInvoices.toLocaleString()} Invoices/mo</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Offline PWA + IndexedDB Mode</span>
                  </div>
                  {plan.features.wholesalePricing && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Wholesale Pricing Tiers</span>
                    </div>
                  )}
                  {plan.features.multiDeviceSync && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Multi-Device Real-time Sync</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <Link
                  href="/login"
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold text-center block transition-all ${
                    plan.isPopular
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                  }`}
                >
                  Choose {plan.name}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 ShopLedger SaaS. Built with Next.js, Firebase Auth, Firestore &amp; Offline IndexedDB.</p>
        </div>
      </footer>
    </div>
  );
}
