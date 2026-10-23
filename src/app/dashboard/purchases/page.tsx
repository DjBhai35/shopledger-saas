"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { Product, Supplier, Purchase, PaymentMethod } from "@/types";
import { getProducts } from "@/lib/services/productService";
import { getSuppliers } from "@/lib/services/customerSupplierService";
import {
  createPurchase,
  getPurchases,
  processPurchaseReturn,
} from "@/lib/services/purchaseService";
import {
  Receipt,
  Plus,
  Search,
  Truck,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  X,
  Boxes,
  Trash2,
  Calendar,
  DollarSign,
  FileText,
} from "lucide-react";

interface PurchaseLineItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
}

export default function PurchasesPage() {
  const { workspace, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"history" | "new_purchase">("history");

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // New Purchase Form
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseLineItem[]>([]);
  const [discountTotal, setDiscountTotal] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [notes, setNotes] = useState("");

  // Item selector in modal/form
  const [selectedProdId, setSelectedProdId] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemCost, setItemCost] = useState(0);

  // Return modal
  const [returnPurchase, setReturnPurchase] = useState<Purchase | null>(null);
  const [returnQtys, setReturnQtys] = useState<{ [prodId: string]: number }>({});
  const [returnReason, setReturnReason] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cur = workspace?.currencySymbol || "$";

  const loadData = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const [allPurchases, allSupps, allProds] = await Promise.all([
        getPurchases(workspace.id),
        getSuppliers(workspace.id),
        getProducts(workspace.id),
      ]);
      setPurchases(allPurchases);
      setSuppliers(allSupps);
      setProducts(allProds);
      if (allSupps.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(allSupps[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspace]);

  const handleAddLineItem = () => {
    if (!selectedProdId) return;
    const prod = products.find((p) => p.id === selectedProdId);
    if (!prod) return;

    if (itemQty <= 0) {
      setFormError("Item quantity must be greater than zero.");
      return;
    }
    if (itemCost < 0) {
      setFormError("Cost price cannot be negative.");
      return;
    }

    setPurchaseItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === prod.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity += itemQty;
        copy[idx].unitCost = itemCost;
        return copy;
      }
      return [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          quantity: itemQty,
          unitCost: itemCost,
        },
      ];
    });

    setSelectedProdId("");
    setItemQty(1);
    setItemCost(0);
    setFormError(null);
  };

  const handleProductSelectChange = (id: string) => {
    setSelectedProdId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setItemCost(prod.costPrice);
    }
  };

  const removeLineItem = (productId: string) => {
    setPurchaseItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  // Calculations
  const subtotal = purchaseItems.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);
  const taxable = Math.max(0, subtotal - discountTotal);
  const taxTotal = (taxable * taxPercent) / 100;
  const grandTotal = Math.max(0, taxable + taxTotal);
  const balanceDue = Math.max(0, grandTotal - paidAmount);

  // Sync paid amount with grandTotal by default
  useEffect(() => {
    setPaidAmount(grandTotal);
  }, [grandTotal]);

  const handleCreatePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    if (!selectedSupplierId) {
      setFormError("Please select a vendor supplier.");
      return;
    }
    if (purchaseItems.length === 0) {
      setFormError("Add at least one inward stock product.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const purchase = await createPurchase({
        workspaceId: workspace.id,
        supplierId: selectedSupplierId,
        items: purchaseItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
        discountTotal: Number(discountTotal),
        taxPercent: Number(taxPercent),
        paidAmount: Number(paidAmount),
        paymentMethod,
        notes: notes.trim() || undefined,
        authorUid: userProfile?.uid || "admin",
      });

      setFormSuccess(`Purchase Order #${purchase.purchaseNumber} recorded! Stock incremented.`);
      setPurchaseItems([]);
      setDiscountTotal(0);
      setNotes("");
      setActiveTab("history");
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to record purchase.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessPurchaseReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !returnPurchase) return;
    if (!returnReason.trim()) {
      setFormError("Return reason is required.");
      return;
    }

    const items = Object.entries(returnQtys)
      .map(([productId, quantity]) => ({ productId, quantity: Number(quantity) }))
      .filter((i) => i.quantity > 0);

    if (items.length === 0) {
      setFormError("Select at least one product quantity to return.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await processPurchaseReturn({
        workspaceId: workspace.id,
        purchaseId: returnPurchase.id,
        items,
        reason: returnReason.trim(),
        authorUid: userProfile?.uid || "admin",
      });

      setReturnPurchase(null);
      setReturnQtys({});
      setReturnReason("");
      setFormSuccess("Purchase return recorded and stock deducted.");
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to process return.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPurchases = purchases.filter((p) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return p.purchaseNumber.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchases &amp; Inward Stock</h1>
          <p className="text-xs text-slate-500 mt-1">
            Receive stock from wholesale distributors, update cost bases, and manage accounts payable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "history"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Inward Orders ({purchases.length})
          </button>
          <button
            onClick={() => setActiveTab("new_purchase")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "new_purchase"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>New Inward Purchase</span>
          </button>
        </div>
      </div>

      {formSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{formSuccess}</span>
          </div>
          <button onClick={() => setFormSuccess(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span>{formError}</span>
          </div>
          <button onClick={() => setFormError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === "new_purchase" ? (
        /* New Purchase Form */
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 max-w-4xl">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <span>Receive Inward Shipment from Supplier</span>
          </h2>

          <form onSubmit={handleCreatePurchaseSubmit} className="space-y-6 text-xs">
            {/* Vendor Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Select Supplier / Distributor *</span>
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  {suppliers.length === 0 ? (
                    <option value="">No suppliers registered (Add in Suppliers tab)</option>
                  ) : (
                    suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} - Payable: {cur}
                        {s.currentPayableBalance.toFixed(2)}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Method for Paid Portion
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="bank_transfer">Bank Transfer / Online</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card / Check</option>
                  <option value="credit_udhar">Full Credit (Pay Later)</option>
                </select>
              </div>
            </div>

            {/* Add Products Line Item Box */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <span className="font-bold text-slate-800 text-xs">Add Product to Inward Order</span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] text-slate-600 mb-1">Select Product</label>
                  <select
                    value={selectedProdId}
                    onChange={(e) => handleProductSelectChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                  >
                    <option value="">-- Choose from Catalog --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) - Cur Stock: {p.quantity} {p.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={itemQty}
                    onChange={(e) => setItemQty(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] text-slate-600 mb-1">
                    Unit Cost ({cur})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemCost}
                    onChange={(e) => setItemCost(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs"
                  >
                    + Add Item
                  </button>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Product &amp; SKU</th>
                    <th className="px-3 py-2.5 text-center">Inward Quantity</th>
                    <th className="px-3 py-2.5 text-right">Unit Cost</th>
                    <th className="px-3 py-2.5 text-right">Line Total</th>
                    <th className="px-3 py-2.5 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-400">
                        No inward items added yet. Use the box above to add items.
                      </td>
                    </tr>
                  ) : (
                    purchaseItems.map((item) => (
                      <tr key={item.productId} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <span className="font-bold text-slate-900">{item.productName}</span>
                          <span className="text-[10px] text-slate-400 font-mono ml-2">
                            {item.sku}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-bold font-mono">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {cur}
                          {item.unitCost.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                          {cur}
                          {(item.quantity * item.unitCost).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeLineItem(item.productId)}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations & Payment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Discount ({cur})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountTotal}
                      onChange={(e) => setDiscountTotal(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Tax (%)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={taxPercent}
                      onChange={(e) => setTaxPercent(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-0.5">
                    Amount Paid to Supplier Now ({cur})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-0.5">
                    Notes / Bill Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Supplier Invoice #B-9912"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              {/* Totals Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>
                    {cur}
                    {subtotal.toFixed(2)}
                  </span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>
                      -{cur}
                      {discountTotal.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span>
                    {cur}
                    {grandTotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Paid Now:</span>
                  <span>
                    {cur}
                    {paidAmount.toFixed(2)}
                  </span>
                </div>
                {balanceDue > 0 && (
                  <div className="flex justify-between text-xs font-bold text-amber-600">
                    <span>Added to Supplier Payable:</span>
                    <span>
                      {cur}
                      {balanceDue.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className="px-4 py-2 rounded-xl border border-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || purchaseItems.length === 0}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50 shadow-md"
              >
                {isSubmitting ? "Receiving Stock..." : `Commit Purchase Order (${cur}${grandTotal.toFixed(2)})`}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Purchases History List */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search purchase order number or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">PO Number</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3 text-right">Grand Total</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Payable Balance</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700">No purchase orders recorded</p>
                        <p className="text-[11px] mt-0.5">
                          Click 'New Inward Purchase' to record incoming stock.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {p.purchaseNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[11px]">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {p.supplierName}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {cur}
                          {p.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-600 font-medium">
                          {cur}
                          {p.paidAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-amber-600 font-bold">
                          {p.balanceDue > 0 ? `${cur}${p.balanceDue.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              p.status === "received"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.status !== "returned" && (
                            <button
                              onClick={() => {
                                setReturnPurchase(p);
                                const q: { [id: string]: number } = {};
                                p.items.forEach((i) => (q[i.productId] = 0));
                                setReturnQtys(q);
                                setReturnReason("");
                                setFormError(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-[11px] font-semibold"
                            >
                              Return Stock
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Return Modal */}
      {returnPurchase && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-600" />
                <span>Return Stock to #{returnPurchase.supplierName}</span>
              </h3>
              <button onClick={() => setReturnPurchase(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              PO: <strong>{returnPurchase.purchaseNumber}</strong>
            </p>

            <form onSubmit={handleProcessPurchaseReturn} className="space-y-4 text-xs">
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {returnPurchase.items.map((item) => {
                  const maxReturnable = item.quantity - (item.returnedQuantity || 0);
                  if (maxReturnable <= 0) return null;

                  return (
                    <div key={item.productId} className="p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="text-[11px] text-slate-500">
                          Inward: {item.quantity} (Returnable: {maxReturnable}) • {cur}
                          {item.unitCost.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500">Qty:</span>
                        <input
                          type="number"
                          min="0"
                          max={maxReturnable}
                          value={returnQtys[item.productId] || 0}
                          onChange={(e) =>
                            setReturnQtys({
                              ...returnQtys,
                              [item.productId]: Math.min(
                                maxReturnable,
                                Math.max(0, Number(e.target.value))
                              ),
                            })
                          }
                          className="w-16 px-2 py-1 rounded-lg border border-slate-300 font-mono text-center"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Return to Supplier *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Expired batch, damaged goods, or overshipped"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturnPurchase(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? "Deducting Stock..." : "Confirm Return & Debit Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
