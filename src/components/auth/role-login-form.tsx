"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

import { useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiClientError } from "@/lib/api/client";
import { loginRequest } from "@/lib/api/resources";
import { getDashboardPathForRole, ROLE_REGISTER_PATH } from "@/lib/auth/roles";
import type { Role } from "@/lib/constants/roles";

type RoleLoginFormProps = {
  role: Role;
  title: string;
  description: string;
};

function RoleLoginFormContent({
  role,
  title,
  description,
}: RoleLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession, refreshSession } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const registerPath = ROLE_REGISTER_PATH[role];
  const loggedOut = searchParams.get("loggedOut") === "1";
  const expired = searchParams.get("expired") === "1";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const session = await loginRequest({
        email,
        password,
        expectedRole: role,
      });
      setSession(session);
      await refreshSession();
      router.refresh();
      router.replace(getDashboardPathForRole(role));
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Unable to sign in.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {expired ? (
            <p
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              role="status"
            >
              Your session expired. Please sign in again.
            </p>
          ) : null}
          {loggedOut ? (
            <p
              className="border-primary/20 bg-primary/5 text-foreground mb-4 rounded-lg border px-3 py-2 text-sm"
              role="status"
            >
              You have been signed out successfully.
            </p>
          ) : null}
          <form
            className="space-y-4"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error ? (
              <p
                className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            <Link
              href="/auth/reset-password"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </p>
          {registerPath ? (
            <p className="text-muted-foreground mt-4 text-center text-sm">
              Need an account?{" "}
              <Link
                href={registerPath}
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                Register as dispatcher
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

export function RoleLoginForm(props: RoleLoginFormProps) {
  return (
    <Suspense fallback={null}>
      <RoleLoginFormContent {...props} />
    </Suspense>
  );
}
