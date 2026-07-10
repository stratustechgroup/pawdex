import "server-only";

import { cache } from "react";

export type ExternalProviderAvailability = {
  google: boolean;
};

/**
 * Which external OAuth providers the Supabase project currently has enabled.
 * Read from GoTrue's public settings endpoint so the account UI can light up a
 * "Connect Google" button the moment the founder configures the provider, with
 * no code change. Wrapped in React cache() so a single request that renders the
 * account page hits the endpoint once. Fails closed (all false) on any error.
 */
export const getExternalProviders = cache(
  async (): Promise<ExternalProviderAvailability> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return { google: false };
    try {
      const res = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: key },
        cache: "no-store",
      });
      if (!res.ok) return { google: false };
      const json = (await res.json()) as {
        external?: Record<string, boolean>;
      };
      return { google: Boolean(json.external?.google) };
    } catch {
      return { google: false };
    }
  },
);
