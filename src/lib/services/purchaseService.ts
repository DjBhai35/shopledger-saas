import { getLocalDB } from "@/lib/offline/db";
import {
  Purchase,
  PurchaseItem,
  PurchaseReturn,
  StockMovement,
  SupplierLedgerEntry,
  PaymentMethod,
} from "@/types";
import { syncManager } from "@/lib/offline/sync-manager";

export interface CreatePurchaseInput {
  workspaceId: string;
  supplierId: string;
  items: {
    productId: string;
    quantity: number;
    unitCost: number;
  }[];
  discountTotal?: number;
  taxPercent?: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  authorUid: string;
}

export function generatePurchaseNumber(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO-${yyyy}${mm}${dd}-${rand}`;
}

export async function createPurchase(input: CreatePurchaseInput): Promise<Purchase> {
  if (!input.items || input.items.length === 0) {
    throw new Error("Purchase must contain at least one item.");
  }

  const db = await getLocalDB();
  const supplier = await db.get("suppliers", input.supplierId);
  if (!supplier || supplier.workspaceId !== input.workspaceId) {
    throw new Error("Supplier not found in this workspace.");
  }

  const now = Date.now();
  const purchaseNumber = generatePurchaseNumber();
  const purchaseId = `po_${now}_${Math.random().toString(36).substring(2, 7)}`;

  let subtotal = 0;
  const resolvedItems: PurchaseItem[] = [];

  for (const it of input.items) {
    if (it.quantity <= 0) throw new Error("Quantity must be greater than zero.");
    if (it.unitCost < 0) throw new Error("Unit cost cannot be negative.");

    const product = await db.get("products", it.productId);
    if (!product || product.workspaceId !== input.workspaceId) {
      throw new Error(`Product not found: ${it.productId}`);
    }

    const lineTotal = it.quantity * it.unitCost;
    subtotal += lineTotal;

    resolvedItems.push({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: it.quantity,
      unitCost: it.unitCost,
      total: lineTotal,
    });
  }

  const discountTotal = input.discountTotal || 0;
  const taxableAmount = Math.max(0, subtotal - discountTotal);
  const taxPercent = input.taxPercent || 0;
  const taxTotal = (taxableAmount * taxPercent) / 100;
  const grandTotal = Math.max(0, taxableAmount + taxTotal);

  const paidAmount = Number(input.paidAmount || 0);
  const balanceDue = Math.max(0, grandTotal - paidAmount);

  // 1. Atomic stock increase & cost update
  for (const it of resolvedItems) {
    const product = await db.get("products", it.productId);
    if (product) {
      const prevQty = product.quantity;
      const newQty = prevQty + it.quantity;
      product.quantity = newQty;
      product.costPrice = it.unitCost; // Update cost to latest purchase cost
      product.updatedAt = now;
      await db.put("products", product);

      const movement: StockMovement = {
        id: `sm_${now}_${Math.random().toString(36).substring(2, 6)}`,
        workspaceId: input.workspaceId,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        type: "purchase",
        quantityChange: it.quantity,
        previousQuantity: prevQty,
        newQuantity: newQty,
        unitCost: it.unitCost,
        referenceId: purchaseNumber,
        reason: `Purchase inward #${purchaseNumber}`,
        authorUid: input.authorUid,
        createdAt: now,
      };
      await db.put("stock_movements", movement);
    }
  }

  // 2. Update supplier payable balance & ledger
  if (balanceDue > 0) {
    const newPayable = supplier.currentPayableBalance + balanceDue;
    supplier.currentPayableBalance = newPayable;
    supplier.updatedAt = now;
    await db.put("suppliers", supplier);

    const ledgerEntry: SupplierLedgerEntry = {
      id: `sled_${now}_${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: input.workspaceId,
      supplierId: supplier.id,
      date: now,
      type: "purchase_credit",
      debit: 0,
      credit: balanceDue,
      runningBalance: newPayable,
      referenceId: purchaseNumber,
      description: `Purchase on credit #${purchaseNumber} (Total: ${grandTotal}, Paid: ${paidAmount})`,
      authorUid: input.authorUid,
      createdAt: now,
    };
    await db.put("supplier_ledger", ledgerEntry);
  }

  // 3. Save purchase record
  const purchase: Purchase = {
    id: purchaseId,
    workspaceId: input.workspaceId,
    purchaseNumber,
    supplierId: supplier.id,
    supplierName: supplier.name,
    items: resolvedItems,
    subtotal,
    discountTotal,
    taxTotal,
    totalAmount: grandTotal,
    paidAmount,
    balanceDue,
    paymentMethod: input.paymentMethod,
    status: "received",
    notes: input.notes,
    createdByUid: input.authorUid,
    createdAt: now,
    updatedAt: now,
  };

  await db.put("purchases", purchase);

  // 4. Enqueue sync
  await syncManager.enqueueOperation({
    workspaceId: purchase.workspaceId,
    operation: "create",
    entityType: "purchase",
    entityId: purchase.id,
    payload: purchase as unknown as Record<string, unknown>,
  });

  return purchase;
}

export async function processPurchaseReturn(params: {
  workspaceId: string;
  purchaseId: string;
  items: { productId: string; quantity: number }[];
  reason: string;
  authorUid: string;
}): Promise<PurchaseReturn> {
  const db = await getLocalDB();
  const purchase = await db.get("purchases", params.purchaseId);
  if (!purchase || purchase.workspaceId !== params.workspaceId) {
    throw new Error("Purchase order not found.");
  }

  const now = Date.now();
  let totalRefund = 0;
  const returnItems: { productId: string; productName: string; quantity: number; unitCost: number; total: number }[] = [];

  for (const retItem of params.items) {
    const pItem = purchase.items.find((i) => i.productId === retItem.productId);
    if (!pItem) throw new Error(`Product ${retItem.productId} not part of purchase.`);

    const prevReturned = pItem.returnedQuantity || 0;
    const maxReturnable = pItem.quantity - prevReturned;

    if (retItem.quantity <= 0 || retItem.quantity > maxReturnable) {
      throw new Error(`Invalid return quantity for ${pItem.productName}. Max: ${maxReturnable}`);
    }

    const refundLine = retItem.quantity * pItem.unitCost;
    totalRefund += refundLine;
    pItem.returnedQuantity = prevReturned + retItem.quantity;

    returnItems.push({
      productId: pItem.productId,
      productName: pItem.productName,
      quantity: retItem.quantity,
      unitCost: pItem.unitCost,
      total: refundLine,
    });

    // Deduct stock
    const product = await db.get("products", pItem.productId);
    if (product) {
      const prevQty = product.quantity;
      const newQty = prevQty - retItem.quantity;
      product.quantity = newQty;
      product.updatedAt = now;
      await db.put("products", product);

      const movement: StockMovement = {
        id: `sm_${now}_${Math.random().toString(36).substring(2, 6)}`,
        workspaceId: params.workspaceId,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        type: "purchase_return",
        quantityChange: -retItem.quantity,
        previousQuantity: prevQty,
        newQuantity: newQty,
        unitCost: pItem.unitCost,
        referenceId: purchase.purchaseNumber,
        reason: `Purchase return #${purchase.purchaseNumber}: ${params.reason}`,
        authorUid: params.authorUid,
        createdAt: now,
      };
      await db.put("stock_movements", movement);
    }
  }

  // Reduce supplier payable balance
  const supplier = await db.get("suppliers", purchase.supplierId);
  if (supplier && totalRefund > 0) {
    const newPayable = supplier.currentPayableBalance - totalRefund;
    supplier.currentPayableBalance = newPayable;
    supplier.updatedAt = now;
    await db.put("suppliers", supplier);

    const ledgerEntry: SupplierLedgerEntry = {
      id: `sled_${now}_${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: params.workspaceId,
      supplierId: supplier.id,
      date: now,
      type: "purchase_return",
      debit: totalRefund,
      credit: 0,
      runningBalance: newPayable,
      referenceId: purchase.purchaseNumber,
      description: `Debit note / purchase return #${purchase.purchaseNumber} (${params.reason})`,
      authorUid: params.authorUid,
      createdAt: now,
    };
    await db.put("supplier_ledger", ledgerEntry);
  }

  purchase.updatedAt = now;
  const allReturned = purchase.items.every((i) => (i.returnedQuantity || 0) >= i.quantity);
  if (allReturned) purchase.status = "returned";
  await db.put("purchases", purchase);

  const purchaseReturn: PurchaseReturn = {
    id: `pret_${now}_${Math.random().toString(36).substring(2, 6)}`,
    workspaceId: params.workspaceId,
    originalPurchaseId: purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    supplierId: purchase.supplierId,
    items: returnItems,
    refundAmount: totalRefund,
    reason: params.reason,
    authorUid: params.authorUid,
    createdAt: now,
  };

  await syncManager.enqueueOperation({
    workspaceId: params.workspaceId,
    operation: "create",
    entityType: "purchase_return",
    entityId: purchaseReturn.id,
    payload: purchaseReturn as unknown as Record<string, unknown>,
  });

  return purchaseReturn;
}

export async function getPurchases(
  workspaceId: string,
  options?: { query?: string; startDate?: number; endDate?: number; supplierId?: string }
): Promise<Purchase[]> {
  const db = await getLocalDB();
  const all = await db.getAllFromIndex("purchases", "by_workspace", workspaceId);

  return all
    .filter((p) => {
      if (options?.supplierId && p.supplierId !== options.supplierId) return false;
      if (options?.startDate && p.createdAt < options.startDate) return false;
      if (options?.endDate && p.createdAt > options.endDate) return false;
      if (options?.query && options.query.trim()) {
        const q = options.query.toLowerCase().trim();
        return p.purchaseNumber.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPurchaseById(
  workspaceId: string,
  purchaseId: string
): Promise<Purchase | null> {
  const db = await getLocalDB();
  const p = await db.get("purchases", purchaseId);
  return p && p.workspaceId === workspaceId ? p : null;
}
