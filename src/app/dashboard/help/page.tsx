"use client";

import React from "react";
import {
  HelpCircle,
  BookOpen,
  WifiOff,
  ShieldCheck,
  CreditCard,
  MessageSquare,
  ExternalLink,
} from "lucide-react";

export default function HelpAndSupportPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Help &amp; Support</h1>
        <p className="text-xs text-slate-500 mt-1">
          Documentation, offline diagnostics, and guidance for shopkeepers and administrators.
        </p>
      </div>

      {/* Clear notice about future full support module */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-bold text-blue-900">
            Phase 1 Help &amp; Support Knowledge Base
          </h2>
          <p className="mt-1 leading-relaxed text-blue-700">
            Direct in-app live chat, ticket dispatch, and WhatsApp hotline integration will be introduced in <strong>Phase 2</strong>.
            Below is the architectural guide for your workspace, offline synchronization, and multi-tenant security rules.
          </p>
        </div>
      </div>

      {/* Frequently Asked Architecture Questions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <WifiOff className="w-4 h-4 text-amber-600" />
            <h3>How does Offline Mode work?</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            All workspace records are persisted locally inside your browser via IndexedDB. When internet connectivity drops, your changes are queued with unique idempotency UUIDs. Once your connection restores, the synchronization manager automatically dispatches the queue without duplicating transactions.
          </p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3>Is my shop data isolated from others?</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Yes. Every transaction, product, and setting requires validation against your workspace ID. Strict Firebase Security Rules deny any user outside of your workspace membership from reading or modifying your data.
          </p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            <h3>How do subscriptions and limits operate?</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            The platform provides a Free Starter tier ($0) and low-cost growth plans ($5/2mo, $8/6mo, $15/12mo). Plan limits restrict catalog size and invoice counts. All paid upgrades require server-side verification to prevent client tampering.
          </p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <BookOpen className="w-4 h-4 text-purple-600" />
            <h3>What modules are coming in Phase 2?</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Phase 2 will activate the live transactional engine: Products &amp; Barcode Scanner, POS Cash Register, Customer Udhar/Khata Ledger, Supplier Purchases, Wholesale Tiered Pricing, and Automated Daily Sales Reports.
          </p>
        </div>
      </div>
    </div>
  );
}
