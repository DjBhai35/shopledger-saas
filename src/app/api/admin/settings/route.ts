import { NextRequest, NextResponse } from "next/server";
import {
  getPlatformSettings,
  updatePlatformSettings,
  isUserAdmin,
} from "@/lib/services/platformSettingsService";
import {
  getConfiguredPricingPlans,
  updateConfiguredPricingPlans,
  getConfiguredCategories,
  updateConfiguredCategories,
} from "@/lib/services/adminService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminEmail = searchParams.get("adminEmail");
    const adminUid = searchParams.get("adminUid");

    if (!isUserAdmin({ uid: adminUid || undefined, email: adminEmail })) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required." }, { status: 403 });
    }

    const settings = await getPlatformSettings();
    const plans = await getConfiguredPricingPlans();
    const categories = await getConfiguredCategories();

    return NextResponse.json({
      success: true,
      settings,
      plans,
      categories,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Failed to load admin settings.";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { section, payload, adminUser } = body;

    if (!isUserAdmin(adminUser)) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required." }, { status: 403 });
    }

    if (section === "settings") {
      const updated = await updatePlatformSettings(payload, adminUser.uid);
      return NextResponse.json({ success: true, settings: updated });
    } else if (section === "plans") {
      const updated = await updateConfiguredPricingPlans({ plans: payload, adminUser });
      return NextResponse.json({ success: true, plans: updated });
    } else if (section === "categories") {
      const updated = await updateConfiguredCategories({ categories: payload, adminUser });
      return NextResponse.json({ success: true, categories: updated });
    } else {
      return NextResponse.json({ error: "Invalid section. Must be 'settings', 'plans', or 'categories'." }, { status: 400 });
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Failed to update configuration.";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
