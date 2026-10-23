import { getLocalDB } from "@/lib/offline/db";
import {
  Sale,
  SaleItem,
  SaleReturn,
  StockMovement,
  CustomerLedgerEntry,
  PaymentMethod,
  Workspace,
  WorkspaceSubscription,
} from "@/types";
import { syncManager } from "@/lib/offline/sync-manager";
import { checkMonthlyInvoiceLimit } from "./subscriptionLimitService";

export interface CreateSaleInput {
  workspaceId: string;
  customerId: string | null;
  customerName?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }[];
  discountTotal?: number;
  taxPercent?: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  authorUid: string;
}

export function generateInvoiceNumber(prefix = "INV-"): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${yyyy}${mm}${dd}-${rand}`;
}

export async function createSale(
  input: CreateSaleInput,
  workspace?: Workspace | null,
  subscription?: WorkspaceSubscription | null
): Promise<Sale> {
  // 1. Check monthly subscription invoice limit
  const limitCheck = await checkMonthlyInvoiceLimit(input.workspaceId, subscription);
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.reason);
  }

  // 2. Validate items
  if (!input.items || input.items.length === 0) {
    throw new Error("Sale must contain at least one item.");
  }

  const db = await getLocalDB();
  const now = Date.now();
  const allowNegative = workspace?.settings?.allowNegativeInventory ?? false;
  const invoiceNumber = generateInvoiceNumber(workspace?.settings?.invoicePrefix || "INV-");
  const saleId = `sale_${now}_${Math.random().toString(36).substring(2, 7)}`;

  // 3. Verify stock availability and prepare items with snapshot of cost and details
  const resolvedItems: SaleItem[] = [];
  let subtotal = 0;

  for (const itemInput of input.items) {
    if (itemInput.quantity <= 0) {
      throw new Error("Item quantity must be greater than zero.");
    }
    if (itemInput.unitPrice < 0) {
      throw new Error("Item unit price cannot be negative.");
    }

    const product = await db.get("products", itemInput.productId);
    if (!product || product.workspaceId !== input.workspaceId) {
      throw new Error(`Product not found for ID: ${itemInput.productId}`);
    }

    if (!allowNegative && product.quantity < itemInput.quantity) {
      throw new Error(
        `Insufficient stock for "${product.name}". Available: ${product.quantity}, Requested: ${itemInput.quantity}`
      );
    }

    const discountPerItem = itemInput.discount || 0;
    const lineTotal = (itemInput.unitPrice - discountPerItem) * itemInput.quantity;
    subtotal += lineTotal;

    resolvedItems.push({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      barcode: product.barcode,
      quantity: itemInput.quantity,
      unit: product.unit,
      unitCost: product.costPrice,
      unitPrice: itemInput.unitPrice,
      discount: discountPerItem,
      total: lineTotal,
    });
  }

  const discountTotal = input.discountTotal || 0;
  const taxableAmount = Math.max(0, subtotal - discountTotal);
  const taxPercent = input.taxPercent || 0;
  const taxTotal = (taxableAmount * taxPercent) / 100;
  const grandTotal = Math.max(0, taxableAmount + taxTotal);

  const paidAmount = Number(input.paidAmount || 0);
  if (paidAmount < 0) {
    throw new Error("Paid amount cannot be negative.");
  }

  const balanceDue = Math.max(0, grandTotal - paidAmount);

  // If there is an unpaid balance, a registered customer must be selected
  if (balanceDue > 0 && (!input.customerId || input.customerId === "walk-in")) {
    throw new Error("Credit sales (Udhar) require selecting a registered customer. Walk-in customers must pay in full.");
  }

  // 4. Atomic stock decrement & movement logging
  for (const item of resolvedItems) {
    const product = await db.get("products", item.productId);
    if (product) {
      const prevQty = product.quantity;
      const newQty = prevQty - item.quantity;
      product.quantity = newQty;
      product.updatedAt = now;
      await db.put("products", product);

      const movement: StockMovement = {
        id: `sm_${now}_${Math.random().toString(36).substring(2, 6)}`,
        workspaceId: input.workspaceId,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        type: "sale",
        quantityChange: -item.quantity,
        previousQuantity: prevQty,
        newQuantity: newQty,
        unitCost: item.unitCost,
        referenceId: invoiceNumber,
        reason: `POS Sale invoice #${invoiceNumber}`,
        authorUid: input.authorUid,
        createdAt: now,
      };
      await db.put("stock_movements", movement);
    }
  }

  // 5. If credit sale, update customer balance and ledger
  if (balanceDue > 0 && input.customerId) {
    const customer = await db.get("customers", input.customerId);
    if (customer) {
      const newCustBal = customer.currentBalance + balanceDue;
      customer.currentBalance = newCustBal;
      customer.updatedAt = now;
      await db.put("customers", customer);

      const ledgerEntry: CustomerLedgerEntry = {
        id: `cled_${now}_${Math.random().toString(36).substring(2, 6)}`,
        workspaceId: input.workspaceId,
        customerId: customer.id,
        date: now,
        type: "credit_sale",
        debit: balanceDue,
        credit: 0,
        runningBalance: newCustBal,
        referenceId: invoiceNumber,
        description: `Credit sale invoice #${invoiceNumber} (Total: ${grandTotal}, Paid: ${paidAmount})`,
        authorUid: input.authorUid,
        createdAt: now,
      };
      await db.put("customer_ledger", ledgerEntry);
    }
  }

  // 6. Save sale record
  const sale: Sale = {
    id: saleId,
    workspaceId: input.workspaceId,
    invoiceNumber,
    customerId: input.customerId && input.customerId !== "walk-in" ? input.customerId : null,
    customerName: input.customerName || "Walk-in Customer",
    items: resolvedItems,
    subtotal,
    discountTotal,
    taxTotal,
    totalAmount: grandTotal,
    paidAmount,
    balanceDue,
    paymentMethod: input.paymentMethod,
    status: "completed",
    notes: input.notes,
    createdByUid: input.authorUid,
    createdAt: now,
    updatedAt: now,
  };

  await db.put("sales", sale);

  // 7. Enqueue offline sync mutation
  await syncManager.enqueueOperation({
    workspaceId: sale.workspaceId,
    operation: "create",
    entityType: "sale",
    entityId: sale.id,
    payload: sale as unknown as Record<string, unknown>,
  });

  return sale;
}

export async function processSaleReturn(params: {
  workspaceId: string;
  saleId: string;
  items: { productId: string; quantity: number }[];
  reason: string;
  authorUid: string;
}): Promise<SaleReturn> {
  const db = await getLocalDB();
  const sale = await db.get("sales", params.saleId);
  if (!sale || sale.workspaceId !== params.workspaceId) {
    throw new Error("Original sale invoice not found.");
  }

  const now = Date.now();
  let totalRefund = 0;
  const returnItems: { productId: string; productName: string; quantity: number; unitPrice: number; total: number }[] = [];

  for (const retItem of params.items) {
    const saleItem = sale.items.find((i) => i.productId === retItem.productId);
    if (!saleItem) {
      throw new Error(`Product ${retItem.productId} was not part of original invoice.`);
    }

    const previouslyReturned = saleItem.returnedQuantity || 0;
    const maxReturnable = saleItem.quantity - previouslyReturned;

    if (retItem.quantity <= 0 || retItem.quantity > maxReturnable) {
      throw new Error(`Invalid return quantity for "${saleItem.productName}". Max returnable: ${maxReturnable}`);
    }

    const refundLine = retItem.quantity * saleItem.unitPrice;
    totalRefund += refundLine;
    saleItem.returnedQuantity = previouslyReturned + retItem.quantity;

    returnItems.push({
      productId: saleItem.productId,
      productName: saleItem.productName,
      quantity: retItem.quantity,
      unitPrice: saleItem.unitPrice,
      total: refundLine,
    });

    // Restore stock
    const product = await db.get("products", saleItem.productId);
    if (product) {
      const prevQty = product.quantity;
      const newQty = prevQty + retItem.quantity;
      product.quantity = newQty;
      product.updatedAt = now;
      await db.put("products", product);

      const movement: StockMovement = {
        id: `sm_${now}_${Math.random().toString(36).substring(2, 6)}`,
        workspaceId: params.workspaceId,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        type: "sale_return",
        quantityChange: retItem.quantity,
        previousQuantity: prevQty,
        newQuantity: newQty,
        unitCost: saleItem.unitCost,
        referenceId: sale.invoiceNumber,
        reason: `Sales return on invoice #${sale.invoiceNumber}: ${params.reason}`,
        authorUid: params.authorUid,
        createdAt: now,
      };
      await db.put("stock_movements", movement);
    }
  }

  // If customer had an outstanding balance, reduce it
  if (sale.customerId && totalRefund > 0) {
    const customer = await db.get("customers", sale.customerId);
    if (customer) {
      const newCustBal = customer.currentBalance - totalRefund;
      customer.currentBalance = newCustBal;
      customer.updatedAt = now;
      await db.put("customers", customer);

      const ledgerEntry: CustomerLedgerEntry = {
        id: `cled_${now}_${Math.random().toString(36).substring(2, 6)}`,
        workspaceId: params.workspaceId,
        customerId: customer.id,
        date: now,
        type: "sale_return",
        debit: 0,
        credit: totalRefund,
        runningBalance: newCustBal,
        referenceId: sale.invoiceNumber,
        description: `Sales return refund on invoice #${sale.invoiceNumber} (${params.reason})`,
        authorUid: params.authorUid,
        createdAt: now,
      };
      await db.put("customer_ledger", ledgerEntry);
    }
  }

  sale.updatedAt = now;
  // Check if fully returned
  const allItemsReturned = sale.items.every((i) => (i.returnedQuantity || 0) >= i.quantity);
  if (allItemsReturned) {
    sale.status = "refunded";
  }
  await db.put("sales", sale);

  const saleReturn: SaleReturn = {
    id: `ret_${now}_${Math.random().toString(36).substring(2, 6)}`,
    workspaceId: params.workspaceId,
    originalSaleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    customerId: sale.customerId,
    items: returnItems,
    refundAmount: totalRefund,
    reason: params.reason,
    authorUid: params.authorUid,
    createdAt: now,
  };

  await syncManager.enqueueOperation({
    workspaceId: params.workspaceId,
    operation: "create",
    entityType: "sale_return",
    entityId: saleReturn.id,
    payload: saleReturn as unknown as Record<string, unknown>,
  });

  return saleReturn;
}

export async function getSales(
  workspaceId: string,
  options?: { query?: string; startDate?: number; endDate?: number; customerId?: string }
): Promise<Sale[]> {
  const db = await getLocalDB();
  const all = await db.getAllFromIndex("sales", "by_workspace", workspaceId);

  return all
    .filter((s) => {
      if (options?.customerId && s.customerId !== options.customerId) return false;
      if (options?.startDate && s.createdAt < options.startDate) return false;
      if (options?.endDate && s.createdAt > options.endDate) return false;
      if (options?.query && options.query.trim()) {
        const q = options.query.toLowerCase().trim();
        const matchesInvoice = s.invoiceNumber.toLowerCase().includes(q);
        const matchesCustomer = s.customerName.toLowerCase().includes(q);
        return matchesInvoice || matchesCustomer;
      }
      return true;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSaleById(workspaceId: string, saleId: string): Promise<Sale | null> {
  const db = await getLocalDB();
  const s = await db.get("sales", saleId);
  return s && s.workspaceId === workspaceId ? s : null;
}

/**
 * Format clean printable thermal receipt structure for 58mm & 80mm printers.
 */
export function generateThermalReceiptContent(
  sale: Sale,
  workspace: Workspace,
  paperWidth: "58mm" | "80mm" = "80mm"
): {
  html: string;
  text: string;
} {
  const cur = workspace.currencySymbol || "$";
  const dateStr = new Date(sale.createdAt).toLocaleString();
  const widthChars = paperWidth === "58mm" ? 32 : 42;

  let text = "";
  text += `${workspace.name.toUpperCase()}\n`;
  if (workspace.address) text += `${workspace.address}\n`;
  if (workspace.phone) text += `Tel: ${workspace.phone}\n`;
  text += "-".repeat(widthChars) + "\n";
  text += `Invoice: ${sale.invoiceNumber}\n`;
  text += `Date: ${dateStr}\n`;
  text += `Customer: ${sale.customerName}\n`;
  text += "-".repeat(widthChars) + "\n";
  text += "Item           Qty   Price     Total\n";
  text += "-".repeat(widthChars) + "\n";

  for (const item of sale.items) {
    const name = item.productName.substring(0, 14).padEnd(14);
    const qty = String(item.quantity).padStart(3);
    const price = item.unitPrice.toFixed(2).padStart(8);
    const total = item.total.toFixed(2).padStart(9);
    text += `${name} ${qty} ${price} ${total}\n`;
  }

  text += "-".repeat(widthChars) + "\n";
  text += `Subtotal:      ${cur}${sale.subtotal.toFixed(2)}\n`;
  if (sale.discountTotal > 0) text += `Discount:     -${cur}${sale.discountTotal.toFixed(2)}\n`;
  if (sale.taxTotal > 0) text += `Tax:           ${cur}${sale.taxTotal.toFixed(2)}\n`;
  text += `TOTAL:         ${cur}${sale.totalAmount.toFixed(2)}\n`;
  text += `Paid (${sale.paymentMethod}): ${cur}${sale.paidAmount.toFixed(2)}\n`;
  if (sale.balanceDue > 0) {
    text += `Balance Due:   ${cur}${sale.balanceDue.toFixed(2)}\n`;
  }
  text += "-".repeat(widthChars) + "\n";
  text += `${workspace.settings?.receiptFooterMessage || "Thank you for your business!"}\n`;

  const html = `
    <div style="font-family: monospace; width: ${paperWidth}; font-size: 12px; margin: 0 auto; line-height: 1.4; color: #000; padding: 10px;">
      <div style="text-align: center; font-weight: bold; font-size: 14px;">${workspace.name}</div>
      ${workspace.address ? `<div style="text-align: center; font-size: 11px;">${workspace.address}</div>` : ""}
      ${workspace.phone ? `<div style="text-align: center; font-size: 11px;">Tel: ${workspace.phone}</div>` : ""}
      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
      <div style="font-size: 11px;"><strong>Inv:</strong> ${sale.invoiceNumber}</div>
      <div style="font-size: 11px;"><strong>Date:</strong> ${dateStr}</div>
      <div style="font-size: 11px;"><strong>Customer:</strong> ${sale.customerName}</div>
      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
      <table style="width: 100%; font-size: 11px; text-align: left; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th>Item</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Price</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${sale.items
            .map(
              (i) => `
            <tr>
              <td>${i.productName}</td>
              <td style="text-align: center;">${i.quantity}</td>
              <td style="text-align: right;">${cur}${i.unitPrice.toFixed(2)}</td>
              <td style="text-align: right;">${cur}${i.total.toFixed(2)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
      <div style="display: flex; justify-content: space-between; font-size: 11px;"><span>Subtotal:</span><span>${cur}${sale.subtotal.toFixed(2)}</span></div>
      ${sale.discountTotal > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 11px;"><span>Discount:</span><span>-${cur}${sale.discountTotal.toFixed(2)}</span></div>` : ""}
      ${sale.taxTotal > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 11px;"><span>Tax:</span><span>+${cur}${sale.taxTotal.toFixed(2)}</span></div>` : ""}
      <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-top: 4px;"><span>GRAND TOTAL:</span><span>${cur}${sale.totalAmount.toFixed(2)}</span></div>
      <div style="display: flex; justify-content: space-between; font-size: 11px;"><span>Paid (${sale.paymentMethod}):</span><span>${cur}${sale.paidAmount.toFixed(2)}</span></div>
      ${sale.balanceDue > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 11px; color: #b91c1c; font-weight: bold;"><span>Balance Due:</span><span>${cur}${sale.balanceDue.toFixed(2)}</span></div>` : ""}
      <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
      <div style="text-align: center; font-size: 11px; font-style: italic;">${workspace.settings?.receiptFooterMessage || "Thank you for shopping with us!"}</div>
    </div>
  `;

  return { text, html };
}
