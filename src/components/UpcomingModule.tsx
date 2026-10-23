"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, Clock, Sparkles } from "lucide-react";

interface UpcomingModuleProps {
  moduleName: string;
  description: string;
  phase?: string;
  plannedFeatures: string[];
}

export function UpcomingModule({
  moduleName,
  description,
  phase = "Phase 2",
  plannedFeatures,
}: UpcomingModuleProps) {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-4">
          <Clock className="w-3.5 h-3.5" />
          <span>Scheduled for {phase}</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {moduleName} Module
        </h1>

        <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
          {description}
        </p>

        <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-5 text-left max-w-md mx-auto">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Planned Capabilities</span>
          </h2>
          <ul className="space-y-2 text-xs text-slate-600">
            {plannedFeatures.map((feat, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
