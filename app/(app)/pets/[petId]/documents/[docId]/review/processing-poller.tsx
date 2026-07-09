"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While the document is pending/extracting, periodically refresh the route so
 * the server component re-fetches the document and can flip to the review UI.
 */
export function ProcessingPoller({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
