import { getLocalDB } from "@/lib/offline/db";
import {
  CustomerLedgerEntry,
  SupplierLedgerEntry,
  Expense,
  ExpenseCategory,
} from "@/types";
import { syncManager } from "@/lib/offline/sync-manager";

export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: "rent", label: "Shop Rent" },
  { key: "utilities", label: "Electricity & Utilities" },
  { key: "salaries", label: "Staff Wages & Salaries" },
  { key: "transport", label: "Freight & Transport" },
  { key: "supplies", label: "Packaging & Bags" },
  { key: "repairs", label: "Shop Maintenance & Repairs" },
  { key: "marketing", label: "Advertising & Promo" },
  { key: "custom", label: "General & Miscellaneous" },
];

export function getExpenseCategoryLabel(cat: ExpenseCategory): string {
  const found = EXPENSE_CATEGORIES.find((c) => c.key === cat);
  return found ? found.label : "General Expense";
}

// =============================================================================
// CUSTOMER & SUPPLIER LEDGER QUERIES
// =============================================================================

export async function getCustomerLedger(
  workspaceId: string,
  customerId?: string,
  startDate?: number,
  endDate?: number
): Promise<CustomerLedgerEntry[]> {
  const db = await getLocalDB();
  let entries: CustomerLedgerEntry[] = [];

  if (customerId) {
    entries = await db.getAllFromIndex("customer_ledger", "by_customer", customerId);
  } else {
    entries = await db.getAllFromIndex("customer_ledger", "by_workspace", workspaceId);
  }

  return entries
    .filter((e) => {
      if (e.workspaceId !== workspaceId) return false;
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    })
    .sort((a, b) => a.date - b.date);
}

export async function getSupplierLedger(
  workspaceId: string,
  supplierId?: string,
  startDate?: number,
  endDate?: number
): Promise<SupplierLedgerEntry[]> {
  const db = await getLocalDB();
  let entries: SupplierLedgerEntry[] = [];

  if (supplierId) {
    entries = await db.getAllFromIndex("supplier_ledger", "by_supplier", supplierId);
  } else {
    entries = await db.getAllFromIndex("supplier_ledger", "by_workspace", workspaceId);
  }

  return entries
    .filter((e) => {
      if (e.workspaceId !== workspaceId) return false;
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    })
    .sort((a, b) => a.date - b.date);
}

// =============================================================================
// EXPENSES SERVICE
// =============================================================================

export async function createExpense(
  data: {
    workspaceId: string;
    category: ExpenseCategory;
    amount: number;
    date?: number;
    paymentMethod: "cash" | "card" | "bank_transfer";
    description: string;
    receiptNumber?: string;
  },
  authorUid: string
): Promise<Expense> {
  const amt = Number(data.amount);
  if (isNaN(amt) || amt <= 0) {
    throw new Error("Expense amount must be a positive number.");
  }
  if (!data.description || !data.description.trim()) {
    throw new Error("Expense description is required.");
  }

  const db = await getLocalDB();
  const now = Date.now();
  const id = `exp_${now}_${Math.random().toString(36).substring(2, 7)}`;

  const expense: Expense = {
    id,
    workspaceId: data.workspaceId,
    category: data.category,
    categoryLabel: getExpenseCategoryLabel(data.category),
    amount: amt,
    date: data.date || now,
    paymentMethod: data.paymentMethod,
    description: data.description.trim(),
    receiptNumber: data.receiptNumber?.trim() || undefined,
    authorUid,
    createdAt: now,
  };

  await db.put("expenses", expense);

  await syncManager.enqueueOperation({
    workspaceId: expense.workspaceId,
    operation: "create",
    entityType: "expense",
    entityId: expense.id,
    payload: expense as unknown as Record<string, unknown>,
  });

  return expense;
}

export async function getExpenses(
  workspaceId: string,
  options?: { category?: string; startDate?: number; endDate?: number; query?: string }
): Promise<Expense[]> {
  const db = await getLocalDB();
  const all = await db.getAllFromIndex("expenses", "by_workspace", workspaceId);

  return all
    .filter((e) => {
      if (options?.category && options.category !== "all" && e.category !== options.category) {
        return false;
      }
      if (options?.startDate && e.date < options.startDate) return false;
      if (options?.endDate && e.date > options.endDate) return false;
      if (options?.query && options.query.trim()) {
        const q = options.query.toLowerCase().trim();
        return (
          e.description.toLowerCase().includes(q) ||
          e.categoryLabel.toLowerCase().includes(q) ||
          (e.receiptNumber?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    })
    .sort((a, b) => b.date - a.date);
}

export async function deleteExpense(
  workspaceId: string,
  expenseId: string
): Promise<void> {
  const db = await getLocalDB();
  const expense = await db.get("expenses", expenseId);
  if (!expense || expense.workspaceId !== workspaceId) {
    throw new Error("Expense not found.");
  }

  await db.delete("expenses", expenseId);

  await syncManager.enqueueOperation({
    workspaceId,
    operation: "delete",
    entityType: "expense",
    entityId: expenseId,
    payload: { id: expenseId },
  });
}
