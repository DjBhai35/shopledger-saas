import { NextRequest, NextResponse } from "next/server";
import {
  approvePaymentProof,
  rejectPaymentProof,
  getAllPaymentProofs,
} from "@/lib/services/cryptoPaymentService";
import { isUserAdmin } from "@/lib/services/platformSettingsService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminEmail = searchParams.get("adminEmail");
    const adminUid = searchParams.get("adminUid");
    const status = searchParams.get("status") as any;

    if (!isUserAdmin({ uid: adminUid || undefined, email: adminEmail })) {
      return NextResponse.json({ error: "Unauthorized access: Admin privileges required." }, { status: 403 });
    }

    const proofs = await getAllPaymentProofs({ uid: adminUid || "", email: adminEmail }, status || undefined);
    return NextResponse.json({ success: true, proofs });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Failed to load payment proofs.";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, proofId, adminNotes, rejectionReason, adminUser } = body;

    if (!isUserAdmin(adminUser)) {
      return NextResponse.json(
        { error: "Unauthorized: Verified platform administrator privileges required." },
        { status: 403 }
      );
    }

    if (!proofId || !action) {
      return NextResponse.json({ error: "proofId and action ('approve' | 'reject') are required." }, { status: 400 });
    }

    if (action === "approve") {
      const result = await approvePaymentProof({
        proofId,
        adminUser,
        adminNotes,
      });

      return NextResponse.json({
        success: true,
        message: "Payment approved and subscription activated successfully.",
        ...result,
      });
    } else if (action === "reject") {
      if (!rejectionReason || !rejectionReason.trim()) {
        return NextResponse.json({ error: "Rejection reason is required when rejecting a payment proof." }, { status: 400 });
      }

      const rejected = await rejectPaymentProof({
        proofId,
        adminUser,
        rejectionReason,
      });

      return NextResponse.json({
        success: true,
        message: "Payment proof rejected. Subscription was not activated.",
        paymentProof: rejected,
      });
    } else {
      return NextResponse.json({ error: "Invalid action. Must be 'approve' or 'reject'." }, { status: 400 });
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Failed to process payment review.";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
