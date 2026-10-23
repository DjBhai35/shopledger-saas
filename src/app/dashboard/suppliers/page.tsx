"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { Supplier, SupplierLedgerEntry, PaymentMethod } from "@/types";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  recordSupplierPayment,
} from "@/lib/services/customerSupplierService";
import { getSupplierLedger } from "@/lib/services/ledgerExpenseService";
import {
  Truck,
  Plus,
  Search,
  Phone,
  MapPin,
  DollarSign,
  FileText,
  X,
  CreditCard,
  Edit2,
  Building2,
  AlertCircle,
} from "lucide-react";

export default function SuppliersPage() {
  const { workspace, userProfile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [paymentSupplier, setPaymentSupplier] = useState<Supplier | null>(null);
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);
  const [statementEntries, setStatementEntries] = useState<SupplierLedgerEntry[]>([]);

  // Form states
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);

  // Payment modal state
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cur = workspace?.currencySymbol || "$";

  const loadSuppliers = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const list = await getSuppliers(workspace.id, searchQuery);
      setSuppliers(list);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [workspace, searchQuery]);

  const resetForm = () => {
    setName("");
    setContactPerson("");
    setPhone("");
    setAddress("");
    setNotes("");
    setOpeningBalance(0);
    setEditingSupplier(null);
    setFormError(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name);
    setContactPerson(s.contactPerson || "");
    setPhone(s.phone || "");
    setAddress(s.address || "");
    setNotes(s.notes || "");
    setOpeningBalance(s.openingBalance);
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          name: name.trim(),
          contactPerson: contactPerson.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await createSupplier(
          {
            workspaceId: workspace.id,
            name: name.trim(),
            contactPerson: contactPerson.trim() || undefined,
            phone: phone.trim() || undefined,
            address: address.trim() || undefined,
            notes: notes.trim() || undefined,
            openingBalance: Number(openingBalance || 0),
          },
          userProfile?.uid || "admin"
        );
      }

      setShowAddModal(false);
      await loadSuppliers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save supplier.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPayment = (s: Supplier) => {
    setPaymentSupplier(s);
    setPaymentAmount(s.currentPayableBalance > 0 ? s.currentPayableBalance : 0);
    setPaymentMethod("bank_transfer");
    setPaymentNotes("");
    setFormError(null);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !paymentSupplier) return;
    if (paymentAmount <= 0) {
      setFormError("Payment amount must be greater than zero.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await recordSupplierPayment({
        workspaceId: workspace.id,
        supplierId: paymentSupplier.id,
        amount: Number(paymentAmount),
        paymentMethod,
        notes: paymentNotes.trim() || undefined,
        authorUid: userProfile?.uid || "admin",
      });

      setPaymentSupplier(null);
      await loadSuppliers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenStatement = async (s: Supplier) => {
    if (!workspace) return;
    setStatementSupplier(s);
    try {
      const entries = await getSupplierLedger(workspace.id, s.id);
      setStatementEntries(entries);
    } catch (err) {
      console.error(err);
    }
  };

  const totalPayables = suppliers.reduce(
    (acc, s) => acc + (s.currentPayableBalance > 0 ? s.currentPayableBalance : 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers &amp; Vendors</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track wholesale distributors, inward stock purchase accounts, and payable balances.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Total Suppliers</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {suppliers.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active wholesale vendors</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Total Accounts Payable</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {cur}
            {totalPayables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Amount owed to vendors</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Vendors with Payable Balance</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {suppliers.filter((s) => s.currentPayableBalance > 0).length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Outstanding supplier bills</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search suppliers by vendor name or contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Vendor / Company</th>
                <th className="px-4 py-3">Contact Person &amp; Phone</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3 text-right">Opening Balance</th>
                <th className="px-4 py-3 text-right">Payable Balance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading suppliers...</span>
                    </div>
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No suppliers added yet</p>
                    <p className="text-[11px] mt-0.5">
                      Register your distributors or wholesalers to start stock inward purchases.
                    </p>
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      {s.notes && (
                        <div className="text-[11px] text-slate-400 mt-0.5">{s.notes}</div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      <div>{s.contactPerson || "Primary Contact"}</div>
                      {s.phone && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          <span>{s.phone}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {s.address ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{s.address}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-500 font-medium">
                      {cur}
                      {s.openingBalance.toFixed(2)}
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-sm">
                      <span
                        className={`font-bold ${
                          s.currentPayableBalance > 0 ? "text-amber-600 font-extrabold" : "text-slate-700"
                        }`}
                      >
                        {cur}
                        {s.currentPayableBalance.toFixed(2)}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenPayment(s)}
                          title="Pay Supplier"
                          className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold text-[11px] transition-colors"
                        >
                          Pay Vendor
                        </button>
                        <button
                          onClick={() => handleOpenStatement(s)}
                          title="View Ledger Statement"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(s)}
                          title="Edit Supplier"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600" />
                <span>{editingSupplier ? "Edit Supplier" : "Register Supplier"}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveSupplier} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Supplier / Company Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Electronics Wholesale or Star Garments"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Mr. Bilal or Sales Desk"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +92 321 1122334"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Warehouse Address</label>
                <input
                  type="text"
                  placeholder="e.g. Warehouse 12, Industrial Area"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              {!editingSupplier && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Opening Payable Balance ({cur})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00 (Amount you owe this supplier)"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Terms</label>
                <input
                  type="text"
                  placeholder="e.g. 30 days payment credit, bank account details"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingSupplier ? "Update Supplier" : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment to Supplier Modal */}
      {paymentSupplier && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-600" />
                <span>Pay Supplier: {paymentSupplier.name}</span>
              </h3>
              <button
                onClick={() => setPaymentSupplier(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="text-slate-500">Current Payable Balance:</span>
              <div className="text-lg font-bold text-amber-600 mt-0.5">
                {cur}
                {paymentSupplier.currentPayableBalance.toFixed(2)}
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Amount ({cur}) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="bank_transfer">Bank Transfer / Online</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card / Check</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bank Reference / Memo
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank slip #9932, online transfer"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentSupplier(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? "Recording..." : "Confirm Supplier Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Ledger Statement Modal */}
      {statementSupplier && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Supplier Statement: {statementSupplier.name}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Current Payable Balance:{" "}
                  <strong className="text-amber-600">
                    {cur}
                    {statementSupplier.currentPayableBalance.toFixed(2)}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setStatementSupplier(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5 text-right text-emerald-600">Debit (Paid -)</th>
                    <th className="px-3 py-2.5 text-right text-amber-600">Credit (Bill +)</th>
                    <th className="px-3 py-2.5 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statementEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">
                        No transactions recorded for this supplier.
                      </td>
                    </tr>
                  ) : (
                    statementEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                          {new Date(entry.date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          <div>{entry.description}</div>
                          {entry.referenceId && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Ref: {entry.referenceId}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-emerald-600">
                          {entry.debit > 0 ? `${cur}${entry.debit.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-amber-600">
                          {entry.credit > 0 ? `${cur}${entry.credit.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                          {cur}
                          {entry.runningBalance.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setStatementSupplier(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
