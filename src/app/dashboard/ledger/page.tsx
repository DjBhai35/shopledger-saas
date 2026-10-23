"use client";

import { UpcomingModule } from "@/components/UpcomingModule";

export default function LedgerPage() {
  return (
    <UpcomingModule
      moduleName="Customer Ledger & Udhar / Khata"
      description="Traditional dual-entry Khata ledger tracking credit granted to trusted customers, running balances, payment collection logs, and PDF account statements."
      plannedFeatures={[
        "Running balance ledger (Debit, Credit, Balance)",
        "Automated WhatsApp statement sharing with 1-click payment links",
        "Overdue payment notifications and credit aging reports",
        "Offline payment collection queuing via IndexedDB",
      ]}
    />
  );
}
