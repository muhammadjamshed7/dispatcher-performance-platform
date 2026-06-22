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
import {
  getDashboardPathForRole,
  ROLE_REGISTER_PATH,
} from "@/lib/auth/roles";
import type { Role } from "@/lib/constants/roles";

type RoleLoginFormProps = {
  role: Role;
  title: string;
  description: string;
};

function RoleLoginFormContent({ role, title, description }: RoleLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const registerPath = ROLE_REGISTER_PATH[role];
  const loggedOut = searchParams.get("loggedOut") === "1";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const session = await loginRequest({ email, password, expectedRole: role });
      setSession(session);
      router.replace(getDashboardPathForRole(role));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to sign in.");
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {loggedOut ? (
            <p
              className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground"
              role="status"
            >
              You have been signed out successfully.
            </p>
          ) : null}
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
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
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          {registerPath ? (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Need an account?{" "}
              <Link
                href={registerPath}
                className="font-medium text-primary underline-offset-4 hover:underline"
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
