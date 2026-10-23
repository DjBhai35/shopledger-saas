import { getLocalDB } from "@/lib/offline/db";
import { Product, StockMovement, WorkspaceSubscription } from "@/types";
import { syncManager } from "@/lib/offline/sync-manager";
import { checkProductLimit } from "./subscriptionLimitService";

export interface ProductFilterOptions {
  query?: string;
  category?: string;
  stockStatus?: "all" | "in_stock" | "low_stock" | "out_of_stock";
  includeArchived?: boolean;
}

export async function validateProduct(
  data: Partial<Product>,
  workspaceId: string,
  existingId?: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (!data.name || !data.name.trim()) {
    errors.push("Product name is required.");
  }

  if (!data.sku || !data.sku.trim()) {
    errors.push("SKU is required.");
  }

  if (data.costPrice === undefined || data.costPrice === null || isNaN(data.costPrice) || data.costPrice < 0) {
    errors.push("Cost price must be a valid positive number or 0.");
  }

  if (data.sellingPrice === undefined || data.sellingPrice === null || isNaN(data.sellingPrice) || data.sellingPrice < 0) {
    errors.push("Selling price must be a valid positive number or 0.");
  }

  if (data.quantity !== undefined && (isNaN(data.quantity) || data.quantity < 0)) {
    errors.push("Quantity cannot be negative.");
  }

  // Check duplicate SKU in workspace
  if (data.sku) {
    const db = await getLocalDB();
    const existing = await db.getAllFromIndex("products", "by_sku", data.sku.trim());
    const duplicate = existing.find(
      (p) => p.workspaceId === workspaceId && p.id !== existingId && !p.isArchived
    );
    if (duplicate) {
      errors.push(`SKU "${data.sku.trim()}" is already assigned to another active product ("${duplicate.name}").`);
    }
  }

  // Check duplicate Barcode in workspace if provided
  if (data.barcode && data.barcode.trim()) {
    const db = await getLocalDB();
    const existing = await db.getAllFromIndex("products", "by_barcode", data.barcode.trim());
    const duplicate = existing.find(
      (p) => p.workspaceId === workspaceId && p.id !== existingId && !p.isArchived
    );
    if (duplicate) {
      errors.push(`Barcode "${data.barcode.trim()}" is already assigned to "${duplicate.name}".`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function getProducts(
  workspaceId: string,
  options: ProductFilterOptions = {}
): Promise<Product[]> {
  const db = await getLocalDB();
  const allInWorkspace = await db.getAllFromIndex("products", "by_workspace", workspaceId);

  return allInWorkspace
    .filter((p) => {
      // Archive filter
      if (!options.includeArchived && p.isArchived) return false;

      // Category filter
      if (options.category && options.category !== "all" && p.category !== options.category) {
        return false;
      }

      // Stock status filter
      if (options.stockStatus === "in_stock" && p.quantity <= 0) return false;
      if (options.stockStatus === "out_of_stock" && p.quantity > 0) return false;
      if (options.stockStatus === "low_stock" && (p.quantity <= 0 || p.quantity > p.minStockAlert)) {
        return false;
      }

      // Query search filter
      if (options.query && options.query.trim()) {
        const q = options.query.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku.toLowerCase().includes(q);
        const matchesBarcode = p.barcode?.toLowerCase().includes(q) ?? false;
        const matchesBrand = p.brand?.toLowerCase().includes(q) ?? false;
        const matchesModel =
          p.mobileAttributes?.model?.toLowerCase().includes(q) ||
          p.electronicsAttributes?.model?.toLowerCase().includes(q) ||
          false;
        const matchesImei = p.mobileAttributes?.imei?.toLowerCase().includes(q) ?? false;

        return matchesName || matchesSku || matchesBarcode || matchesBrand || matchesModel || matchesImei;
      }

      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProductById(
  workspaceId: string,
  productId: string
): Promise<Product | null> {
  const db = await getLocalDB();
  const product = await db.get("products", productId);
  if (product && product.workspaceId === workspaceId) {
    return product;
  }
  return null;
}

export async function getProductByBarcodeOrSku(
  workspaceId: string,
  term: string
): Promise<Product | null> {
  if (!term || !term.trim()) return null;
  const db = await getLocalDB();
  const clean = term.trim();

  // Try barcode first
  const byBarcode = await db.getAllFromIndex("products", "by_barcode", clean);
  const matchBarcode = byBarcode.find((p) => p.workspaceId === workspaceId && !p.isArchived);
  if (matchBarcode) return matchBarcode;

  // Try SKU next
  const bySku = await db.getAllFromIndex("products", "by_sku", clean);
  const matchSku = bySku.find((p) => p.workspaceId === workspaceId && !p.isArchived);
  if (matchSku) return matchSku;

  return null;
}

export async function createProduct(
  data: Omit<Product, "id" | "createdAt" | "updatedAt" | "isArchived">,
  authorUid: string,
  subscription?: WorkspaceSubscription | null
): Promise<Product> {
  // 1. Subscription limit check
  const limitCheck = await checkProductLimit(data.workspaceId, subscription);
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.reason);
  }

  // 2. Validation
  const validation = await validateProduct(data, data.workspaceId);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const db = await getLocalDB();
  const now = Date.now();
  const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newProduct: Product = {
    ...data,
    id,
    sku: data.sku.trim(),
    barcode: data.barcode?.trim() || undefined,
    costPrice: Number(data.costPrice),
    sellingPrice: Number(data.sellingPrice),
    quantity: Number(data.quantity || 0),
    minStockAlert: Number(data.minStockAlert || 5),
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  // 3. Persist product in IndexedDB
  await db.put("products", newProduct);

  // 4. Log initial stock movement if quantity > 0
  if (newProduct.quantity > 0) {
    const movementId = `sm_${now}_${Math.random().toString(36).substring(2, 6)}`;
    const movement: StockMovement = {
      id: movementId,
      workspaceId: newProduct.workspaceId,
      productId: newProduct.id,
      productName: newProduct.name,
      sku: newProduct.sku,
      type: "opening",
      quantityChange: newProduct.quantity,
      previousQuantity: 0,
      newQuantity: newProduct.quantity,
      unitCost: newProduct.costPrice,
      reason: "Initial opening stock setup",
      authorUid,
      createdAt: now,
    };
    await db.put("stock_movements", movement);
  }

  // 5. Enqueue offline sync mutation
  await syncManager.enqueueOperation({
    workspaceId: newProduct.workspaceId,
    operation: "create",
    entityType: "product",
    entityId: newProduct.id,
    payload: newProduct as unknown as Record<string, unknown>,
  });

  return newProduct;
}

export async function updateProduct(
  productId: string,
  updates: Partial<Product>,
  authorUid: string
): Promise<Product> {
  const db = await getLocalDB();
  const existing = await db.get("products", productId);
  if (!existing) {
    throw new Error("Product not found.");
  }

  // Validation
  const validation = await validateProduct(
    { ...existing, ...updates },
    existing.workspaceId,
    productId
  );
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const now = Date.now();
  const updatedProduct: Product = {
    ...existing,
    ...updates,
    id: productId,
    workspaceId: existing.workspaceId,
    costPrice: updates.costPrice !== undefined ? Number(updates.costPrice) : existing.costPrice,
    sellingPrice: updates.sellingPrice !== undefined ? Number(updates.sellingPrice) : existing.sellingPrice,
    minStockAlert: updates.minStockAlert !== undefined ? Number(updates.minStockAlert) : existing.minStockAlert,
    updatedAt: now,
  };

  await db.put("products", updatedProduct);

  await syncManager.enqueueOperation({
    workspaceId: updatedProduct.workspaceId,
    operation: "update",
    entityType: "product",
    entityId: updatedProduct.id,
    payload: updatedProduct as unknown as Record<string, unknown>,
  });

  return updatedProduct;
}

export async function adjustProductStock(params: {
  workspaceId: string;
  productId: string;
  quantityChange: number;
  reason: string;
  type: "adjustment" | "damage";
  authorUid: string;
}): Promise<{ product: Product; movement: StockMovement }> {
  const db = await getLocalDB();
  const product = await db.get("products", params.productId);
  if (!product || product.workspaceId !== params.workspaceId) {
    throw new Error("Product not found in this workspace.");
  }

  const prevQty = product.quantity;
  const newQty = prevQty + params.quantityChange;

  if (newQty < 0) {
    throw new Error(`Insufficient stock for adjustment. Current: ${prevQty}, Requested change: ${params.quantityChange}`);
  }

  const now = Date.now();
  product.quantity = newQty;
  product.updatedAt = now;
  await db.put("products", product);

  const movementId = `sm_${now}_${Math.random().toString(36).substring(2, 6)}`;
  const movement: StockMovement = {
    id: movementId,
    workspaceId: params.workspaceId,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    type: params.type,
    quantityChange: params.quantityChange,
    previousQuantity: prevQty,
    newQuantity: newQty,
    unitCost: product.costPrice,
    reason: params.reason,
    authorUid: params.authorUid,
    createdAt: now,
  };

  await db.put("stock_movements", movement);

  // Enqueue sync
  await syncManager.enqueueOperation({
    workspaceId: params.workspaceId,
    operation: "update",
    entityType: "stock_movement",
    entityId: movement.id,
    payload: {
      productId: product.id,
      newQuantity: newQty,
      quantityChange: params.quantityChange,
      type: params.type,
      reason: params.reason,
    },
  });

  return { product, movement };
}

export async function archiveProduct(
  workspaceId: string,
  productId: string,
  archive: boolean
): Promise<Product> {
  const db = await getLocalDB();
  const product = await db.get("products", productId);
  if (!product || product.workspaceId !== workspaceId) {
    throw new Error("Product not found.");
  }

  product.isArchived = archive;
  product.updatedAt = Date.now();
  await db.put("products", product);

  await syncManager.enqueueOperation({
    workspaceId,
    operation: "update",
    entityType: "product",
    entityId: product.id,
    payload: { isArchived: archive },
  });

  return product;
}

export async function getStockMovements(
  workspaceId: string,
  productId?: string
): Promise<StockMovement[]> {
  const db = await getLocalDB();
  let movements: StockMovement[] = [];

  if (productId) {
    movements = await db.getAllFromIndex("stock_movements", "by_product", productId);
  } else {
    movements = await db.getAllFromIndex("stock_movements", "by_workspace", workspaceId);
  }

  return movements.sort((a, b) => b.createdAt - a.createdAt);
}
