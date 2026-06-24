"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

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
import { ApiClientError } from "@/lib/api/client";
import { forgotPasswordRequest } from "@/lib/api/resources";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await forgotPasswordRequest(email);
      setMessage(response.message);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Unable to send reset email.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            Enter your account email and we will send a secure reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                required
              />
            </div>
            {message ? (
              <p
                className="bg-primary/10 text-foreground rounded-md px-3 py-2 text-sm"
                role="status"
              >
                {message}
              </p>
            ) : null}
            {error ? (
              <p
                className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            <Link
              href="/"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
