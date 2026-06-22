"use client";

import { Printer } from "lucide-react";

export function PrintReportButton() {
  function handlePrint() {
    const previousTitle = document.title;

    document.title = "";

    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };

    window.addEventListener("afterprint", restoreTitle);
    window.print();
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 print:hidden"
    >
      <Printer size={15} />
      PDF / ispis
    </button>
  );
}
