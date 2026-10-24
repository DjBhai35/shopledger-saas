"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { PRICING_PLANS } from "@/lib/config/pricing";
import { PricingPlan, PaymentProof, CryptoNetwork, SubscriptionPlanId } from "@/types";
import { getEffectiveSubscription } from "@/lib/services/subscriptionLimitService";
import { getPlatformSettings } from "@/lib/services/platformSettingsService";
import { getPaymentProofsByWorkspace } from "@/lib/services/cryptoPaymentService";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import {
  CreditCard,
  ShieldCheck,
  Layers,
  Copy,
  Check,
  ExternalLink,
  Clock,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  HelpCircle,
  Wallet,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

export default function SubscriptionOverviewPage() {
  const { workspace, subscription, userProfile } = useAuth();
  const [platformSettings, setPlatformSettings] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentProof[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Payment Modal State
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<CryptoNetwork>("TRC20");
  const [txHash, setTxHash] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const effective = getEffectiveSubscription(subscription);

  // Load platform settings & payment history
  useEffect(() => {
    getPlatformSettings()
      .then(setPlatformSettings)
      .catch(() => {});

    loadHistory();
  }, [workspace?.id]);

  const loadHistory = async () => {
    if (!workspace?.id) return;
    setIsLoadingHistory(true);
    try {
      const proofs = await getPaymentProofsByWorkspace(workspace.id);
      setPaymentHistory(proofs);
    } catch {
      // Offline fallback
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const currentDepositAddress =
    selectedNetwork === "TRC20"
      ? platformSettings?.trc20WalletAddress || "TYDnygDkWLsqzNKnUqG3m5E1f7Zz7Y7XyZ"
      : platformSettings?.bep20WalletAddress || "0x71C8360f37C2e1907c570B2966d925539b80361f";

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(currentDepositAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleOpenPaymentModal = (plan: PricingPlan) => {
    setSelectedPlan(plan);
    setTxHash("");
    setUserNotes("");
    setFormError(null);
    setSubmitSuccess(null);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !workspace || !userProfile) return;

    setFormError(null);
    setSubmitSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/payments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          userUid: userProfile.uid,
          userEmail: userProfile.email,
          userDisplayName: userProfile.displayName,
          planId: selectedPlan.id,
          amountUSD: selectedPlan.priceUSD,
          network: selectedNetwork,
          txHash: txHash.trim(),
          userNotes: userNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit payment proof.");
      }

      setSubmitSuccess(
        "Payment proof submitted successfully! Our administrators will verify the transaction on-chain and activate your subscription."
      );
      setTxHash("");
      setUserNotes("");
      loadHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error submitting payment.";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subscription &amp; Plans</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your store's plan, renew your subscription with USDT (TRC20 &amp; BEP20), and track payment verification.
          </p>
        </div>

        <WhatsAppSupportButton mode="header" />
      </div>

      {/* Subscription Expiry Warning Banner */}
      {effective.isExpired && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900 animate-in fade-in">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h2 className="font-bold text-rose-950">Your Subscription Has Expired</h2>
            <p className="mt-0.5 text-rose-800 leading-relaxed">
              Your previous paid subscription has concluded. Your workspace is currently limited to the <strong>Free Starter Tier</strong> (100 products, 150 invoices).
              Select a package below and pay with USDT to immediately renew your higher limits.
            </p>
          </div>
        </div>
      )}

      {effective.isExpiringSoon && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h2 className="font-bold text-amber-950">Subscription Expiring Soon ({effective.daysRemaining} days remaining)</h2>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              Renew your subscription before it expires to prevent automatic catalog limit reductions. Renewals extend seamlessly from your current expiry date.
            </p>
          </div>
        </div>
      )}

      {/* Active Subscription Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {effective.planName}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    effective.isExpired
                      ? "bg-rose-100 text-rose-800 border border-rose-200"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {effective.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Workspace ID: <code className="font-mono text-slate-700">{workspace?.id}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-600">
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
            <div className="border-l border-slate-200 pl-6">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Term Expiry
              </span>
              <span className="font-semibold text-slate-800">
                {subscription?.planId === "free"
                  ? "Perpetual Free Starter"
                  : subscription?.expiryDate
                  ? new Date(subscription.expiryDate).toLocaleDateString()
                  : "N/A"}
              </span>
              {!effective.isExpired && effective.daysRemaining < 365 && subscription?.planId !== "free" && (
                <span className="text-[10px] text-indigo-600 font-medium block">
                  ({effective.daysRemaining} days remaining)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Entitlements & Limits Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Effective Usage Limits</span>
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Max Products in Catalog:</span>
                <span className="font-bold text-slate-900">
                  {effective.limits.maxProducts.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Monthly Sales Invoices:</span>
                <span className="font-bold text-slate-900">
                  {effective.limits.maxMonthlyInvoices.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Customer Records:</span>
                <span className="font-bold text-slate-900">
                  {effective.limits.maxCustomers.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600">Staff Accounts:</span>
                <span className="font-bold text-slate-900">
                  {effective.limits.maxStaffAccounts}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Payment &amp; Activation Model</span>
            </h3>
            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <p>
                • <strong>USDT Cryptocurrency Gateway:</strong> Payments are accepted in USDT on <strong>TRC20</strong> and <strong>BEP20</strong> networks.
              </p>
              <p>
                • <strong>Blockchain Verified:</strong> All submissions require a verifiable Transaction Hash (TxID). Subscriptions are activated by platform administrators after on-chain verification.
              </p>
              <p>
                • <strong>Anti-Tamper Security:</strong> Subscription entitlements and transaction proofs are enforced by server-side security rules.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Available Plans Comparison */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Upgrade or Renew Subscription
            </h2>
            <p className="text-xs text-slate-500">
              Choose the package that fits your business scale. Pay securely with USDT.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRICING_PLANS.map((plan) => {
            const isCurrent = effective.planId === plan.id && !effective.isExpired;

            return (
              <div
                key={plan.id}
                className={`p-5 rounded-2xl bg-white border flex flex-col justify-between transition-all ${
                  plan.isPopular
                    ? "border-indigo-500 ring-2 ring-indigo-500/10 shadow-sm"
                    : isCurrent
                    ? "border-emerald-500 ring-2 ring-emerald-500/10"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-sm">{plan.name}</h3>
                    {plan.isPopular && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        Active
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

                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Up to <strong>{plan.limits.maxProducts.toLocaleString()}</strong> items</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Up to <strong>{plan.limits.maxMonthlyInvoices.toLocaleString()}</strong> invoices/mo</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span><strong>{plan.limits.maxStaffAccounts}</strong> staff account(s)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Offline PWA &amp; sync engine</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Customer &amp; Supplier Khata</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  {plan.id === "free" ? (
                    <button
                      disabled
                      className="w-full py-2.5 bg-slate-100 text-slate-400 font-semibold text-xs rounded-xl cursor-default"
                    >
                      Default Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenPaymentModal(plan)}
                      className={`w-full py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                        plan.isPopular
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      }`}
                    >
                      <Wallet className="w-4 h-4" />
                      <span>{isCurrent ? "Renew Plan ($" + plan.priceUSD + ")" : "Pay with USDT ($" + plan.priceUSD + ")"}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Proof Submission Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-indigo-600" />
                  <span>USDT Payment: {selectedPlan.name}</span>
                </h3>
                <span className="text-xs text-slate-500">
                  Amount required: <strong className="text-slate-900">${selectedPlan.priceUSD}.00 USDT</strong>
                </span>
              </div>
              <button
                onClick={() => setSelectedPlan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {submitSuccess ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Payment Proof Submitted</h4>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  {submitSuccess}
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setSelectedPlan(null)}
                    className="px-6 py-2.5 bg-indigo-600 text-white font-semibold text-xs rounded-xl hover:bg-indigo-700"
                  >
                    View Status in History
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitPayment} className="space-y-4 mt-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Network Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Select USDT Network:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedNetwork("TRC20")}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedNetwork === "TRC20"
                          ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-900">TRC20 (Tron)</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Low gas fees, fast transfer</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedNetwork("BEP20")}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedNetwork === "BEP20"
                          ? "border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-900">BEP20 (BNB Chain)</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Binance Smart Chain USDT</div>
                    </button>
                  </div>
                </div>

                {/* Deposit Address Box */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                    <span>Platform {selectedNetwork} Deposit Address:</span>
                    <span className="text-[10px] text-indigo-600 uppercase font-bold tracking-wider">
                      Send USDT Only
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={currentDepositAddress}
                      className="w-full font-mono text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                        copiedAddress
                          ? "bg-emerald-600 text-white"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white"
                      }`}
                    >
                      {copiedAddress ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedAddress ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-amber-700 bg-amber-50/80 p-2 rounded-lg border border-amber-200 leading-tight">
                    ⚠️ <strong>Warning:</strong> Ensure you transfer strictly on the <strong>{selectedNetwork}</strong> network. Sending on any other network may cause permanent loss of funds.
                  </p>
                </div>

                {/* Transaction Hash Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Transaction Hash (TxID) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      selectedNetwork === "TRC20"
                        ? "e.g. 5f4b3c... (64 hex characters)"
                        : "e.g. 0x8a9b2c... (66 hex characters)"
                    }
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    className="w-full font-mono text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Copy the transaction identifier from your wallet / exchange withdrawal history.
                  </span>
                </div>

                {/* User Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Optional Transfer Memo / Wallet Name:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sent from Binance / TrustWallet"
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    className="w-full text-xs px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* Anti-fraud notice */}
                <div className="p-2.5 rounded-xl bg-slate-100 text-[11px] text-slate-600 leading-relaxed">
                  ℹ️ Submitting a transaction hash does not automatically activate your subscription. Our team verifies the transaction on the blockchain before approving.
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPlan(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !txHash.trim()}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying &amp; Submitting...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit for Verification</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Payment History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Payment Submissions &amp; Verification Status
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Track your submitted transaction hashes and approval statuses.
            </p>
          </div>
          <button
            onClick={loadHistory}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? "animate-spin" : ""}`} />
          </button>
        </div>

        {paymentHistory.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No payment proofs submitted yet for this workspace. Select a plan above to pay with USDT.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Network</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Transaction Hash</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Admin Notes / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentHistory.map((item) => {
                  const explorerUrl =
                    item.network === "TRC20"
                      ? `https://tronscan.org/#/transaction/${item.txHash}`
                      : `https://bscscan.com/tx/${item.txHash.startsWith("0x") ? item.txHash : "0x" + item.txHash}`;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-900 whitespace-nowrap">
                        {new Date(item.submittedAt).toLocaleDateString()}{" "}
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-800">
                        {item.planName}
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {item.network}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-bold text-slate-900">
                        ${item.amountUSD}.00 USDT
                      </td>
                      <td className="px-5 py-3">
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group"
                          title="View on block explorer"
                        >
                          <span>{item.txHash.substring(0, 10)}...{item.txHash.substring(item.txHash.length - 8)}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </td>
                      <td className="px-5 py-3">
                        {item.status === "pending" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Pending Review</span>
                          </span>
                        )}
                        {item.status === "approved" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Approved &amp; Active</span>
                          </span>
                        )}
                        {item.status === "rejected" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {item.status === "rejected" && item.rejectionReason && (
                          <span className="text-rose-700 font-medium">{item.rejectionReason}</span>
                        )}
                        {item.status === "approved" && (item.adminNotes || "Verified on chain.")}
                        {item.status === "pending" && <span className="text-slate-400 italic">Under review</span>}
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
  );
}
