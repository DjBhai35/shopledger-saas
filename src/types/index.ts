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
  maxProducts: number; // e.g. 50 for free, 1000 for growth, unlimited for enterprise
  maxMonthlyInvoices: number; // e.g. 100 for free
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
  expiryDate: number; // 0 or far-future for free
  features: SubscriptionFeatures;
  limits: SubscriptionLimits;
  autoRenew: boolean;
  updatedAt: number;
}

/**
 * Offline Sync Queue Types
 */
export type SyncOperationType = "create" | "update" | "delete";

export type SyncStatus =
  | "saved_locally"
  | "waiting_to_sync"
  | "syncing"
  | "synced"
  | "failed"
  | "conflict";

export interface SyncQueueItem {
  id: string; // Unique idempotency UUID
  workspaceId: string;
  operation: SyncOperationType;
  entityType: "product" | "customer" | "sale" | "purchase" | "audit_note" | "setting";
  entityId: string;
  payload: Record<string, unknown>;
  status: SyncStatus;
  retryCount: number;
  lastAttempt?: number;
  error?: string;
  createdAt: number;
  syncedAt?: number;
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
