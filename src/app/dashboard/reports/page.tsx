"use client";

import { UpcomingModule } from "@/components/UpcomingModule";

export default function ReportsPage() {
  return (
    <UpcomingModule
      moduleName="Business Intelligence & Reports"
      description="Executive financial reporting, profit & loss statements, top-selling inventory analytics, and tax compliance export."
      plannedFeatures={[
        "Daily, weekly, and monthly sales turnover reports",
        "Gross and net profit margin analysis",
        "Fast-moving vs dead inventory metrics",
        "PDF and CSV export for tax filing",
      ]}
    />
  );
}
