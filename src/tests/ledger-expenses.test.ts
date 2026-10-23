import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { resetDBConnection } from "@/lib/offline/db";
import {
  createCustomer,
  recordCustomerPayment,
  getCustomerStatement,
  getCustomerById,
  createSupplier,
  recordSupplierPayment,
  getSupplierById,
} from "@/lib/services/customerSupplierService";
import {
  createExpense,
  getExpenses,
  deleteExpense,
  getCustomerLedger,
  getSupplierLedger,
  EXPENSE_CATEGORIES,
} from "@/lib/services/ledgerExpenseService";

describe("Ledger Khata & Expenses Accounting", () => {
  const wsId = "ws_ledger_expense_test";
  const authorUid = "accountant_user_1";

  beforeEach(() => {
    resetDBConnection();
  });

  describe("Customer Khata & Statements", () => {
    it("should reconcile customer opening balance, payments received, and produce statement", async () => {
      // 1. Create customer with $500 opening balance
      const customer = await createCustomer(
        {
          workspaceId: wsId,
          name: "Haji Abdul Rehman",
          phone: "03001234567",
          openingBalance: 500,
        },
        authorUid
      );

      expect(customer.currentBalance).toBe(500);

      // 2. Customer makes a partial cash payment of $200
      const { customer: updatedCustomer, ledgerEntry } = await recordCustomerPayment({
        workspaceId: wsId,
        customerId: customer.id,
        amount: 200,
        paymentMethod: "cash",
        notes: "Received partial payment at shop counter",
        authorUid,
      });

      expect(updatedCustomer.currentBalance).toBe(300);
      expect(ledgerEntry.credit).toBe(200);
      expect(ledgerEntry.runningBalance).toBe(300);

      // 3. Customer pays remaining $300 via bank transfer
      await recordCustomerPayment({
        workspaceId: wsId,
        customerId: customer.id,
        amount: 300,
        paymentMethod: "bank_transfer",
        referenceId: "TXN-998877",
        notes: "Meezan Bank transfer",
        authorUid,
      });

      const finalizedCustomer = await getCustomerById(wsId, customer.id);
      expect(finalizedCustomer?.currentBalance).toBe(0);

      // 4. Generate Customer Statement
      const statement = await getCustomerStatement(wsId, customer.id);
      expect(statement.customer.id).toBe(customer.id);
      expect(statement.entries.length).toBe(3); // opening_balance + 2 payments
      expect(statement.totalDebit).toBe(500); // opening balance debit
      expect(statement.totalCredit).toBe(500); // 200 + 300
      expect(statement.closingBalance).toBe(0);
    });

    it("should prevent recording invalid or zero payment amounts", async () => {
      const customer = await createCustomer(
        { workspaceId: wsId, name: "Ali Raza" },
        authorUid
      );

      await expect(
        recordCustomerPayment({
          workspaceId: wsId,
          customerId: customer.id,
          amount: 0,
          paymentMethod: "cash",
          authorUid,
        })
      ).rejects.toThrow(/Payment amount must be greater than zero/);

      await expect(
        recordCustomerPayment({
          workspaceId: wsId,
          customerId: customer.id,
          amount: -50,
          paymentMethod: "cash",
          authorUid,
        })
      ).rejects.toThrow(/Payment amount must be greater than zero/);
    });
  });

  describe("Supplier Khata & Payable Reconciliation", () => {
    it("should record supplier payment and update payable balance", async () => {
      const supplier = await createSupplier(
        {
          workspaceId: wsId,
          name: "Orient Electronics Distributor",
          openingBalance: 1200,
        },
        authorUid
      );

      expect(supplier.currentPayableBalance).toBe(1200);

      // Pay $700 to supplier via bank transfer
      const { supplier: updatedSupp, ledgerEntry } = await recordSupplierPayment({
        workspaceId: wsId,
        supplierId: supplier.id,
        amount: 700,
        paymentMethod: "bank_transfer",
        referenceId: "CHQ-445521",
        notes: "Cheque clearance for inv #504",
        authorUid,
      });

      expect(updatedSupp.currentPayableBalance).toBe(500);
      expect(ledgerEntry.debit).toBe(700);
      expect(ledgerEntry.runningBalance).toBe(500);

      // Verify supplier ledger queries
      const ledger = await getSupplierLedger(wsId, supplier.id);
      expect(ledger.length).toBe(2); // opening_balance + payment_made
    });
  });

  describe("Expenses Management", () => {
    it("should create expenses across categories, support filtering, and delete expenses", async () => {
      expect(EXPENSE_CATEGORIES.length).toBeGreaterThanOrEqual(7);

      // 1. Log Rent expense
      const rentExp = await createExpense(
        {
          workspaceId: wsId,
          category: "rent",
          amount: 600,
          paymentMethod: "bank_transfer",
          description: "Shop monthly rent for October 2026",
          receiptNumber: "RENT-OCT-26",
        },
        authorUid
      );

      // 2. Log Utilities expense
      const utilExp = await createExpense(
        {
          workspaceId: wsId,
          category: "utilities",
          amount: 150,
          paymentMethod: "cash",
          description: "WAPDA Electricity bill",
          receiptNumber: "BILL-98213",
        },
        authorUid
      );

      // 3. Log Staff salary expense
      await createExpense(
        {
          workspaceId: wsId,
          category: "salaries",
          amount: 800,
          paymentMethod: "cash",
          description: "Cash wages for shop assistant",
        },
        authorUid
      );

      // Query all expenses
      const allExpenses = await getExpenses(wsId);
      expect(allExpenses.length).toBe(3);

      // Query by category filter
      const rentOnly = await getExpenses(wsId, { category: "rent" });
      expect(rentOnly.length).toBe(1);
      expect(rentOnly[0].id).toBe(rentExp.id);

      // Query by search keyword
      const searchRes = await getExpenses(wsId, { query: "Electricity" });
      expect(searchRes.length).toBe(1);
      expect(searchRes[0].id).toBe(utilExp.id);

      // Delete an expense
      await deleteExpense(wsId, utilExp.id);
      const afterDelete = await getExpenses(wsId);
      expect(afterDelete.length).toBe(2);
      expect(afterDelete.some((e) => e.id === utilExp.id)).toBe(false);
    });

    it("should reject negative or zero expense amount", async () => {
      await expect(
        createExpense(
          {
            workspaceId: wsId,
            category: "marketing",
            amount: -10,
            paymentMethod: "cash",
            description: "Invalid expense",
          },
          authorUid
        )
      ).rejects.toThrow(/Expense amount must be a positive number/);
    });
  });
});
