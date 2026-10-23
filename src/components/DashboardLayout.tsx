"use client";

import React, { useState } from "react";
import Link from "next/navigation";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { OfflineStatusIndicator } from "./OfflineStatusIndicator";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Users,
  Truck,
  ShoppingCart,
  Receipt,
  BookOpen,
  DollarSign,
  BarChart3,
  CreditCard,
  Settings,
  HelpCircle,
  Menu,
  X,
  LogOut,
  Building2,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isOperational: boolean;
  phase?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, isOperational: true },
  { name: "Products", href: "/dashboard/products", icon: Package, isOperational: true },
  { name: "Inventory", href: "/dashboard/inventory", icon: Boxes, isOperational: true },
  { name: "Customers", href: "/dashboard/customers", icon: Users, isOperational: true },
  { name: "Suppliers", href: "/dashboard/suppliers", icon: Truck, isOperational: true },
  { name: "Sales / POS", href: "/dashboard/sales", icon: ShoppingCart, isOperational: true },
  { name: "Purchases", href: "/dashboard/purchases", icon: Receipt, isOperational: true },
  { name: "Ledger / Khata", href: "/dashboard/ledger", icon: BookOpen, isOperational: true },
  { name: "Expenses", href: "/dashboard/expenses", icon: DollarSign, isOperational: true },
  { name: "Reports", href: "/dashboard/reports", icon: BarChart3, isOperational: true },
  { name: "Subscription", href: "/dashboard/subscription", icon: CreditCard, isOperational: true },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, isOperational: true },
  { name: "Help & Support", href: "/dashboard/help", icon: HelpCircle, isOperational: true },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { workspace, subscription, userProfile, signOut, isFirebaseReady } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    if (!item.isOperational) {
      e.preventDefault();
      setShowComingSoonModal(item.name);
    } else {
      router.push(item.href);
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Mobile Top Header */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
            SL
          </div>
          <span className="font-bold text-slate-900 text-sm">ShopLedger</span>
        </div>
        <div className="flex items-center gap-3">
          <OfflineStatusIndicator workspaceId={workspace?.id} />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:w-64 flex flex-col justify-between ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Workspace header */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-900/40">
                SL
              </div>
              <div>
                <h1 className="font-bold text-white text-base tracking-tight leading-none">
                  ShopLedger
                </h1>
                <span className="text-[10px] text-indigo-400 font-medium uppercase tracking-wider">
                  SaaS Platform
                </span>
              </div>
            </div>

            {/* Active Workspace Pill */}
            {workspace ? (
              <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
                <div className="flex items-center gap-2 text-xs font-semibold text-white truncate">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">{workspace.name}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span className="truncate">{workspace.categoryLabel}</span>
                  <span className="bg-indigo-950 text-indigo-300 border border-indigo-700/50 px-1.5 py-0.2 rounded text-[10px] uppercase font-semibold">
                    {subscription?.planId.toUpperCase() || "FREE"}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <button
                  key={item.name}
                  onClick={(e) => handleNavClick(item, e)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                    isActive
                      ? "bg-indigo-600 text-white font-semibold shadow-sm"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? "text-white" : "text-slate-400"
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>

                  {!item.isOperational && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-normal border border-slate-700">
                      {item.phase}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* User profile & Sign Out footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt="avatar"
                    className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-700 text-white flex items-center justify-center text-xs font-bold">
                    {userProfile?.displayName ? userProfile.displayName[0] : "U"}
                  </div>
                )}
                <div className="min-w-0 text-left">
                  <div className="text-xs font-medium text-white truncate">
                    {userProfile?.displayName || "Shopkeeper"}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {userProfile?.email}
                  </div>
                </div>
              </div>

              <button
                onClick={() => signOut()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-30 lg:hidden backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header */}
        <header className="hidden lg:flex items-center justify-between bg-white border-b border-slate-200 px-8 py-3.5 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-slate-400">Workspace</span>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                {workspace?.name || "Loading workspace..."}
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-indigo-600 font-normal">
                  {workspace?.categoryLabel}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!isFirebaseReady && (
              <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Firebase Keys Pending (Sandbox Active)
              </span>
            )}
            <OfflineStatusIndicator workspaceId={workspace?.id} />
          </div>
        </header>

        {/* Child Pages */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Coming Soon Modal */}
      {showComingSoonModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {showComingSoonModal} Module
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              This module will be introduced in <strong>Phase 2</strong> with full transactional database logic, wholesale pricing tiers, and offline POS receipt synchronization.
            </p>
            <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-600 text-left mt-4 border border-slate-200">
              <p className="font-semibold text-slate-800 mb-1">Architecture Status:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Multi-tenant workspace isolation: Active</li>
                <li>Offline IndexedDB persistence layer: Ready</li>
                <li>Idempotent sync queue: Operational</li>
              </ul>
            </div>
            <button
              onClick={() => setShowComingSoonModal(null)}
              className="mt-5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
