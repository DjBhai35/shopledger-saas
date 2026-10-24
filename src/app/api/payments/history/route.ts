import { NextRequest, NextResponse } from "next/server";
import {
  getPaymentProofsByWorkspace,
  getPaymentHistory,
} from "@/lib/services/cryptoPaymentService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId parameter is required" }, { status: 400 });
    }

    const proofs = await getPaymentProofsByWorkspace(workspaceId);
    const history = await getPaymentHistory(workspaceId);

    return NextResponse.json({
      success: true,
      proofs,
      history,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Failed to fetch payment history.";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
