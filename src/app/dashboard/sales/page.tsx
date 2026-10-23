"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { Product, Customer, Sale, PaymentMethod } from "@/types";
import { getProducts, getProductByBarcodeOrSku } from "@/lib/services/productService";
import { getCustomers } from "@/lib/services/customerSupplierService";
import {
  createSale,
  getSales,
  processSaleReturn,
  generateThermalReceiptContent,
} from "@/lib/services/salesPosService";
import {
  ShoppingCart,
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Printer,
  History,
  RotateCcw,
  X,
  CreditCard,
  DollarSign,
  User,
  AlertTriangle,
  Receipt,
} from "lucide-react";

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export default function SalesPosPage() {
  const { workspace, subscription, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");

  // POS State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("walk-in");
  const [discountTotal, setDiscountTotal] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");

  // History & Invoices State
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);

  // Return modal state
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<{ [productId: string]: number }>({});
  const [returnReason, setReturnReason] = useState("");

  // Thermal Receipt Print Modal
  const [printedSale, setPrintedSale] = useState<Sale | null>(null);
  const [receiptPaper, setReceiptPaper] = useState<"58mm" | "80mm">("80mm");

  const [posError, setPosError] = useState<string | null>(null);
  const [posSuccess, setPosSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const cur = workspace?.currencySymbol || "$";

  const loadInitialData = async () => {
    if (!workspace) return;
    try {
      const [prods, custs, sales] = await Promise.all([
        getProducts(workspace.id),
        getCustomers(workspace.id),
        getSales(workspace.id),
      ]);
      setProducts(prods);
      setCustomers(custs);
      setSalesHistory(sales);
      setTaxPercent(workspace.settings?.taxRatePercent || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [workspace]);

  // Fast Barcode Scanner input handler
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !barcodeInput.trim()) return;

    const term = barcodeInput.trim();
    setBarcodeInput("");

    try {
      const matched = await getProductByBarcodeOrSku(workspace.id, term);
      if (matched) {
        addToCart(matched);
      } else {
        setPosError(`No product found matching barcode/SKU "${term}".`);
        setTimeout(() => setPosError(null), 3500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addToCart = (product: Product) => {
    setPosError(null);
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex >= 0) {
        const item = prev[existingIndex];
        const newQty = item.quantity + 1;
        if (!workspace?.settings?.allowNegativeInventory && newQty > product.quantity) {
          setPosError(`Cannot add more than available stock (${product.quantity} ${product.unit}).`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...item, quantity: newQty };
        return updated;
      } else {
        if (!workspace?.settings?.allowNegativeInventory && product.quantity <= 0) {
          setPosError(`"${product.name}" is out of stock.`);
          return prev;
        }
        return [...prev, { product, quantity: 1, unitPrice: product.sellingPrice, discount: 0 }];
      }
    });
  };

  const updateCartItemQty = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            if (!workspace?.settings?.allowNegativeInventory && nextQty > item.product.quantity) {
              setPosError(`Available stock limit: ${item.product.quantity}`);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeCartItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  // Calculations
  const subtotal = cart.reduce(
    (acc, item) => acc + (item.unitPrice - item.discount) * item.quantity,
    0
  );
  const taxableSubtotal = Math.max(0, subtotal - discountTotal);
  const taxTotal = (taxableSubtotal * taxPercent) / 100;
  const grandTotal = Math.max(0, taxableSubtotal + taxTotal);
  const balanceDue = Math.max(0, grandTotal - paidAmount);

  // Auto-sync paid amount when grand total changes unless user adjusted
  useEffect(() => {
    setPaidAmount(grandTotal);
  }, [grandTotal]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    if (cart.length === 0) {
      setPosError("Cart is empty. Add at least one item to proceed.");
      return;
    }

    setIsSubmitting(true);
    setPosError(null);

    try {
      const selectedCust = customers.find((c) => c.id === selectedCustomerId);

      const sale = await createSale(
        {
          workspaceId: workspace.id,
          customerId: selectedCustomerId === "walk-in" ? null : selectedCustomerId,
          customerName: selectedCust ? selectedCust.name : "Walk-in Customer",
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
          })),
          discountTotal: Number(discountTotal),
          taxPercent: Number(taxPercent),
          paidAmount: Number(paidAmount),
          paymentMethod,
          notes: notes.trim() || undefined,
          authorUid: userProfile?.uid || "cashier",
        },
        workspace,
        subscription
      );

      setPosSuccess(`Sale completed! Invoice #${sale.invoiceNumber}`);
      setPrintedSale(sale);
      setCart([]);
      setDiscountTotal(0);
      setNotes("");
      setSelectedCustomerId("walk-in");

      // Reload products & sales
      await loadInitialData();
    } catch (err: unknown) {
      setPosError(err instanceof Error ? err.message : "Failed to commit sale.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !returnSale) return;
    if (!returnReason.trim()) {
      setPosError("Return reason is required.");
      return;
    }

    const itemsToReturn = Object.entries(returnItems)
      .map(([productId, quantity]) => ({ productId, quantity: Number(quantity) }))
      .filter((i) => i.quantity > 0);

    if (itemsToReturn.length === 0) {
      setPosError("Select at least one item and quantity to return.");
      return;
    }

    setIsSubmitting(true);
    setPosError(null);

    try {
      await processSaleReturn({
        workspaceId: workspace.id,
        saleId: returnSale.id,
        items: itemsToReturn,
        reason: returnReason.trim(),
        authorUid: userProfile?.uid || "cashier",
      });

      setReturnSale(null);
      setReturnItems({});
      setReturnReason("");
      setPosSuccess("Sales return processed and stock restored!");
      await loadInitialData();
    } catch (err: unknown) {
      setPosError(err instanceof Error ? err.message : "Failed to process return.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredHistory = salesHistory.filter((s) => {
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      return s.invoiceNumber.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("pos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "pos"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>POS Billing Counter</span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "history"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Invoices &amp; Returns ({salesHistory.length})</span>
          </button>
        </div>
      </div>

      {posSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{posSuccess}</span>
          </div>
          <button onClick={() => setPosSuccess(null)} className="text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {posError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{posError}</span>
          </div>
          <button onClick={() => setPosError(null)} className="text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === "pos" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Product Search & Grid */}
          <div className="lg:col-span-7 space-y-4">
            {/* Barcode & Search Controls */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Scan barcode or type exact SKU, then press Enter..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl"
                >
                  Scan
                </button>
              </form>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter catalog by product name, model, brand..."
                  value={searchProductQuery}
                  onChange={(e) => setSearchProductQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Product Quick-Click Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto p-1">
              {products
                .filter((p) => {
                  if (p.isArchived) return false;
                  if (searchProductQuery.trim()) {
                    const q = searchProductQuery.toLowerCase().trim();
                    return (
                      p.name.toLowerCase().includes(q) ||
                      p.sku.toLowerCase().includes(q) ||
                      (p.brand?.toLowerCase().includes(q) ?? false)
                    );
                  }
                  return true;
                })
                .map((p) => {
                  const isOut = p.quantity <= 0;
                  return (
                    <div
                      key={p.id}
                      onClick={() => !isOut && addToCart(p)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isOut
                          ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-200"
                          : "bg-white border-slate-200 hover:border-indigo-400 hover:shadow-xs cursor-pointer active:scale-95"
                      }`}
                    >
                      <div className="font-bold text-slate-900 text-xs line-clamp-1">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.sku}</div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                        <span className="font-bold text-indigo-600 text-xs">
                          {cur}
                          {p.sellingPrice.toFixed(2)}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            isOut
                              ? "bg-rose-100 text-rose-800"
                              : p.quantity <= p.minStockAlert
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {p.quantity} {p.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Right Column: Active Cart & Checkout */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-600" />
                <span>Current Cart ({cart.length})</span>
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] text-rose-600 hover:underline font-medium"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Cart is empty. Scan barcodes or click products on the left.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 truncate">
                        {item.product.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {cur}
                        {item.unitPrice.toFixed(2)} × {item.quantity}
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateCartItemQty(item.product.id, -1)}
                        className="w-6 h-6 rounded-md bg-white border border-slate-300 flex items-center justify-center hover:bg-slate-100"
                      >
                        <Minus className="w-3 h-3 text-slate-600" />
                      </button>
                      <span className="font-bold text-slate-800 w-5 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartItemQty(item.product.id, 1)}
                        className="w-6 h-6 rounded-md bg-white border border-slate-300 flex items-center justify-center hover:bg-slate-100"
                      >
                        <Plus className="w-3 h-3 text-slate-600" />
                      </button>
                    </div>

                    <div className="text-right min-w-16">
                      <div className="font-bold text-slate-900 font-mono">
                        {cur}
                        {((item.unitPrice - item.discount) * item.quantity).toFixed(2)}
                      </div>
                    </div>

                    <button
                      onClick={() => removeCartItem(item.product.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Customer Selection */}
            <div className="pt-2 border-t border-slate-100 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Customer (Walk-in or Credit Ledger)</span>
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="walk-in">Walk-in Customer (Full Payment Required)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""} - Owed: {cur}
                      {c.currentBalance.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Discount & Tax Row */}
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

              {/* Payment Method & Paid Amount */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-0.5">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                  >
                    <option value="cash">Cash</option>
                    <option value="credit_udhar">Credit / Udhar</option>
                    <option value="bank_transfer">Bank / Online</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-0.5">
                    Amount Paid ({cur})
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
              </div>

              {/* Totals Summary Card */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono text-xs">
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
                {taxTotal > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax ({taxPercent}%):</span>
                    <span>
                      +{cur}
                      {taxTotal.toFixed(2)}
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
                {balanceDue > 0 && (
                  <div className="flex justify-between text-xs font-bold text-rose-600">
                    <span>Balance Due (Udhar):</span>
                    <span>
                      {cur}
                      {balanceDue.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={isSubmitting || cart.length === 0}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all"
              >
                {isSubmitting ? "Processing..." : `Complete Sale (${cur}${grandTotal.toFixed(2)})`}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* History & Return Tab */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search invoice number or customer name..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Invoice Number</th>
                    <th className="px-4 py-3">Date &amp; Time</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Grand Total</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Balance Due</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-400">
                        No sales transactions found.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {s.invoiceNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[11px]">
                          {new Date(s.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-800 font-medium">
                          {s.customerName}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {cur}
                          {s.totalAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-600 font-medium">
                          {cur}
                          {s.paidAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-rose-600 font-bold">
                          {s.balanceDue > 0 ? `${cur}${s.balanceDue.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              s.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : s.status === "refunded"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setPrintedSale(s)}
                              title="Print Thermal Receipt"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            {s.status !== "refunded" && (
                              <button
                                onClick={() => {
                                  setReturnSale(s);
                                  const initItems: { [id: string]: number } = {};
                                  s.items.forEach((item) => {
                                    initItems[item.productId] = 0;
                                  });
                                  setReturnItems(initItems);
                                  setReturnReason("");
                                  setPosError(null);
                                }}
                                title="Process Sales Return"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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

      {/* Sales Return Modal */}
      {returnSale && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-600" />
                <span>Return Items: #{returnSale.invoiceNumber}</span>
              </h3>
              <button onClick={() => setReturnSale(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Customer: <strong>{returnSale.customerName}</strong>
            </p>

            <form onSubmit={handleProcessReturn} className="space-y-4 text-xs">
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {returnSale.items.map((item) => {
                  const maxReturnable = item.quantity - (item.returnedQuantity || 0);
                  if (maxReturnable <= 0) return null;

                  return (
                    <div key={item.productId} className="p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="text-[11px] text-slate-500">
                          Sold: {item.quantity} (Returnable: {maxReturnable}) • {cur}
                          {item.unitPrice.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500">Qty:</span>
                        <input
                          type="number"
                          min="0"
                          max={maxReturnable}
                          value={returnItems[item.productId] || 0}
                          onChange={(e) =>
                            setReturnItems({
                              ...returnItems,
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
                  Reason for Return *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Defective device or wrong size"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturnSale(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? "Restoring Stock..." : "Confirm Return & Restock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal Receipt Print Modal */}
      {printedSale && workspace && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>Thermal Invoice Receipt</span>
              </h3>
              <button onClick={() => setPrintedSale(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Paper Size Selector */}
            <div className="flex items-center gap-2 mb-4 text-xs">
              <span className="text-slate-500 font-medium">Paper Width:</span>
              <button
                type="button"
                onClick={() => setReceiptPaper("80mm")}
                className={`px-3 py-1 rounded-lg border font-semibold ${
                  receiptPaper === "80mm"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-slate-50 text-slate-700 border-slate-300"
                }`}
              >
                80 mm (Standard POS)
              </button>
              <button
                type="button"
                onClick={() => setReceiptPaper("58mm")}
                className={`px-3 py-1 rounded-lg border font-semibold ${
                  receiptPaper === "58mm"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-slate-50 text-slate-700 border-slate-300"
                }`}
              >
                58 mm (Compact)
              </button>
            </div>

            {/* Rendered Thermal Receipt Preview */}
            <div className="border border-slate-300 rounded-xl bg-white p-4 max-h-96 overflow-y-auto shadow-inner">
              <div
                dangerouslySetInnerHTML={{
                  __html: generateThermalReceiptContent(printedSale, workspace, receiptPaper).html,
                }}
              />
            </div>

            <div className="mt-4 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const receiptData = generateThermalReceiptContent(printedSale, workspace, receiptPaper);
                  const printWin = window.open("", "_blank");
                  if (printWin) {
                    printWin.document.write(`<html><head><title>Print Receipt</title></head><body onload="window.print();window.close();">${receiptData.html}</body></html>`);
                    printWin.document.close();
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print to Thermal Device</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintedSale(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
