"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * Drop-in replacement for <Link> that upgrades to a FULL-route prefetch on the
 * first sign of navigation intent (hover, keyboard focus, or touch start).
 *
 * A default <Link> to a dynamic route (e.g. /pets/[petId]) only prefetches down
 * to the nearest loading boundary, i.e. the shell, so the click still waits on
 * the server to render the page's data. Arming prefetch={true} the moment the
 * user shows intent warms the entire route including its data, so the click
 * itself lands on an already-fetched page.
 *
 * Before intent fires it behaves exactly like the <Link> it replaces (default
 * viewport prefetch stays on unless the caller passed prefetch={false}), so
 * this never regresses existing behavior. Prefetching is production-only,
 * matching Next's <Link> defaults.
 */
export function PrefetchLink({
  children,
  prefetch,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: ComponentProps<typeof Link>) {
  const [armed, setArmed] = useState(false);

  return (
    <Link
      {...props}
      prefetch={armed ? true : prefetch ?? null}
      onMouseEnter={(e) => {
        setArmed(true);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setArmed(true);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        setArmed(true);
        onTouchStart?.(e);
      }}
    >
      {children}
    </Link>
  );
}
