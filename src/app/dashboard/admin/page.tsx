"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { isUserAdmin } from "@/lib/services/platformSettingsService";
import {
  PaymentProof,
  UserProfile,
  PlatformConfiguredPlan,
  PlatformConfiguredCategory,
  AppPlatformSettings,
  PaymentProofStatus,
  AdminAuditLog,
} from "@/types";
import {
  Shield,
  ShieldAlert,
  Wallet,
  Users,
  Layers,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Search,
  Lock,
  Unlock,
  RefreshCw,
  Save,
  MessageSquare,
  AlertTriangle,
  Building2,
  History,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { userProfile } = useAuth();
  const isAdmin = isUserAdmin(userProfile);

  const [activeTab, setActiveTab] = useState<"payments" | "users" | "plans" | "categories" | "settings" | "audit">("payments");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tab 1: Payments State
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([]);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentProofStatus | "all">("pending");
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [rejectingProofId, setRejectingProofId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Tab 2: Users State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Tab 3: Pricing Plans State
  const [plans, setPlans] = useState<PlatformConfiguredPlan[]>([]);

  // Tab 4: Categories State
  const [categories, setCategories] = useState<PlatformConfiguredCategory[]>([]);

  // Tab 5: Settings State
  const [platformSettings, setPlatformSettings] = useState<AppPlatformSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Tab 6: Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState("");

  // Load data based on active tab
  useEffect(() => {
    if (!isAdmin || !userProfile) return;

    if (activeTab === "payments") loadPayments();
    if (activeTab === "users") loadUsers();
    if (activeTab === "plans" || activeTab === "categories" || activeTab === "settings") loadSettingsAndConfigs();
    if (activeTab === "audit") loadAuditLogs();
  }, [isAdmin, userProfile?.uid, activeTab, paymentStatusFilter]);

  const loadPayments = async () => {
    if (!userProfile) return;
    setIsLoadingPayments(true);
    try {
      const url = `/api/admin/payments/review?adminUid=${userProfile.uid}&adminEmail=${encodeURIComponent(userProfile.email || "")}${
        paymentStatusFilter !== "all" ? `&status=${paymentStatusFilter}` : ""
      }`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.proofs) {
        setPaymentProofs(data.proofs);
      }
    } catch {
      // Handled
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const loadUsers = async () => {
    if (!userProfile) return;
    setIsLoadingUsers(true);
    try {
      const url = `/api/admin/users?adminUid=${userProfile.uid}&adminEmail=${encodeURIComponent(userProfile.email || "")}${
        userSearchQuery ? `&query=${encodeURIComponent(userSearchQuery)}` : ""
      }`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
      }
    } catch {
      // Handled
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadSettingsAndConfigs = async () => {
    if (!userProfile) return;
    try {
      const res = await fetch(
        `/api/admin/settings?adminUid=${userProfile.uid}&adminEmail=${encodeURIComponent(userProfile.email || "")}`
      );
      const data = await res.json();
      if (res.ok) {
        if (data.settings) setPlatformSettings(data.settings);
        if (data.plans) setPlans(data.plans);
        if (data.categories) setCategories(data.categories);
      }
    } catch {
      // Handled
    }
  };

  const loadAuditLogs = async () => {
    if (!userProfile) return;
    setIsLoadingAuditLogs(true);
    try {
      const url = `/api/admin/audit-logs?adminUid=${userProfile.uid}&adminEmail=${encodeURIComponent(userProfile.email || "")}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && Array.isArray(data.logs)) {
        setAuditLogs(data.logs);
      }
    } catch {
      // Handled
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };

  const handleApprovePayment = async (proof: PaymentProof) => {
    if (!userProfile) return;
    setActionLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/payments/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          proofId: proof.id,
          adminNotes: adminNotes.trim() || "Verified on blockchain explorer by admin.",
          adminUser: {
            uid: userProfile.uid,
            email: userProfile.email,
            isSuperAdmin: userProfile.isSuperAdmin,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve payment");

      setStatusMessage({ type: "success", text: `Payment for ${proof.workspaceName} (${proof.planName}) approved and activated!` });
      setAdminNotes("");
      loadPayments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error approving payment";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!userProfile || !rejectingProofId) return;
    if (!rejectionReason.trim()) {
      setStatusMessage({ type: "error", text: "A rejection reason is required." });
      return;
    }

    setActionLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/payments/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          proofId: rejectingProofId,
          rejectionReason: rejectionReason.trim(),
          adminUser: {
            uid: userProfile.uid,
            email: userProfile.email,
            isSuperAdmin: userProfile.isSuperAdmin,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject payment");

      setStatusMessage({ type: "success", text: "Payment rejected with recorded reason." });
      setRejectingProofId(null);
      setRejectionReason("");
      loadPayments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error rejecting payment";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBlockUser = async (targetUser: UserProfile) => {
    if (!userProfile) return;
    const willBlock = !targetUser.isBlocked;
    const confirmPrompt = willBlock
      ? `Are you sure you want to BLOCK ${targetUser.email || targetUser.uid}? They will lose access to the application.`
      : `Unblock ${targetUser.email || targetUser.uid}?`;

    if (!confirm(confirmPrompt)) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUid: targetUser.uid,
          isBlocked: willBlock,
          blockedReason: willBlock ? "Account suspended by Super Administrator" : undefined,
          adminUser: {
            uid: userProfile.uid,
            email: userProfile.email,
            isSuperAdmin: userProfile.isSuperAdmin,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user block state");

      setStatusMessage({
        type: "success",
        text: `User ${targetUser.email || targetUser.uid} ${willBlock ? "blocked" : "unblocked"} successfully.`,
      });
      loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error toggling user block state";
      setStatusMessage({ type: "error", text: msg });
    }
  };

  const handleSavePlatformSettings = async () => {
    if (!userProfile || !platformSettings) return;
    setIsSavingSettings(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "settings",
          payload: platformSettings,
          adminUser: {
            uid: userProfile.uid,
            email: userProfile.email,
            isSuperAdmin: userProfile.isSuperAdmin,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");

      setStatusMessage({ type: "success", text: "Platform settings updated successfully." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving settings";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSavePricingPlans = async () => {
    if (!userProfile) return;
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "plans",
          payload: plans,
          adminUser: {
            uid: userProfile.uid,
            email: userProfile.email,
            isSuperAdmin: userProfile.isSuperAdmin,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save pricing plans");

      setStatusMessage({ type: "success", text: "Pricing plans configuration saved." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving plans";
      setStatusMessage({ type: "error", text: msg });
    }
  };

  const handleSaveCategories = async () => {
    if (!userProfile) return;
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "categories",
          payload: categories,
          adminUser: {
            uid: userProfile.uid,
            email: userProfile.email,
            isSuperAdmin: userProfile.isSuperAdmin,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save categories");

      setStatusMessage({ type: "success", text: "Shop categories availability updated." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving categories";
      setStatusMessage({ type: "error", text: msg });
    }
  };

  // Access Control Guard
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Platform Admin Access Restricted</h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          This administration console is strictly restricted to verified platform super-administrators.
          Your current account (<code>{userProfile?.email || "anonymous"}</code>) does not possess global administrative privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Platform Administration</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
              Super Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage cryptocurrency payments, verify transaction hashes, manage user access, customize plans, and configure WhatsApp support.
          </p>
        </div>
      </div>

      {/* Global Status Message Toast */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center justify-between animate-in fade-in ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
              : "bg-rose-50 border border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("payments")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === "payments"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>USDT Payments Review</span>
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === "users"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Accounts &amp; Access</span>
        </button>

        <button
          onClick={() => setActiveTab("plans")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === "plans"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Pricing &amp; Limits</span>
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === "categories"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Shop Categories</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === "settings"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Platform Settings &amp; WhatsApp</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
            activeTab === "audit"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Logs</span>
        </button>
      </div>

      {/* TAB 1: PAYMENTS REVIEW */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {(["pending", "approved", "rejected", "all"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setPaymentStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    paymentStatusFilter === filter
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {filter === "all" ? "All Payments" : filter}
                </button>
              ))}
            </div>

            <button
              onClick={loadPayments}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Refresh payments"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingPayments ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Payments Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {paymentProofs.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No payment proofs found for status: <strong>{paymentStatusFilter}</strong>.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Submitted</th>
                      <th className="px-5 py-3">Workspace &amp; User</th>
                      <th className="px-5 py-3">Plan Requested</th>
                      <th className="px-5 py-3">Network</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Transaction Hash</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paymentProofs.map((proof) => {
                      const explorerUrl =
                        proof.network === "TRC20"
                          ? `https://tronscan.org/#/transaction/${proof.txHash}`
                          : `https://bscscan.com/tx/${proof.txHash.startsWith("0x") ? proof.txHash : "0x" + proof.txHash}`;

                      return (
                        <tr key={proof.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3 text-slate-700 whitespace-nowrap">
                            {new Date(proof.submittedAt).toLocaleDateString()}{" "}
                            <span className="text-[10px] text-slate-400">
                              {new Date(proof.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="font-semibold text-slate-900">{proof.workspaceName}</div>
                            <div className="text-[11px] text-slate-500">{proof.userEmail || proof.userUid}</div>
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-800">
                            {proof.planName}
                          </td>
                          <td className="px-5 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                              {proof.network}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-bold text-slate-900">
                            ${proof.amountUSD}.00 USDT
                          </td>
                          <td className="px-5 py-3">
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group"
                              title="Verify on Block Explorer"
                            >
                              <span>{proof.txHash.substring(0, 10)}...{proof.txHash.substring(proof.txHash.length - 8)}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          </td>
                          <td className="px-5 py-3">
                            {proof.status === "pending" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                <span>Pending Verification</span>
                              </span>
                            )}
                            {proof.status === "approved" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Approved</span>
                              </span>
                            )}
                            {proof.status === "rejected" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3" />
                                <span>Rejected</span>
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {proof.status === "pending" ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  disabled={actionLoading}
                                  onClick={() => handleApprovePayment(proof)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs"
                                >
                                  Approve
                                </button>
                                <button
                                  disabled={actionLoading}
                                  onClick={() => {
                                    setRejectingProofId(proof.id);
                                    setRejectionReason("");
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                {proof.status === "rejected" ? proof.rejectionReason || "Rejected" : "Active"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rejection Modal */}
          {rejectingProofId && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-600" />
                  <span>Reject Payment Proof</span>
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Provide an explanation for rejecting this transaction. The user will see this reason in their dashboard.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rejection Reason <span className="text-rose-500">*</span>:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Transaction hash not found on chain, wrong deposit address, or amount discrepancy."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => setRejectingProofId(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={actionLoading || !rejectionReason.trim()}
                    onClick={handleRejectPayment}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USER ACCOUNTS & ACCESS */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search users by email, name, or UID..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadUsers()}
                className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <button
              onClick={loadUsers}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Refresh users"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingUsers ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3">User Profile</th>
                    <th className="px-5 py-3">User ID</th>
                    <th className="px-5 py-3">Account Status</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">{u.displayName || "Shopkeeper"}</div>
                        <div className="text-[11px] text-slate-500">{u.email || "No email"}</div>
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-600 text-[11px]">
                        {u.uid}
                      </td>
                      <td className="px-5 py-3">
                        {u.isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <Lock className="w-3 h-3" />
                            <span>Blocked</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {u.isSuperAdmin ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Super Admin
                          </span>
                        ) : (
                          <span className="text-slate-600">Standard User</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {u.uid !== userProfile?.uid ? (
                          <button
                            onClick={() => handleToggleBlockUser(u)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              u.isBlocked
                                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {u.isBlocked ? "Unblock Account" : "Block Account"}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Current Admin</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRICING & LIMITS */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Configurable Subscription Packages</h2>
            <button
              onClick={handleSavePricingPlans}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Plan Changes</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((p, idx) => (
              <div key={p.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                  <span className="text-xs font-mono text-indigo-600 font-bold">{p.id}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Price (USD):</label>
                    <input
                      type="number"
                      value={p.priceUSD}
                      onChange={(e) => {
                        const newPlans = [...plans];
                        newPlans[idx].priceUSD = Number(e.target.value);
                        setPlans(newPlans);
                      }}
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Duration (Months):</label>
                    <input
                      type="number"
                      value={p.durationMonths}
                      onChange={(e) => {
                        const newPlans = [...plans];
                        newPlans[idx].durationMonths = Number(e.target.value);
                        setPlans(newPlans);
                      }}
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Max Products:</label>
                    <input
                      type="number"
                      value={p.limits.maxProducts}
                      onChange={(e) => {
                        const newPlans = [...plans];
                        newPlans[idx].limits.maxProducts = Number(e.target.value);
                        setPlans(newPlans);
                      }}
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Max Monthly Invoices:</label>
                    <input
                      type="number"
                      value={p.limits.maxMonthlyInvoices}
                      onChange={(e) => {
                        const newPlans = [...plans];
                        newPlans[idx].limits.maxMonthlyInvoices = Number(e.target.value);
                        setPlans(newPlans);
                      }}
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SHOP CATEGORIES */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Shop Categories Availability</h2>
            <button
              onClick={handleSaveCategories}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Categories</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-xs">
            {categories.map((cat, idx) => (
              <div key={cat.key} className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-slate-900">{cat.label}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">{cat.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cat.isEnabled}
                    onChange={(e) => {
                      const newCats = [...categories];
                      newCats[idx].isEnabled = e.target.checked;
                      setCategories(newCats);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PLATFORM SETTINGS & WHATSAPP */}
      {activeTab === "settings" && platformSettings && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp Support Contact</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  WhatsApp Support Phone Number (with Country Code):
                </label>
                <input
                  type="text"
                  placeholder="+923001234567"
                  value={platformSettings.whatsappNumber}
                  onChange={(e) =>
                    setPlatformSettings({ ...platformSettings, whatsappNumber: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Example: <code>+923001234567</code> or <code>+14155552671</code>. This number powers the floating and header chat buttons.
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Default Pre-filled WhatsApp Message:
                </label>
                <input
                  type="text"
                  value={platformSettings.whatsappDefaultMessage}
                  onChange={(e) =>
                    setPlatformSettings({ ...platformSettings, whatsappDefaultMessage: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Support Email Address:
                </label>
                <input
                  type="email"
                  value={platformSettings.supportEmail}
                  onChange={(e) =>
                    setPlatformSettings({ ...platformSettings, supportEmail: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-600" />
              <span>USDT Cryptocurrency Deposit Addresses</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  USDT TRC20 Deposit Wallet Address:
                </label>
                <input
                  type="text"
                  value={platformSettings.trc20WalletAddress}
                  onChange={(e) =>
                    setPlatformSettings({ ...platformSettings, trc20WalletAddress: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  USDT BEP20 Deposit Wallet Address:
                </label>
                <input
                  type="text"
                  value={platformSettings.bep20WalletAddress}
                  onChange={(e) =>
                    setPlatformSettings({ ...platformSettings, bep20WalletAddress: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  System Announcement Message:
                </label>
                <input
                  type="text"
                  value={platformSettings.announcementMessage || ""}
                  onChange={(e) =>
                    setPlatformSettings({ ...platformSettings, announcementMessage: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSavePlatformSettings}
              disabled={isSavingSettings}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingSettings ? "Saving Settings..." : "Save All Platform Settings"}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT LOGS */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search audit actions, admin email, target..."
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>

            <button
              onClick={loadAuditLogs}
              disabled={isLoadingAuditLogs}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAuditLogs ? "animate-spin" : ""}`} />
              <span>Refresh Logs</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Platform Admin Audit Trail</h3>
                <p className="text-[11px] text-slate-500">
                  Immutable record of sensitive actions performed by platform super-administrators.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                {auditLogs.length} Records
              </span>
            </div>

            {isLoadingAuditLogs ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading audit trail...</div>
            ) : auditLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No administrator audit records logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Admin</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Target</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {auditLogs
                      .filter((l) => {
                        if (!auditSearchQuery.trim()) return true;
                        const q = auditSearchQuery.toLowerCase();
                        return (
                          l.action.toLowerCase().includes(q) ||
                          l.adminEmail.toLowerCase().includes(q) ||
                          l.targetType.toLowerCase().includes(q) ||
                          l.targetId.toLowerCase().includes(q) ||
                          JSON.stringify(l.details).toLowerCase().includes(q)
                        );
                      })
                      .map((log) => {
                        const actionColor =
                          log.action === "approve_payment"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : log.action === "reject_payment"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : log.action === "block_user"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : log.action === "unblock_user"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200";

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-sans">
                              {new Date(log.timestamp).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "medium",
                              })}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-sans font-medium text-slate-800">
                              {log.adminEmail}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${actionColor}`}
                              >
                                {log.action.replace("_", " ")}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-sans text-slate-600">
                              <span className="font-semibold text-slate-800">{log.targetType}</span>
                              <span className="text-slate-400 text-[10px] ml-1">({log.targetId.substring(0, 12)}...)</span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={JSON.stringify(log.details, null, 2)}>
                              {JSON.stringify(log.details)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
