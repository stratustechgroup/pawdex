"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { requireSession } from "@/lib/auth/household";
import {
  AUTHORIZATION_DESCRIPTORS,
  grantAuthorization,
  revokeAuthorization,
} from "@/lib/auth/authorizations";
import type { AuthorizationType } from "@/lib/supabase/types";

function parseType(value: FormDataEntryValue | null): AuthorizationType {
  if (typeof value !== "string" || !(value in AUTHORIZATION_DESCRIPTORS)) {
    throw new Error("Unknown authorization type.");
  }
  return value as AuthorizationType;
}

export async function grantAuthorizationAction(formData: FormData): Promise<void> {
  const type = parseType(formData.get("type"));
  const session = await requireSession();
  const descriptor = AUTHORIZATION_DESCRIPTORS[type];
  if (descriptor.requiresOwner && session.role !== "owner") {
    throw new Error("Only the household owner can grant this authorization.");
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const userAgent = h.get("user-agent") ?? null;

  await grantAuthorization({
    householdId: session.householdId,
    userId: session.userId,
    type,
    ipAddress: ip,
    userAgent,
  });

  revalidatePath("/settings/authorizations");
  revalidatePath("/settings");
}

export async function revokeAuthorizationAction(formData: FormData): Promise<void> {
  const type = parseType(formData.get("type"));
  const session = await requireSession();
  const descriptor = AUTHORIZATION_DESCRIPTORS[type];
  if (descriptor.requiresOwner && session.role !== "owner") {
    throw new Error("Only the household owner can revoke this authorization.");
  }

  await revokeAuthorization({
    householdId: session.householdId,
    userId: session.userId,
    type,
  });

  revalidatePath("/settings/authorizations");
  revalidatePath("/settings");
}
