import { Suspense } from "react";
import MoneyPageClient from "./MoneyPageClient";

export default function MoneyPage() {
  return (
    <Suspense fallback={<div className="p-4 text-[13px] text-muted">…</div>}>
      <MoneyPageClient />
    </Suspense>
  );
}
