import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, toggleUserBlockedStatus } from "@/lib/services/adminService";
import { isUserAdmin } from "@/lib/services/platformSettingsService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminEmail = searchParams.get("adminEmail");
    const adminUid = searchParams.get("adminUid");
    const query = searchParams.get("query") || undefined;

    if (!isUserAdmin({ uid: adminUid || undefined, email: adminEmail })) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required." }, { status: 403 });
    }

    const users = await getAllUsers({ uid: adminUid || "", email: adminEmail }, query);
    return NextResponse.json({ success: true, users });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Failed to retrieve user accounts.";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetUid, isBlocked, blockedReason, adminUser } = body;

    if (!isUserAdmin(adminUser)) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required." }, { status: 403 });
    }

    if (!targetUid || typeof isBlocked !== "boolean") {
      return NextResponse.json(
        { error: "targetUid and isBlocked (boolean) are required." },
        { status: 400 }
      );
    }

    const updated = await toggleUserBlockedStatus({
      targetUid,
      isBlocked,
      blockedReason,
      adminUser,
    });

    return NextResponse.json({
      success: true,
      message: `User account ${isBlocked ? "blocked" : "unblocked"} successfully.`,
      user: updated,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Failed to update user status.";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
