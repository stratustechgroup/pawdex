import Link from "next/link";

import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in — Puppy",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const redirectTo = params.redirect ?? "/";

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <Link href="/" className="inline-block text-2xl font-semibold tracking-tight">
            Puppy
          </Link>
          <p className="text-muted-foreground text-sm">
            Sign in to keep your pets&apos; records organized.
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm">
            <p className="font-medium">Check your email</p>
            <p className="text-muted-foreground mt-1">
              We sent a magic link. It expires in 10 minutes.
            </p>
          </div>
        ) : (
          <LoginForm redirectTo={redirectTo} />
        )}
      </div>
    </main>
  );
}
