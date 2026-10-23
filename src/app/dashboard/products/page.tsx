"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { Product, ProductUnit } from "@/types";
import {
  getProducts,
  createProduct,
  updateProduct,
  archiveProduct,
  adjustProductStock,
} from "@/lib/services/productService";
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Archive,
  ArrowUpDown,
  X,
  Layers,
  Sparkles,
  Smartphone,
  Tag,
  DollarSign,
  Boxes,
} from "lucide-react";

const PRODUCT_UNITS: { key: ProductUnit; label: string }[] = [
  { key: "pcs", label: "Pieces (pcs)" },
  { key: "box", label: "Boxes" },
  { key: "packet", label: "Packets" },
  { key: "kg", label: "Kilograms (kg)" },
  { key: "g", label: "Grams (g)" },
  { key: "litre", label: "Litres" },
  { key: "ml", label: "Millilitres" },
  { key: "meter", label: "Meters" },
  { key: "dozen", label: "Dozens" },
  { key: "carton", label: "Cartons" },
  { key: "pair", label: "Pairs" },
  { key: "unit", label: "Units" },
];

export default function ProductsPage() {
  const { workspace, subscription, userProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStockFilter, setSelectedStockFilter] = useState<
    "all" | "in_stock" | "low_stock" | "out_of_stock"
  >("all");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"adjustment" | "damage">("adjustment");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    barcode: "",
    category: "",
    brand: "",
    costPrice: 0,
    sellingPrice: 0,
    quantity: 0,
    minStockAlert: 5,
    unit: "pcs" as ProductUnit,
    description: "",
    // Category specific
    mobileModel: "",
    mobileImei: "",
    mobileStorage: "",
    mobileColor: "",
    mobileWarranty: "",
    repairDeviceModel: "",
    clothingSize: "",
    clothingColor: "",
    clothingStyle: "",
    groceryBatch: "",
    groceryExpiry: "",
    electronicsModel: "",
    electronicsSerial: "",
    wholesaleMinQty: 0,
    wholesalePrice: 0,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cur = workspace?.currencySymbol || "$";
  const businessCategory = workspace?.category || "other_business";

  const loadProductData = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const list = await getProducts(workspace.id, {
        query: searchQuery,
        stockStatus: selectedStockFilter,
      });
      setProducts(list);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductData();
  }, [workspace, searchQuery, selectedStockFilter]);

  const resetForm = () => {
    setFormData({
      name: "",
      sku: "",
      barcode: "",
      category: workspace?.categoryLabel || "General",
      brand: "",
      costPrice: 0,
      sellingPrice: 0,
      quantity: 0,
      minStockAlert: 5,
      unit: "pcs",
      description: "",
      mobileModel: "",
      mobileImei: "",
      mobileStorage: "",
      mobileColor: "",
      mobileWarranty: "",
      repairDeviceModel: "",
      clothingSize: "",
      clothingColor: "",
      clothingStyle: "",
      groceryBatch: "",
      groceryExpiry: "",
      electronicsModel: "",
      electronicsSerial: "",
      wholesaleMinQty: 0,
      wholesalePrice: 0,
    });
    setFormError(null);
    setEditingProduct(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || "",
      category: p.category,
      brand: p.brand || "",
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      quantity: p.quantity,
      minStockAlert: p.minStockAlert,
      unit: p.unit,
      description: p.description || "",
      mobileModel: p.mobileAttributes?.model || "",
      mobileImei: p.mobileAttributes?.imei || "",
      mobileStorage: p.mobileAttributes?.storage || "",
      mobileColor: p.mobileAttributes?.color || "",
      mobileWarranty: p.mobileAttributes?.warranty || "",
      repairDeviceModel: p.repairAttributes?.deviceModel || "",
      clothingSize: p.clothingAttributes?.size || "",
      clothingColor: p.clothingAttributes?.color || "",
      clothingStyle: p.clothingAttributes?.style || "",
      groceryBatch: p.groceryAttributes?.batchNumber || "",
      groceryExpiry: p.groceryAttributes?.expiryDate ? new Date(p.groceryAttributes.expiryDate).toISOString().split("T")[0] : "",
      electronicsModel: p.electronicsAttributes?.model || "",
      electronicsSerial: p.electronicsAttributes?.serialNumber || "",
      wholesaleMinQty: p.wholesaleAttributes?.minOrderQty || 0,
      wholesalePrice: p.wholesaleAttributes?.wholesalePrice || 0,
    });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      const categoryMetadata: Partial<Product> = {};

      if (businessCategory === "mobile_shop" || businessCategory === "mobile_parts_shop") {
        categoryMetadata.mobileAttributes = {
          model: formData.mobileModel || undefined,
          imei: formData.mobileImei || undefined,
          storage: formData.mobileStorage || undefined,
          color: formData.mobileColor || undefined,
          warranty: formData.mobileWarranty || undefined,
        };
      } else if (businessCategory === "mobile_repair_shop") {
        categoryMetadata.repairAttributes = {
          deviceModel: formData.repairDeviceModel || undefined,
        };
      } else if (businessCategory === "clothing_and_garments") {
        categoryMetadata.clothingAttributes = {
          size: formData.clothingSize || undefined,
          color: formData.clothingColor || undefined,
          style: formData.clothingStyle || undefined,
        };
      } else if (businessCategory === "general_store" || businessCategory === "cosmetics_shop") {
        categoryMetadata.groceryAttributes = {
          batchNumber: formData.groceryBatch || undefined,
          expiryDate: formData.groceryExpiry ? new Date(formData.groceryExpiry).getTime() : undefined,
        };
      } else if (businessCategory === "electronics_shop" || businessCategory === "computer_shop") {
        categoryMetadata.electronicsAttributes = {
          model: formData.electronicsModel || undefined,
          serialNumber: formData.electronicsSerial || undefined,
        };
      } else if (businessCategory === "wholesale_business") {
        categoryMetadata.wholesaleAttributes = {
          minOrderQty: Number(formData.wholesaleMinQty) || undefined,
          wholesalePrice: Number(formData.wholesalePrice) || undefined,
        };
      }

      if (editingProduct) {
        await updateProduct(
          editingProduct.id,
          {
            name: formData.name,
            sku: formData.sku,
            barcode: formData.barcode || undefined,
            category: formData.category,
            brand: formData.brand || undefined,
            costPrice: Number(formData.costPrice),
            sellingPrice: Number(formData.sellingPrice),
            minStockAlert: Number(formData.minStockAlert),
            unit: formData.unit,
            description: formData.description || undefined,
            ...categoryMetadata,
          },
          userProfile?.uid || "admin"
        );
      } else {
        await createProduct(
          {
            workspaceId: workspace.id,
            name: formData.name,
            sku: formData.sku,
            barcode: formData.barcode || undefined,
            category: formData.category || workspace.categoryLabel,
            brand: formData.brand || undefined,
            costPrice: Number(formData.costPrice),
            sellingPrice: Number(formData.sellingPrice),
            quantity: Number(formData.quantity || 0),
            minStockAlert: Number(formData.minStockAlert || 5),
            unit: formData.unit,
            description: formData.description || undefined,
            ...categoryMetadata,
          },
          userProfile?.uid || "admin",
          subscription
        );
      }

      setShowAddModal(false);
      await loadProductData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !adjustingProduct) return;
    if (adjustmentQty === 0) {
      setFormError("Adjustment quantity cannot be 0.");
      return;
    }
    if (!adjustmentReason.trim()) {
      setFormError("Reason is required for inventory audit trail.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await adjustProductStock({
        workspaceId: workspace.id,
        productId: adjustingProduct.id,
        quantityChange: Number(adjustmentQty),
        reason: adjustmentReason.trim(),
        type: adjustmentType,
        authorUid: userProfile?.uid || "admin",
      });

      setAdjustingProduct(null);
      setAdjustmentQty(0);
      setAdjustmentReason("");
      await loadProductData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to adjust stock.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (p: Product) => {
    if (!workspace) return;
    const confirm = window.confirm(
      `Are you sure you want to ${p.isArchived ? "restore" : "archive"} "${p.name}"?`
    );
    if (!confirm) return;

    try {
      await archiveProduct(workspace.id, p.id, !p.isArchived);
      await loadProductData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive product.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products &amp; Inventory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your catalog, category-specific attributes, barcode SKUs, and stock alerts.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, SKU, barcode, brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Stock Status Pills */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(["all", "in_stock", "low_stock", "out_of_stock"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStockFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize whitespace-nowrap transition-colors ${
                selectedStockFilter === status
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Product Name &amp; SKU</th>
                <th className="px-4 py-3">Category / Brand</th>
                <th className="px-4 py-3 text-right">Cost Price</th>
                <th className="px-4 py-3 text-right">Selling Price</th>
                <th className="px-4 py-3 text-center">In Stock</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading products from IndexedDB...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No products found</p>
                    <p className="text-[11px] mt-0.5">
                      {searchQuery
                        ? "Try clearing your search query or stock filter."
                        : "Click 'Add New Product' to start building your catalog."}
                    </p>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isOut = p.quantity <= 0;
                  const isLow = !isOut && p.quantity <= p.minStockAlert;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                          <span>SKU: {p.sku}</span>
                          {p.barcode && <span>• Barcode: {p.barcode}</span>}
                          {p.mobileAttributes?.model && (
                            <span className="text-indigo-600">
                              • Model: {p.mobileAttributes.model}
                            </span>
                          )}
                          {p.mobileAttributes?.imei && (
                            <span className="text-amber-600">
                              • IMEI: {p.mobileAttributes.imei}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium">
                          {p.category}
                        </span>
                        {p.brand && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{p.brand}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-medium text-slate-600">
                        {cur}
                        {p.costPrice.toFixed(2)}
                      </td>

                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {cur}
                        {p.sellingPrice.toFixed(2)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-slate-800">
                          {p.quantity} {p.unit}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                            Out of stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3 text-amber-600" /> Low stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                            In stock
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setAdjustingProduct(p);
                              setAdjustmentQty(0);
                              setAdjustmentReason("");
                              setFormError(null);
                            }}
                            title="Adjust Stock"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Product"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleArchive(p)}
                            title={p.isArchived ? "Restore" : "Archive"}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                <span>{editingProduct ? "Edit Product" : "Add New Product"}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              {/* Product Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samsung Galaxy A54 5G or Cotton Polo T-Shirt"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* SKU & Barcode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SAM-A54-BLK"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Barcode (EAN/UPC)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 8806091234567"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Category, Brand, Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Brand / Maker</label>
                  <input
                    type="text"
                    placeholder="e.g. Samsung, Nike, HP"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit of Measure</label>
                  <select
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({ ...formData, unit: e.target.value as ProductUnit })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {PRODUCT_UNITS.map((u) => (
                      <option key={u.key} value={u.key}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cost Price ({cur}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.costPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, costPrice: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Selling Price ({cur}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, sellingPrice: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {editingProduct ? "Current Stock (Readonly)" : "Initial Stock"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={!!editingProduct}
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: Number(e.target.value) })
                    }
                    className={`w-full px-3 py-2 rounded-xl border border-slate-300 ${
                      editingProduct ? "bg-slate-100 text-slate-500" : "bg-white"
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Low Stock Alert
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStockAlert}
                    onChange={(e) =>
                      setFormData({ ...formData, minStockAlert: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>

              {/* Category-Specific Dynamic Section */}
              {(businessCategory === "mobile_shop" || businessCategory === "mobile_parts_shop") && (
                <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100 space-y-3">
                  <span className="font-bold text-indigo-950 flex items-center gap-1.5 text-[11px]">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Mobile Device Specifications</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <input
                      type="text"
                      placeholder="Model (e.g. A54 5G)"
                      value={formData.mobileModel}
                      onChange={(e) => setFormData({ ...formData, mobileModel: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                    <input
                      type="text"
                      placeholder="IMEI / Serial"
                      value={formData.mobileImei}
                      onChange={(e) => setFormData({ ...formData, mobileImei: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Storage (e.g. 128GB)"
                      value={formData.mobileStorage}
                      onChange={(e) => setFormData({ ...formData, mobileStorage: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Color / Warranty"
                      value={formData.mobileColor}
                      onChange={(e) => setFormData({ ...formData, mobileColor: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                  </div>
                </div>
              )}

              {businessCategory === "clothing_and_garments" && (
                <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100 space-y-3">
                  <span className="font-bold text-indigo-950 text-[11px]">
                    Apparel &amp; Garment Attributes
                  </span>
                  <div className="grid grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      placeholder="Size (S, M, L, XL, 32...)"
                      value={formData.clothingSize}
                      onChange={(e) => setFormData({ ...formData, clothingSize: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Color / Fabric"
                      value={formData.clothingColor}
                      onChange={(e) => setFormData({ ...formData, clothingColor: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Style / Fit"
                      value={formData.clothingStyle}
                      onChange={(e) => setFormData({ ...formData, clothingStyle: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                  </div>
                </div>
              )}

              {businessCategory === "wholesale_business" && (
                <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100 space-y-3">
                  <span className="font-bold text-indigo-950 text-[11px]">
                    Wholesale Bulk Tier Details
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">
                        Minimum Order Quantity (MOQ)
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 10"
                        value={formData.wholesaleMinQty}
                        onChange={(e) =>
                          setFormData({ ...formData, wholesaleMinQty: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">
                        Wholesale Unit Price ({cur})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 45.00"
                        value={formData.wholesalePrice}
                        onChange={(e) =>
                          setFormData({ ...formData, wholesalePrice: Number(e.target.value) })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50 shadow-sm"
                >
                  {isSubmitting ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-indigo-600" />
                <span>Adjust Stock: {adjustingProduct.name}</span>
              </h3>
              <button
                onClick={() => setAdjustingProduct(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Current Stock: <strong>{adjustingProduct.quantity} {adjustingProduct.unit}</strong>
            </p>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleAdjustStockSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adjustment Type</label>
                <select
                  value={adjustmentType}
                  onChange={(e) =>
                    setAdjustmentType(e.target.value as "adjustment" | "damage")
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                >
                  <option value="adjustment">Manual Audit Adjustment (+ / -)</option>
                  <option value="damage">Damaged / Expired Stock Deduction (-)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Quantity Change (+ to add, - to subtract)
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. +5 or -2"
                  value={adjustmentQty}
                  onChange={(e) => setAdjustmentQty(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Adjustment *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physical inventory count correction or Damaged in transit"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? "Adjusting..." : "Apply Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
