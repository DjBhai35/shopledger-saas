import { getLocalDB } from "@/lib/offline/db";
import {
  Customer,
  Supplier,
  CustomerLedgerEntry,
  SupplierLedgerEntry,
  PaymentMethod,
} from "@/types";
import { syncManager } from "@/lib/offline/sync-manager";

// =============================================================================
// CUSTOMERS SERVICE
// =============================================================================

export async function createCustomer(
  data: {
    workspaceId: string;
    name: string;
    phone?: string;
    address?: string;
    notes?: string;
    openingBalance?: number;
  },
  authorUid: string
): Promise<Customer> {
  if (!data.name || !data.name.trim()) {
    throw new Error("Customer name is required.");
  }

  const db = await getLocalDB();
  const now = Date.now();
  const id = `cust_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const openingBal = Number(data.openingBalance || 0);

  const customer: Customer = {
    id,
    workspaceId: data.workspaceId,
    name: data.name.trim(),
    phone: data.phone?.trim() || undefined,
    address: data.address?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    openingBalance: openingBal,
    currentBalance: openingBal,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.put("customers", customer);

  // If opening balance > 0, record in customer ledger
  if (openingBal !== 0) {
    const ledgerEntry: CustomerLedgerEntry = {
      id: `cled_${now}_init`,
      workspaceId: data.workspaceId,
      customerId: id,
      date: now,
      type: "opening_balance",
      debit: openingBal > 0 ? openingBal : 0,
      credit: openingBal < 0 ? Math.abs(openingBal) : 0,
      runningBalance: openingBal,
      description: "Initial opening balance",
      authorUid,
      createdAt: now,
    };
    await db.put("customer_ledger", ledgerEntry);
  }

  await syncManager.enqueueOperation({
    workspaceId: customer.workspaceId,
    operation: "create",
    entityType: "customer",
    entityId: customer.id,
    payload: customer as unknown as Record<string, unknown>,
  });

  return customer;
}

export async function getCustomers(
  workspaceId: string,
  query?: string,
  includeArchived = false
): Promise<Customer[]> {
  const db = await getLocalDB();
  const all = await db.getAllFromIndex("customers", "by_workspace", workspaceId);

  return all
    .filter((c) => {
      if (!includeArchived && c.isArchived) return false;
      if (query && query.trim()) {
        const q = query.toLowerCase().trim();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone?.toLowerCase().includes(q) ?? false;
        return matchesName || matchesPhone;
      }
      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getCustomerById(
  workspaceId: string,
  customerId: string
): Promise<Customer | null> {
  const db = await getLocalDB();
  const c = await db.get("customers", customerId);
  return c && c.workspaceId === workspaceId ? c : null;
}

export async function updateCustomer(
  customerId: string,
  updates: Partial<Customer>
): Promise<Customer> {
  const db = await getLocalDB();
  const customer = await db.get("customers", customerId);
  if (!customer) throw new Error("Customer not found.");

  const updated: Customer = {
    ...customer,
    ...updates,
    id: customerId,
    workspaceId: customer.workspaceId,
    updatedAt: Date.now(),
  };

  await db.put("customers", updated);

  await syncManager.enqueueOperation({
    workspaceId: updated.workspaceId,
    operation: "update",
    entityType: "customer",
    entityId: updated.id,
    payload: updated as unknown as Record<string, unknown>,
  });

  return updated;
}

export async function recordCustomerPayment(params: {
  workspaceId: string;
  customerId: string;
  amount: number;
  date?: number;
  paymentMethod: PaymentMethod;
  referenceId?: string;
  notes?: string;
  authorUid: string;
}): Promise<{ customer: Customer; ledgerEntry: CustomerLedgerEntry }> {
  if (params.amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const db = await getLocalDB();
  const customer = await db.get("customers", params.customerId);
  if (!customer || customer.workspaceId !== params.workspaceId) {
    throw new Error("Customer not found.");
  }

  const now = Date.now();
  const entryDate = params.date || now;
  const newBalance = customer.currentBalance - params.amount;

  customer.currentBalance = newBalance;
  customer.updatedAt = now;
  await db.put("customers", customer);

  const entryId = `cled_${now}_${Math.random().toString(36).substring(2, 6)}`;
  const ledgerEntry: CustomerLedgerEntry = {
    id: entryId,
    workspaceId: params.workspaceId,
    customerId: params.customerId,
    date: entryDate,
    type: "payment_received",
    debit: 0,
    credit: params.amount,
    runningBalance: newBalance,
    referenceId: params.referenceId,
    description: params.notes || `Payment received via ${params.paymentMethod}`,
    authorUid: params.authorUid,
    createdAt: now,
  };

  await db.put("customer_ledger", ledgerEntry);

  await syncManager.enqueueOperation({
    workspaceId: params.workspaceId,
    operation: "create",
    entityType: "customer_payment",
    entityId: entryId,
    payload: {
      customerId: params.customerId,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      newBalance,
      referenceId: params.referenceId,
      date: entryDate,
    },
  });

  return { customer, ledgerEntry };
}

export async function getCustomerStatement(
  workspaceId: string,
  customerId: string,
  startDate?: number,
  endDate?: number
): Promise<{
  customer: Customer;
  entries: CustomerLedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}> {
  const customer = await getCustomerById(workspaceId, customerId);
  if (!customer) throw new Error("Customer not found.");

  const db = await getLocalDB();
  const allEntries = await db.getAllFromIndex("customer_ledger", "by_customer", customerId);

  const filtered = allEntries
    .filter((e) => {
      if (e.workspaceId !== workspaceId) return false;
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    })
    .sort((a, b) => a.date - b.date);

  let totalDebit = 0;
  let totalCredit = 0;
  for (const entry of filtered) {
    totalDebit += entry.debit;
    totalCredit += entry.credit;
  }

  return {
    customer,
    entries: filtered,
    totalDebit,
    totalCredit,
    closingBalance: customer.currentBalance,
  };
}

// =============================================================================
// SUPPLIERS SERVICE
// =============================================================================

export async function createSupplier(
  data: {
    workspaceId: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    address?: string;
    notes?: string;
    openingBalance?: number;
  },
  authorUid: string
): Promise<Supplier> {
  if (!data.name || !data.name.trim()) {
    throw new Error("Supplier name is required.");
  }

  const db = await getLocalDB();
  const now = Date.now();
  const id = `supp_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const openingBal = Number(data.openingBalance || 0);

  const supplier: Supplier = {
    id,
    workspaceId: data.workspaceId,
    name: data.name.trim(),
    contactPerson: data.contactPerson?.trim() || undefined,
    phone: data.phone?.trim() || undefined,
    address: data.address?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    openingBalance: openingBal,
    currentPayableBalance: openingBal,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.put("suppliers", supplier);

  if (openingBal !== 0) {
    const ledgerEntry: SupplierLedgerEntry = {
      id: `sled_${now}_init`,
      workspaceId: data.workspaceId,
      supplierId: id,
      date: now,
      type: "opening_balance",
      debit: openingBal < 0 ? Math.abs(openingBal) : 0,
      credit: openingBal > 0 ? openingBal : 0,
      runningBalance: openingBal,
      description: "Initial opening balance",
      authorUid,
      createdAt: now,
    };
    await db.put("supplier_ledger", ledgerEntry);
  }

  await syncManager.enqueueOperation({
    workspaceId: supplier.workspaceId,
    operation: "create",
    entityType: "supplier",
    entityId: supplier.id,
    payload: supplier as unknown as Record<string, unknown>,
  });

  return supplier;
}

export async function getSuppliers(
  workspaceId: string,
  query?: string,
  includeArchived = false
): Promise<Supplier[]> {
  const db = await getLocalDB();
  const all = await db.getAllFromIndex("suppliers", "by_workspace", workspaceId);

  return all
    .filter((s) => {
      if (!includeArchived && s.isArchived) return false;
      if (query && query.trim()) {
        const q = query.toLowerCase().trim();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesContact = s.contactPerson?.toLowerCase().includes(q) ?? false;
        const matchesPhone = s.phone?.toLowerCase().includes(q) ?? false;
        return matchesName || matchesContact || matchesPhone;
      }
      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSupplierById(
  workspaceId: string,
  supplierId: string
): Promise<Supplier | null> {
  const db = await getLocalDB();
  const s = await db.get("suppliers", supplierId);
  return s && s.workspaceId === workspaceId ? s : null;
}

export async function updateSupplier(
  supplierId: string,
  updates: Partial<Supplier>
): Promise<Supplier> {
  const db = await getLocalDB();
  const supplier = await db.get("suppliers", supplierId);
  if (!supplier) throw new Error("Supplier not found.");

  const updated: Supplier = {
    ...supplier,
    ...updates,
    id: supplierId,
    workspaceId: supplier.workspaceId,
    updatedAt: Date.now(),
  };

  await db.put("suppliers", updated);

  await syncManager.enqueueOperation({
    workspaceId: updated.workspaceId,
    operation: "update",
    entityType: "supplier",
    entityId: updated.id,
    payload: updated as unknown as Record<string, unknown>,
  });

  return updated;
}

export async function recordSupplierPayment(params: {
  workspaceId: string;
  supplierId: string;
  amount: number;
  date?: number;
  paymentMethod: PaymentMethod;
  referenceId?: string;
  notes?: string;
  authorUid: string;
}): Promise<{ supplier: Supplier; ledgerEntry: SupplierLedgerEntry }> {
  if (params.amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const db = await getLocalDB();
  const supplier = await db.get("suppliers", params.supplierId);
  if (!supplier || supplier.workspaceId !== params.workspaceId) {
    throw new Error("Supplier not found.");
  }

  const now = Date.now();
  const entryDate = params.date || now;
  const newBalance = supplier.currentPayableBalance - params.amount;

  supplier.currentPayableBalance = newBalance;
  supplier.updatedAt = now;
  await db.put("suppliers", supplier);

  const entryId = `sled_${now}_${Math.random().toString(36).substring(2, 6)}`;
  const ledgerEntry: SupplierLedgerEntry = {
    id: entryId,
    workspaceId: params.workspaceId,
    supplierId: params.supplierId,
    date: entryDate,
    type: "payment_made",
    debit: params.amount,
    credit: 0,
    runningBalance: newBalance,
    referenceId: params.referenceId,
    description: params.notes || `Payment made via ${params.paymentMethod}`,
    authorUid: params.authorUid,
    createdAt: now,
  };

  await db.put("supplier_ledger", ledgerEntry);

  await syncManager.enqueueOperation({
    workspaceId: params.workspaceId,
    operation: "create",
    entityType: "supplier_payment",
    entityId: entryId,
    payload: {
      supplierId: params.supplierId,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      newBalance,
      referenceId: params.referenceId,
      date: entryDate,
    },
  });

  return { supplier, ledgerEntry };
}
