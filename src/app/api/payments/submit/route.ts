import { NextRequest, NextResponse } from "next/server";
import { submitPaymentProof } from "@/lib/services/cryptoPaymentService";
import { SubmitPaymentProofInput } from "@/lib/services/cryptoPaymentService";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SubmitPaymentProofInput;

    if (!body.workspaceId || !body.userUid || !body.planId || !body.txHash || !body.network) {
      return NextResponse.json(
        { error: "Missing required payment fields: workspaceId, userUid, planId, txHash, network." },
        { status: 400 }
      );
    }

    const proof = await submitPaymentProof(body);

    return NextResponse.json({
      success: true,
      message: "Payment proof submitted successfully. Pending admin blockchain verification.",
      proof,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Failed to submit payment proof.";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
