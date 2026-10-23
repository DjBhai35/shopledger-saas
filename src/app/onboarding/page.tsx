"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { BUSINESS_CATEGORIES } from "@/lib/config/categories";
import { POPULAR_COUNTRIES, SUPPORTED_CURRENCIES } from "@/lib/config/currencies";
import { BusinessCategoryKey } from "@/types";
import { createWorkspaceAndOnboard } from "@/lib/firebase/workspace";
import {
  Building2,
  CheckCircle,
  Store,
  Globe2,
  DollarSign,
  Phone,
  MapPin,
  ArrowRight,
  Sparkles,
  ShieldAlert,
} from "lucide-react";

export default function OnboardingPage() {
  const { user, userProfile, workspace, refreshWorkspace, loading: authLoading } = useAuth();
  const router = useRouter();

  // If user already has a workspace, redirect to dashboard
  useEffect(() => {
    if (!authLoading && workspace) {
      router.push("/dashboard");
    }
  }, [workspace, authLoading, router]);

  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<BusinessCategoryKey>("mobile_shop");
  const [country, setCountry] = useState("Pakistan");
  const [currency, setCurrency] = useState("PKR");
  const [currencySymbol, setCurrencySymbol] = useState("Rs.");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCountryChange = (countryName: string) => {
    setCountry(countryName);
    const matched = POPULAR_COUNTRIES.find((c) => c.name === countryName);
    if (matched) {
      setCurrency(matched.currency);
      setCurrencySymbol(matched.currencySymbol);
    }
  };

  const handleCurrencyChange = (currCode: string) => {
    setCurrency(currCode);
    const matched = SUPPORTED_CURRENCIES.find((c) => c.code === currCode);
    if (matched) {
      setCurrencySymbol(matched.symbol);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      setErrorMessage("Business name is required");
      return;
    }

    if (!user && !userProfile) {
      setErrorMessage("You must be signed in to initialize your business workspace.");
      return;
    }

    const userId = user?.uid || userProfile?.uid || "user_default";
    const userEmail = user?.email || userProfile?.email || null;
    const userDisplayName = user?.displayName || userProfile?.displayName || null;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createWorkspaceAndOnboard({
        userId,
        userEmail,
        userDisplayName,
        businessName: businessName.trim(),
        category,
        country,
        currency,
        currencySymbol,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });

      await refreshWorkspace();
      router.push("/dashboard");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to create business workspace"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Checking workspace status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Setup Step 1 of 1</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Register Your Business Workspace
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-600">
            Configure your shop type, currency, and defaults. You can adjust all settings later.
          </p>
        </div>

        {/* Wizard Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          {errorMessage && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Business Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-indigo-600" />
                <span>Business / Trade Name *</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Al-Madina Mobile Zone or Apex Wholesale Traders"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            {/* Business Category Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Business Category *</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
                {BUSINESS_CATEGORIES.map((cat) => {
                  const isSelected = category === cat.key;
                  return (
                    <div
                      key={cat.key}
                      onClick={() => setCategory(cat.key)}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "bg-indigo-50/80 border-indigo-600 ring-1 ring-indigo-600"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          {cat.label}
                        </span>
                        {isSelected && (
                          <CheckCircle className="w-3.5 h-3.5 text-indigo-600" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                        {cat.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Country & Currency Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Globe2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Country *</span>
                </label>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {POPULAR_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Primary Currency *</span>
                </label>
                <select
                  value={currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {SUPPORTED_CURRENCIES.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.code} ({curr.symbol}) - {curr.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional Contact Fields */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Optional Business Contact Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>Business Phone Number</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +92 300 1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Used for receipts &amp; invoices. Not required for login.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>Store / Warehouse Address</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shop 14, Main Market"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting || !businessName.trim()}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-50"
              >
                <span>
                  {isSubmitting ? "Creating Isolated Workspace..." : "Complete Setup & Launch Dashboard"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
