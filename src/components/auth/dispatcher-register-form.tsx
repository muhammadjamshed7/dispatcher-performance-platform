"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { mockRegisterDispatcher } from "@/lib/auth/mock-session";
import { mockTeams } from "@/lib/mock-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DispatcherRegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [preferredTeam, setPreferredTeam] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const result = mockRegisterDispatcher({
      fullName,
      email,
      phoneNumber,
      preferredTeam: preferredTeam || undefined,
      notes: notes || undefined,
    });

    setSubmittedMessage(result.message);
    setIsSubmitting(false);
  };

  if (submittedMessage) {
    return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md text-center shadow-sm">
          <CardHeader>
            <CardTitle>Request Submitted</CardTitle>
            <CardDescription>{submittedMessage}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link href="/dispatcher/login" className={buttonVariants({ variant: "default" })}>
              Back to dispatcher sign in
            </Link>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Return home
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-lg shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle>Dispatcher Registration</CardTitle>
          <CardDescription>
            Submit a registration request. An administrator must approve your account
            before you can sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredTeam">Preferred Team (optional)</Label>
              <Select
                value={preferredTeam}
                onValueChange={(value) => setPreferredTeam(value ?? "")}
              >
                <SelectTrigger id="preferredTeam">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {mockTeams.map((team) => (
                    <SelectItem key={team.id} value={team.name}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </div>
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit registration request"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already approved?{" "}
            <Link
              href="/dispatcher/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
