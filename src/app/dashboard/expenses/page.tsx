"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { Expense, ExpenseCategory } from "@/types";
import {
  createExpense,
  getExpenses,
  deleteExpense,
  EXPENSE_CATEGORIES,
} from "@/lib/services/ledgerExpenseService";
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  Calendar,
  Trash2,
  Receipt,
  X,
  CreditCard,
  Building2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export default function ExpensesPage() {
  const { workspace, userProfile } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState<ExpenseCategory>("utilities");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "bank_transfer">("cash");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cur = workspace?.currencySymbol || "$";

  const loadExpenses = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const start = startDate ? new Date(startDate).getTime() : undefined;
      const end = endDate ? new Date(endDate).getTime() + 86400000 : undefined;

      const list = await getExpenses(workspace.id, {
        category: selectedCategory,
        startDate: start,
        endDate: end,
        query: searchQuery,
      });
      setExpenses(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [workspace, selectedCategory, startDate, endDate, searchQuery]);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    if (amount <= 0) {
      setFormError("Expense amount must be greater than zero.");
      return;
    }
    if (!description.trim()) {
      setFormError("Description is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await createExpense(
        {
          workspaceId: workspace.id,
          category,
          amount: Number(amount),
          date: expenseDate ? new Date(expenseDate).getTime() : Date.now(),
          paymentMethod,
          description: description.trim(),
          receiptNumber: receiptNumber.trim() || undefined,
        },
        userProfile?.uid || "admin"
      );

      setShowAddModal(false);
      setAmount(0);
      setDescription("");
      setReceiptNumber("");
      await loadExpenses();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to record expense.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!workspace) return;
    const confirm = window.confirm("Are you sure you want to delete this expense record?");
    if (!confirm) return;

    try {
      await deleteExpense(workspace.id, id);
      await loadExpenses();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete expense.");
    }
  };

  const totalExpenseSum = expenses.reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shop Expenses</h1>
          <p className="text-xs text-slate-500 mt-1">
            Record shop overhead costs, rent, utilities, and wages for operating margin calculations.
          </p>
        </div>

        <button
          onClick={() => {
            setAmount(0);
            setDescription("");
            setReceiptNumber("");
            setFormError(null);
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Expense</span>
        </button>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Total Filtered Expenses</span>
          <div className="text-2xl font-bold text-rose-600 mt-1 font-mono">
            {cur}
            {totalExpenseSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Deducted from gross profit</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Recorded Receipts</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {expenses.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Expense entries</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Primary Expense Type</span>
          <div className="text-xl font-bold text-slate-800 mt-1">
            {expenses.length > 0 ? expenses[0].categoryLabel : "None recorded"}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Most recent category</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap gap-3 items-center justify-between text-xs">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search description or receipt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-semibold">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
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
            className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs"
          />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description &amp; Memo</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3">Receipt / Ref #</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading expense ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(exp.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {exp.categoryLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {exp.description}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">
                      {exp.paymentMethod.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {exp.receiptNumber || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 text-sm">
                      {cur}
                      {exp.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-rose-600" />
                <span>Record Shop Expense</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Expense Amount ({cur}) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount || ""}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description / Purpose *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electricity bill for October or Packaging bags"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as "cash" | "card" | "bank_transfer")
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank / Online</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Receipt / Voucher # (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bill #8821"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? "Recording..." : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
