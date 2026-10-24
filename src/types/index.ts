/**
 * Multi-tenant SaaS Domain Types & Interfaces
 * For ShopLedger: Shop & Wholesale Management SaaS
 */

export type UserRole = "owner" | "admin" | "manager" | "cashier";

export type BusinessCategoryKey =
  | "mobile_shop"
  | "mobile_repair_shop"
  | "mobile_parts_shop"
  | "electronics_shop"
  | "computer_shop"
  | "clothing_and_garments"
  | "general_store"
  | "cosmetics_shop"
  | "hardware_shop"
  | "wholesale_business"
  | "other_business";

export interface BusinessCategory {
  key: BusinessCategoryKey;
  label: string;
  description: string;
  icon?: string;
  suggestedTaxRate?: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  currentWorkspaceId?: string | null;
  isSuperAdmin?: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  blockedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceSettings {
  taxRatePercent: number;
  taxRegistrationNumber?: string;
  invoicePrefix: string;
  receiptFooterMessage: string;
  enableLowStockAlerts: boolean;
  lowStockThreshold: number;
  allowNegativeInventory: boolean;
  dateFormat: string;
}

export interface Workspace {
  id: string;
  name: string;
  category: BusinessCategoryKey;
  categoryLabel: string;
  country: string;
  currency: string;
  currencySymbol: string;
  phone?: string;
  address?: string;
  ownerUid: string;
  status: "active" | "suspended" | "archived";
  settings: WorkspaceSettings;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceMembership {
  id: string;
  workspaceId: string;
  userId: string;
  userEmail: string | null;
  userDisplayName?: string | null;
  role: UserRole;
  status: "active" | "invited" | "suspended";
  permissions: string[];
  createdAt: number;
  updatedAt: number;
}

export type SubscriptionPlanId = "free" | "growth_2m" | "pro_6m" | "enterprise_12m";

export type SubscriptionStatus =
  | "active"
  | "trial"
  | "past_due"
  | "cancelled"
  | "expired";

export interface SubscriptionFeatures {
  offlineMode: boolean;
  multiDeviceSync: boolean;
  customerLedger: boolean;
  wholesalePricing: boolean;
  advancedReports: boolean;
  inventoryTracking: boolean;
  pdfExport: boolean;
  customBranding: boolean;
  prioritySupport: boolean;
}

export interface SubscriptionLimits {
  maxProducts: number;
  maxMonthlyInvoices: number;
  maxCustomers: number;
  maxStaffAccounts: number;
}

export interface PricingPlan {
  id: SubscriptionPlanId;
  name: string;
  priceUSD: number;
  durationMonths: number;
  displayPrice: string;
  billingDescription: string;
  isPopular?: boolean;
  features: SubscriptionFeatures;
  limits: SubscriptionLimits;
}

export interface WorkspaceSubscription {
  id: string;
  workspaceId: string;
  planId: SubscriptionPlanId;
  planName: string;
  status: SubscriptionStatus;
  priceUSD: number;
  durationMonths: number;
  startDate: number;
  expiryDate: number;
  features: SubscriptionFeatures;
  limits: SubscriptionLimits;
  autoRenew: boolean;
  updatedAt: number;
}

// =============================================================================
// CRYPTO PAYMENTS & ADMIN PLATFORM TYPES (Prompt 3)
// =============================================================================

export type CryptoNetwork = "TRC20" | "BEP20";

export type PaymentProofStatus = "pending" | "approved" | "rejected";

export interface PaymentProof {
  id: string;
  workspaceId: string;
  workspaceName: string;
  userUid: string;
  userEmail: string | null;
  userDisplayName?: string | null;
  planId: SubscriptionPlanId;
  planName: string;
  amountUSD: number;
  network: CryptoNetwork;
  txHash: string;
  depositAddress: string;
  status: PaymentProofStatus;
  userNotes?: string;
  submittedAt: number;
  reviewedAt?: number;
  reviewedByUid?: string;
  reviewedByEmail?: string;
  adminNotes?: string;
  rejectionReason?: string;
}

export interface PaymentHistoryRecord {
  id: string;
  workspaceId: string;
  paymentProofId?: string;
  planId: SubscriptionPlanId;
  planName: string;
  amountUSD: number;
  network?: CryptoNetwork;
  txHash?: string;
  periodStart: number;
  periodEnd: number;
  durationMonths: number;
  status: "completed" | "refunded";
  recordedAt: number;
  approvedByUid: string;
}

export interface AppPlatformSettings {
  id: string;
  platformName: string;
  supportEmail: string;
  whatsappNumber: string;
  whatsappDefaultMessage: string;
  announcementMessage?: string;
  announcementActive?: boolean;
  trc20WalletAddress: string;
  bep20WalletAddress: string;
  usdtInstructionsNotes?: string;
  adminEmails: string[];
  updatedAt: number;
  updatedByUid?: string;
}

export interface PlatformConfiguredPlan extends PricingPlan {
  isActive: boolean;
}

export interface PlatformConfiguredCategory extends BusinessCategory {
  isEnabled: boolean;
}

// =============================================================================
// PRODUCTS & INVENTORY TYPES (Prompt 2)
// =============================================================================

export type ProductUnit =
  | "pcs"
  | "box"
  | "packet"
  | "kg"
  | "g"
  | "litre"
  | "ml"
  | "meter"
  | "dozen"
  | "carton"
  | "pair"
  | "unit";

export interface MobileAttributes {
  brand?: string;
  model?: string;
  imei?: string;
  storage?: string;
  color?: string;
  warranty?: string;
  condition?: "new" | "used" | "refurbished";
}

export interface RepairAttributes {
  deviceModel?: string;
  repairPartType?: string;
  serviceCharge?: number;
  repairStatus?: "pending" | "in_progress" | "completed" | "delivered";
}

export interface ClothingAttributes {
  size?: string;
  color?: string;
  style?: string;
  fabric?: string;
}

export interface GroceryAttributes {
  batchNumber?: string;
  expiryDate?: number;
  weightVolume?: string;
}

export interface ElectronicsAttributes {
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  warrantyMonths?: number;
}

export interface WholesaleAttributes {
  minOrderQty?: number;
  wholesalePrice?: number;
  cartonQuantity?: number;
}

export interface Product {
  id: string;
  workspaceId: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  brand?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  minStockAlert: number;
  unit: ProductUnit;
  description?: string;
  imageUrl?: string;
  isArchived: boolean;
  // Category-specific optional metadata
  mobileAttributes?: MobileAttributes;
  repairAttributes?: RepairAttributes;
  clothingAttributes?: ClothingAttributes;
  groceryAttributes?: GroceryAttributes;
  electronicsAttributes?: ElectronicsAttributes;
  wholesaleAttributes?: WholesaleAttributes;
  createdAt: number;
  updatedAt: number;
}

export type StockMovementType =
  | "purchase"
  | "sale"
  | "sale_return"
  | "purchase_return"
  | "adjustment"
  | "damage"
  | "opening";

export interface StockMovement {
  id: string;
  workspaceId: string;
  productId: string;
  productName: string;
  sku: string;
  type: StockMovementType;
  quantityChange: number; // positive or negative
  previousQuantity: number;
  newQuantity: number;
  unitCost: number;
  referenceId?: string; // invoiceId, purchaseId, etc.
  reason: string;
  authorUid: string;
  createdAt: number;
}

// =============================================================================
// CUSTOMERS & SUPPLIERS TYPES (Prompt 2)
// =============================================================================

export interface Customer {
  id: string;
  workspaceId: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  openingBalance: number; // positive means customer owes business
  currentBalance: number; // positive: owed to business (receivable)
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Supplier {
  id: string;
  workspaceId: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  notes?: string;
  openingBalance: number; // positive means business owes supplier (payable)
  currentPayableBalance: number; // positive: payable balance
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// SALES & POS TYPES (Prompt 2)
// =============================================================================

export type PaymentMethod =
  | "cash"
  | "card"
  | "credit_udhar"
  | "bank_transfer"
  | "split";

export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  barcode?: string;
  quantity: number;
  unit: ProductUnit;
  unitCost: number;
  unitPrice: number;
  discount: number; // per item discount amount
  total: number; // (unitPrice - discount) * quantity
  returnedQuantity?: number;
}

export interface Sale {
  id: string;
  workspaceId: string;
  invoiceNumber: string;
  customerId: string | null; // null for walk-in cash customer
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number; // totalAmount - paidAmount (if > 0, recorded in customer ledger)
  paymentMethod: PaymentMethod;
  paymentDetails?: string;
  status: "completed" | "cancelled" | "refunded";
  notes?: string;
  createdByUid: string;
  offlineOpId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SaleReturn {
  id: string;
  workspaceId: string;
  originalSaleId: string;
  invoiceNumber: string;
  customerId: string | null;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  refundAmount: number;
  reason: string;
  authorUid: string;
  createdAt: number;
}

// =============================================================================
// PURCHASES & STOCK INWARD TYPES (Prompt 2)
// =============================================================================

export interface PurchaseItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  total: number;
  returnedQuantity?: number;
}

export interface Purchase {
  id: string;
  workspaceId: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number; // totalAmount - paidAmount (payable balance)
  paymentMethod: PaymentMethod;
  status: "received" | "returned";
  notes?: string;
  createdByUid: string;
  offlineOpId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PurchaseReturn {
  id: string;
  workspaceId: string;
  originalPurchaseId: string;
  purchaseNumber: string;
  supplierId: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    total: number;
  }[];
  refundAmount: number;
  reason: string;
  authorUid: string;
  createdAt: number;
}

// =============================================================================
// CUSTOMER & SUPPLIER KHATA / LEDGER TYPES (Prompt 2)
// =============================================================================

export type CustomerLedgerType =
  | "credit_sale"
  | "payment_received"
  | "sale_return"
  | "opening_balance"
  | "adjustment";

export interface CustomerLedgerEntry {
  id: string;
  workspaceId: string;
  customerId: string;
  date: number;
  type: CustomerLedgerType;
  debit: number; // increases customer debt (e.g. credit sale)
  credit: number; // decreases customer debt (e.g. cash payment, return)
  runningBalance: number;
  referenceId?: string; // invoiceNumber, receiptNumber
  description: string;
  authorUid: string;
  createdAt: number;
}

export type SupplierLedgerType =
  | "purchase_credit"
  | "payment_made"
  | "purchase_return"
  | "opening_balance"
  | "adjustment";

export interface SupplierLedgerEntry {
  id: string;
  workspaceId: string;
  supplierId: string;
  date: number;
  type: SupplierLedgerType;
  debit: number; // decreases debt owed to supplier (payment made, return)
  credit: number; // increases debt owed to supplier (purchase credit)
  runningBalance: number;
  referenceId?: string; // purchaseNumber
  description: string;
  authorUid: string;
  createdAt: number;
}

// =============================================================================
// BUSINESS EXPENSES TYPES (Prompt 2)
// =============================================================================

export type ExpenseCategory =
  | "rent"
  | "utilities"
  | "salaries"
  | "transport"
  | "supplies"
  | "repairs"
  | "marketing"
  | "custom";

export interface Expense {
  id: string;
  workspaceId: string;
  category: ExpenseCategory;
  categoryLabel: string;
  amount: number;
  date: number;
  paymentMethod: "cash" | "card" | "bank_transfer";
  description: string;
  receiptNumber?: string;
  authorUid: string;
  createdAt: number;
}

// =============================================================================
// OFFLINE SYNC QUEUE & AUDIT TYPES
// =============================================================================

export type SyncOperationType = "create" | "update" | "delete";

export type SyncStatus =
  | "saved_locally"
  | "waiting_to_sync"
  | "syncing"
  | "synced"
  | "failed"
  | "conflict";

export type SyncEntityType =
  | "product"
  | "customer"
  | "supplier"
  | "sale"
  | "sale_return"
  | "purchase"
  | "purchase_return"
  | "customer_payment"
  | "supplier_payment"
  | "stock_movement"
  | "expense"
  | "payment_proof"
  | "platform_settings"
  | "audit_note"
  | "setting";

export interface SyncQueueItem {
  id: string; // Unique idempotency UUID
  workspaceId: string;
  operation: SyncOperationType;
  entityType: SyncEntityType;
  entityId: string;
  payload: Record<string, unknown>;
  status: SyncStatus;
  retryCount: number;
  lastAttempt?: number;
  error?: string;
  conflictDetails?: string;
  createdAt: number;
  syncedAt?: number;
}

export interface OperationJournalRecord {
  id: string; // operation UUID
  workspaceId: string;
  entityType: SyncEntityType;
  entityId: string;
  appliedAt: number;
  appliedByUid: string;
}

export interface LocalAuditNote {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  authorUid: string;
  authorEmail: string;
  createdAt: number;
  synced: boolean;
}
