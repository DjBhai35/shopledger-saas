"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  User,
  Building2,
  Mail,
  Shield,
  Phone,
  MapPin,
  Percent,
  Receipt,
  CheckCircle,
  Save,
} from "lucide-react";

export default function SettingsPage() {
  const { userProfile, workspace, memberships, switchWorkspace } = useAuth();
  const [businessName, setBusinessName] = useState(workspace?.name || "");
  const [phone, setPhone] = useState(workspace?.phone || "");
  const [address, setAddress] = useState(workspace?.address || "");
  const [taxRate, setTaxRate] = useState(workspace?.settings?.taxRatePercent || 0);
  const [invoicePrefix, setInvoicePrefix] = useState(workspace?.settings?.invoicePrefix || "INV-");
  const [receiptFooter, setReceiptFooter] = useState(
    workspace?.settings?.receiptFooterMessage || "Thank you for shopping with us!"
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (workspace) {
      workspace.name = businessName;
      workspace.phone = phone;
      workspace.address = address;
      workspace.settings.taxRatePercent = Number(taxRate);
      workspace.settings.invoicePrefix = invoicePrefix;
      workspace.settings.receiptFooterMessage = receiptFooter;
      workspace.updatedAt = Date.now();

      // Persist in localStorage for local sandbox session
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(`ws_${workspace.ownerUid}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            parsed.workspace = workspace;
            localStorage.setItem(`ws_${workspace.ownerUid}`, JSON.stringify(parsed));
          } catch {}
        }
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Account &amp; Workspace Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your user profile, active shop configurations, and tenant workspaces.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>Workspace configuration changes saved successfully!</span>
        </div>
      )}

      {/* User Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" />
          <span>Authenticated User Profile</span>
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {userProfile?.photoURL ? (
            <img
              src={userProfile.photoURL}
              alt="Profile"
              className="w-16 h-16 rounded-full border-2 border-indigo-100"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-indigo-600 text-white text-xl font-bold flex items-center justify-center">
              {userProfile?.displayName ? userProfile.displayName[0] : "U"}
            </div>
          )}

          <div className="space-y-1 text-xs">
            <div className="text-base font-bold text-slate-900">
              {userProfile?.displayName || "Shop Merchant"}
            </div>
            <div className="text-slate-500 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{userProfile?.email || "No email available"}</span>
            </div>
            <div className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Stable Firebase UID: {userProfile?.uid}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Settings Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-600" />
          <span>Business Workspace Preferences</span>
        </h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category (Fixed)
              </label>
              <input
                type="text"
                disabled
                value={workspace?.categoryLabel || ""}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-100 text-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>Contact Phone</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span>Shop Address</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Percent className="w-3 h-3 text-slate-400" />
                <span>Tax Rate (%)</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Receipt className="w-3 h-3 text-slate-400" />
                <span>Invoice Prefix</span>
              </label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Receipt Footer Message
            </label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>

      {/* Multi-Workspace Membership Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-2">
          Your Workspaces &amp; Memberships
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          ShopLedger is multi-tenant by design. Users can belong to multiple businesses with independent roles.
        </p>

        <div className="space-y-2">
          {memberships.map((mem) => {
            const isCurrent = mem.workspaceId === workspace?.id;
            return (
              <div
                key={mem.id}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                  isCurrent
                    ? "bg-indigo-50/60 border-indigo-300"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="font-bold text-slate-900">
                      {isCurrent ? workspace?.name : mem.workspaceId}
                    </span>
                    <span className="ml-2 text-[10px] font-semibold uppercase bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                      {mem.role}
                    </span>
                  </div>
                </div>

                {isCurrent ? (
                  <span className="text-xs font-bold text-indigo-600">Active</span>
                ) : (
                  <button
                    onClick={() => switchWorkspace(mem.workspaceId)}
                    className="px-2.5 py-1 text-xs rounded bg-white border border-slate-300 hover:bg-slate-100 font-medium text-slate-700"
                  >
                    Switch
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
