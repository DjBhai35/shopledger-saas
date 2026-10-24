import { NextRequest, NextResponse } from "next/server";
import { getAdminAuditLogs } from "@/lib/services/auditLogService";
import { isUserAdmin } from "@/lib/services/platformSettingsService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminEmail = searchParams.get("adminEmail");
    const adminUid = searchParams.get("adminUid");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    if (!isUserAdmin({ uid: adminUid || undefined, email: adminEmail })) {
      return NextResponse.json(
        { error: "Unauthorized: Admin privileges required to inspect audit logs." },
        { status: 403 }
      );
    }

    const logs = await getAdminAuditLogs({ uid: adminUid || "", email: adminEmail }, limit);
    return NextResponse.json({ success: true, logs });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Failed to retrieve audit logs.";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
