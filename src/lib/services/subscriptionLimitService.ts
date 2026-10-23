import { getLocalDB } from "@/lib/offline/db";
import { WorkspaceSubscription } from "@/types";

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  current: number;
  max: number;
}

/**
 * Service to enforce subscription plan limits (products, monthly invoices, staff).
 * Evaluated on both client and trusted server logic.
 */
export async function checkProductLimit(
  workspaceId: string,
  subscription?: WorkspaceSubscription | null
): Promise<LimitCheckResult> {
  const maxProducts = subscription?.limits?.maxProducts ?? 100;

  try {
    const db = await getLocalDB();
    const products = await db.getAllFromIndex("products", "by_workspace", workspaceId);
    const activeProducts = products.filter((p) => !p.isArchived);
    const current = activeProducts.length;

    if (current >= maxProducts) {
      return {
        allowed: false,
        reason: `Product limit reached (${current}/${maxProducts}). Upgrade your subscription tier to add more products.`,
        current,
        max: maxProducts,
      };
    }

    return { allowed: true, current, max: maxProducts };
  } catch {
    // If offline DB error, default to allowing if reasonable
    return { allowed: true, current: 0, max: maxProducts };
  }
}

export async function checkMonthlyInvoiceLimit(
  workspaceId: string,
  subscription?: WorkspaceSubscription | null
): Promise<LimitCheckResult> {
  const maxInvoices = subscription?.limits?.maxMonthlyInvoices ?? 150;

  try {
    const db = await getLocalDB();
    const sales = await db.getAllFromIndex("sales", "by_workspace", workspaceId);

    // Calculate sales in current calendar month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const currentMonthSales = sales.filter((s) => s.createdAt >= startOfMonth);
    const current = currentMonthSales.length;

    if (current >= maxInvoices) {
      return {
        allowed: false,
        reason: `Monthly invoice limit reached (${current}/${maxInvoices}). Upgrade your plan to issue more sales invoices this month.`,
        current,
        max: maxInvoices,
      };
    }

    return { allowed: true, current, max: maxInvoices };
  } catch {
    return { allowed: true, current: 0, max: maxInvoices };
  }
}
