"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { Customer, Supplier, CustomerLedgerEntry, SupplierLedgerEntry } from "@/types";
import { getCustomers, getSuppliers } from "@/lib/services/customerSupplierService";
import { getCustomerLedger, getSupplierLedger } from "@/lib/services/ledgerExpenseService";
import {
  BookOpen,
  Users,
  Truck,
  Search,
  Calendar,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Download,
} from "lucide-react";

export default function LedgerPage() {
  const { workspace } = useAuth();
  const [activeLedgerType, setActiveLedgerType] = useState<"customer" | "supplier">("customer");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>("all");

  const [customerEntries, setCustomerEntries] = useState<CustomerLedgerEntry[]>([]);
  const [supplierEntries, setSupplierEntries] = useState<SupplierLedgerEntry[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  const cur = workspace?.currencySymbol || "$";

  const loadData = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const [allCusts, allSupps] = await Promise.all([
        getCustomers(workspace.id),
        getSuppliers(workspace.id),
      ]);
      setCustomers(allCusts);
      setSuppliers(allSupps);

      const start = startDate ? new Date(startDate).getTime() : undefined;
      const end = endDate ? new Date(endDate).getTime() + 86400000 : undefined;

      if (activeLedgerType === "customer") {
        const cId = selectedEntityId === "all" ? undefined : selectedEntityId;
        const entries = await getCustomerLedger(workspace.id, cId, start, end);
        setCustomerEntries(entries);
      } else {
        const sId = selectedEntityId === "all" ? undefined : selectedEntityId;
        const entries = await getSupplierLedger(workspace.id, sId, start, end);
        setSupplierEntries(entries);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspace, activeLedgerType, selectedEntityId, startDate, endDate]);

  // Totals
  const totalDebit =
    activeLedgerType === "customer"
      ? customerEntries.reduce((acc, e) => acc + e.debit, 0)
      : supplierEntries.reduce((acc, e) => acc + e.debit, 0);

  const totalCredit =
    activeLedgerType === "customer"
      ? customerEntries.reduce((acc, e) => acc + e.credit, 0)
      : supplierEntries.reduce((acc, e) => acc + e.credit, 0);

  return (
    <div className="space-y-6">
      {/* Header & Ledger Type Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Khata &amp; General Ledger</h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable dual-entry accounting journal tracking customer udhar receivables and supplier payables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveLedgerType("customer");
              setSelectedEntityId("all");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeLedgerType === "customer"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Customer Khata (Udhar)</span>
          </button>
          <button
            onClick={() => {
              setActiveLedgerType("supplier");
              setSelectedEntityId("all");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeLedgerType === "supplier"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Supplier Khata (Payables)</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">
            {activeLedgerType === "customer" ? "Total Credit Sales (Debited)" : "Total Payments Made (Debited)"}
          </span>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
            {cur}
            {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">
            {activeLedgerType === "customer" ? "Total Payments Received (Credited)" : "Total Inward Purchases (Credited)"}
          </span>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
            {cur}
            {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">
            {activeLedgerType === "customer" ? "Net Outstanding Receivable" : "Net Outstanding Payable"}
          </span>
          <div
            className={`text-xl font-bold mt-1 font-mono ${
              activeLedgerType === "customer" ? "text-rose-600" : "text-amber-600"
            }`}
          >
            {cur}
            {Math.abs(totalDebit - totalCredit).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap gap-3 items-center justify-between text-xs">
        <div className="flex items-center gap-2 min-w-48">
          <span className="text-slate-500 font-semibold">Account:</span>
          <select
            value={selectedEntityId}
            onChange={(e) => setSelectedEntityId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium"
          >
            <option value="all">
              {activeLedgerType === "customer" ? "All Customer Accounts" : "All Supplier Accounts"}
            </option>
            {activeLedgerType === "customer"
              ? customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({cur}
                    {c.currentBalance.toFixed(2)})
                  </option>
                ))
              : suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({cur}
                    {s.currentPayableBalance.toFixed(2)})
                  </option>
                ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-semibold">Date Range:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="text-indigo-600 hover:underline font-semibold ml-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">
                  {activeLedgerType === "customer" ? "Customer" : "Supplier"}
                </th>
                <th className="px-4 py-3">Transaction / Details</th>
                <th className="px-4 py-3 text-center">Type</th>
                <th className="px-4 py-3 text-right">Debit (+)</th>
                <th className="px-4 py-3 text-right">Credit (-)</th>
                <th className="px-4 py-3 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading ledger entries...</span>
                    </div>
                  </td>
                </tr>
              ) : activeLedgerType === "customer" ? (
                customerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      No customer ledger entries found for the selected period.
                    </td>
                  </tr>
                ) : (
                  customerEntries.map((e) => {
                    const cust = customers.find((c) => c.id === e.customerId);
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                          {new Date(e.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {cust?.name || e.customerId}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div>{e.description}</div>
                          {e.referenceId && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Ref: {e.referenceId}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {e.type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-rose-600">
                          {e.debit > 0 ? `${cur}${e.debit.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-emerald-600">
                          {e.credit > 0 ? `${cur}${e.credit.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {cur}
                          {e.runningBalance.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )
              ) : supplierEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No supplier ledger entries found.
                  </td>
                </tr>
              ) : (
                supplierEntries.map((e) => {
                  const supp = suppliers.find((s) => s.id === e.supplierId);
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {new Date(e.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {supp?.name || e.supplierId}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{e.description}</div>
                        {e.referenceId && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Ref: {e.referenceId}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {e.type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-emerald-600">
                        {e.debit > 0 ? `${cur}${e.debit.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-amber-600">
                        {e.credit > 0 ? `${cur}${e.credit.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {cur}
                        {e.runningBalance.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
