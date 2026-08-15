import * as Sentry from "@sentry/nextjs";

import { sharedOptions } from "@/lib/observability/sentry-config";

// Server + edge error tracking. Inert until SENTRY_DSN is set: Sentry.init with
// an empty DSN is a documented no-op, so this ships safely before the account
// exists and lights up the moment the env var lands in Vercel.
//
// onRequestError is the piece that matters most here. Server Actions carry the
// whole mutation surface of this app (document commit, deletion, billing,
// household changes), and a throw inside one currently vanishes into Vercel
// logs. This routes them to the tracker with the route and router context
// attached.

export function register() {
  Sentry.init(sharedOptions);
}

export const onRequestError = Sentry.captureRequestError;
