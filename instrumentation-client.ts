import * as Sentry from "@sentry/nextjs";

import { sharedOptions } from "@/lib/observability/sentry-config";

// Browser error tracking. Runs before the app becomes interactive. Inert until
// NEXT_PUBLIC_SENTRY_DSN is set — an empty DSN makes init a no-op.
//
// Session Replay and browser tracing are deliberately NOT enabled: replay would
// record pet medical records and owner details from the DOM, which is exactly
// the data this product exists to keep private.

Sentry.init({
  ...sharedOptions,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
