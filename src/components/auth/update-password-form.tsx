"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiClientError } from "@/lib/api/client";
import { updatePasswordRequest } from "@/lib/api/resources";
import { getDashboardPathForRole } from "@/lib/auth/roles";
import { useSession } from "@/components/auth/session-provider";

export function UpdatePasswordForm() {
  const router = useRouter();
  const { session, refreshSession } = useSession();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePasswordRequest(password);
      await refreshSession();
      router.replace(session ? getDashboardPathForRole(session.role) : "/");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Unable to update password.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            Choose a new password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
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
              {isSubmitting ? "Saving…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
