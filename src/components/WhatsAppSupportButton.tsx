"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, PhoneCall } from "lucide-react";
import { useAuth } from "@/lib/firebase/auth-context";
import { getPlatformSettings } from "@/lib/services/platformSettingsService";

export function WhatsAppSupportButton({ mode = "floating" }: { mode?: "floating" | "inline" | "header" }) {
  const { workspace, userProfile } = useAuth();
  const [whatsappNumber, setWhatsappNumber] = useState("+923001234567");
  const [defaultMessage, setDefaultMessage] = useState("Hello ShopLedger Support, I need assistance with my account:");

  useEffect(() => {
    getPlatformSettings()
      .then((settings) => {
        if (settings.whatsappNumber) setWhatsappNumber(settings.whatsappNumber);
        if (settings.whatsappDefaultMessage) setDefaultMessage(settings.whatsappDefaultMessage);
      })
      .catch(() => {});
  }, []);

  // Format clean international phone number without spaces or +
  const cleanPhone = whatsappNumber.replace(/[^0-9]/g, "");

  // Compose message with context
  let text = defaultMessage;
  if (workspace) {
    text += `\nShop Name: ${workspace.name}\nWorkspace ID: ${workspace.id}`;
  }
  if (userProfile?.email) {
    text += `\nUser: ${userProfile.email}`;
  }

  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;

  if (mode === "header") {
    return (
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Chat with WhatsApp Support"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>WhatsApp Support</span>
      </a>
    );
  }

  if (mode === "inline") {
    return (
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition-all"
      >
        <MessageSquare className="w-4 h-4" />
        <span>Chat on WhatsApp ({whatsappNumber})</span>
      </a>
    );
  }

  // Floating button
  return (
    <aside
      aria-label="WhatsApp Support Floating Help"
      className="fixed bottom-6 right-6 z-40 flex items-center group"
    >
      <div className="mr-3 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none hidden sm:block whitespace-nowrap">
        Chat with WhatsApp Support
      </div>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="w-13 h-13 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all focus:outline-hidden focus:ring-4 focus:ring-emerald-300"
      >
        <svg
          className="w-7 h-7 fill-current"
          viewBox="0 0 24 24"
        >
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.043.072.043.419-.101.824z" />
          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.662 1.434 5.178L2 22l4.981-1.309C8.423 21.529 10.15 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2c-1.637 0-3.15-.467-4.436-1.275l-.317-.199-2.961.777.79-2.887-.217-.346C3.987 14.887 3.5 13.491 3.5 12c0-4.687 3.813-8.5 8.5-8.5 4.686 0 8.5 3.813 8.5 8.5 0 4.687-3.814 8.5-8.5 8.5z" />
        </svg>
      </a>
    </aside>
  );
}
