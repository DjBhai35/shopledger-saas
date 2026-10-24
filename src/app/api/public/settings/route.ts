import { NextResponse } from "next/server";
import { getPlatformSettings } from "@/lib/services/platformSettingsService";

export async function GET() {
  try {
    const settings = await getPlatformSettings();
    return NextResponse.json({
      success: true,
      settings: {
        platformName: settings.platformName,
        supportEmail: settings.supportEmail,
        whatsappNumber: settings.whatsappNumber,
        whatsappDefaultMessage: settings.whatsappDefaultMessage,
        announcementMessage: settings.announcementMessage,
        announcementActive: settings.announcementActive,
        trc20WalletAddress: settings.trc20WalletAddress,
        bep20WalletAddress: settings.bep20WalletAddress,
        usdtInstructionsNotes: settings.usdtInstructionsNotes,
      },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Failed to load public settings.";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
