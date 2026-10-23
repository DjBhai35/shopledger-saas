"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { StockMovement, Product } from "@/types";
import { getStockMovements, getProducts } from "@/lib/services/productService";
import {
  Boxes,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  History,
  Layers,
  DollarSign,
  Package,
} from "lucide-react";

export default function InventoryPage() {
  const { workspace } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const cur = workspace?.currencySymbol || "$";

  const loadData = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const [allMovements, allProds] = await Promise.all([
        getStockMovements(workspace.id),
        getProducts(workspace.id),
      ]);
      setMovements(allMovements);
      setProducts(allProds);
    } catch (err) {
      console.error("Failed to load inventory movements:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspace]);

  // Inventory valuation summary
  const totalStockUnits = products.reduce((acc, p) => acc + Math.max(0, p.quantity), 0);
  const totalValuation = products.reduce((acc, p) => acc + Math.max(0, p.quantity) * p.costPrice, 0);
  const lowStockProducts = products.filter((p) => p.quantity > 0 && p.quantity <= p.minStockAlert);
  const outOfStockProducts = products.filter((p) => p.quantity <= 0);

  const filteredMovements = movements.filter((m) => {
    if (typeFilter !== "all" && m.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        m.productName.toLowerCase().includes(q) ||
        m.sku.toLowerCase().includes(q) ||
        m.reason.toLowerCase().includes(q) ||
        (m.referenceId?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Inventory &amp; Stock Audit</h1>
        <p className="text-xs text-slate-500 mt-1">
          Complete chronological stock movements, valuation calculations, and auditable inventory adjustments.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Inventory Valuation</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2">
            {cur}
            {totalValuation.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Cost basis valuation</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Stock Units</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2">
            {totalStockUnits.toLocaleString()} Units
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Across {products.length} product lines
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Low Stock Alert</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-700 mt-2">
            {lowStockProducts.length} Items
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Below minimum threshold</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Out of Stock</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
              0
            </div>
          </div>
          <div className="text-xl font-bold text-rose-700 mt-2">
            {outOfStockProducts.length} Items
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Requires immediate reorder</div>
        </div>
      </div>

      {/* Movement Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search stock movement audit logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { key: "all", label: "All Movements" },
            { key: "sale", label: "Sales" },
            { key: "purchase", label: "Purchases" },
            { key: "sale_return", label: "Sale Returns" },
            { key: "purchase_return", label: "Purchase Returns" },
            { key: "adjustment", label: "Adjustments" },
            { key: "damage", label: "Damaged / Expired" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTypeFilter(item.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                typeFilter === item.key
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Product Name &amp; SKU</th>
                <th className="px-4 py-3 text-center">Movement Type</th>
                <th className="px-4 py-3 text-right">Quantity Change</th>
                <th className="px-4 py-3 text-center">Prev → New</th>
                <th className="px-4 py-3">Reference / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading stock movements...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No stock movements recorded</p>
                    <p className="text-[11px] mt-0.5">
                      Stock adjustments, POS sales, and purchase orders automatically log movements here.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const isPositive = m.quantityChange > 0;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {new Date(m.createdAt).toLocaleString()}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{m.productName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">SKU: {m.sku}</div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            m.type === "sale"
                              ? "bg-blue-100 text-blue-800"
                              : m.type === "purchase"
                              ? "bg-emerald-100 text-emerald-800"
                              : m.type === "damage"
                              ? "bg-rose-100 text-rose-800"
                              : m.type === "sale_return" || m.type === "purchase_return"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {m.type.replace("_", " ")}
                        </span>
                      </td>

                      <td
                        className={`px-4 py-3 text-right font-bold font-mono text-sm ${
                          isPositive ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {isPositive ? `+${m.quantityChange}` : m.quantityChange}
                      </td>

                      <td className="px-4 py-3 text-center text-slate-500 font-mono text-[11px]">
                        {m.previousQuantity} →{" "}
                        <strong className="text-slate-900">{m.newQuantity}</strong>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        <div>{m.reason}</div>
                        {m.referenceId && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Ref: {m.referenceId}
                          </div>
                        )}
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
