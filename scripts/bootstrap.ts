import "dotenv/config";

import {
  PrismaClient,
  type TruckType,
  type UserRole,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_STATUS_REASONS = [
  "Driver unavailable for scheduled pickup",
  "Shipper cancelled load after rate confirmation",
  "No suitable freight available for lane",
  "Equipment breakdown",
  "Rate negotiation failed",
  "Customer rescheduled pickup",
];

const DEFAULT_TRUCK_TYPES: TruckType[] = [
  "DRY_VAN",
  "REEFER",
  "FLATBED",
  "BOX_TRUCK",
  "HOTSHOT",
  "POWER_ONLY",
  "CARGO_VAN",
];

function parseAdminEmails(): string[] {
  const raw = process.env.INITIAL_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function parseTeamLeadEmails(): string[] {
  const raw = process.env.INITIAL_TEAM_LEAD_EMAILS ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function formatNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "User";
  return local.replaceAll(".", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function createDb() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or DIRECT_URL is required.");
  }

  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");

  const pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

async function ensureSupabaseUser(
  email: string,
  password: string,
  fullName: string,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.warn(`Skipping Supabase auth bootstrap for ${email} (missing env).`);
    return null;
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existing = await supabase.auth.admin.listUsers();
  const found = existing.data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );

  if (found) {
    return found.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { fullName },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? `Failed to create Supabase user for ${email}`);
  }

  return data.user.id;
}

async function main() {
  const db = createDb();
  const adminEmails = parseAdminEmails();
  const bootstrapPassword =
    process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "ChangeMe123!";
  const enableDemo = process.env.ENABLE_DEMO_DATA === "true";

  const organization =
    (await db.organization.findFirst({ where: { deletedAt: null } })) ??
    (await db.organization.create({
      data: {
        name: "Default Organization",
        slug: "default",
        timezone: process.env.DEFAULT_TIMEZONE ?? "America/Chicago",
        currency: process.env.DEFAULT_CURRENCY ?? "USD",
      },
    }));

  await db.organizationSettings.upsert({
    where: { organizationId: organization.id },
    create: {
      organizationId: organization.id,
      allowedTruckTypes: DEFAULT_TRUCK_TYPES,
      timezone: organization.timezone,
    },
    update: {},
  });

  for (const [index, label] of DEFAULT_STATUS_REASONS.entries()) {
    await db.statusReason.upsert({
      where: {
        organizationId_label: {
          organizationId: organization.id,
          label,
        },
      },
      create: {
        organizationId: organization.id,
        label,
        sortOrder: index,
      },
      update: { isActive: true, sortOrder: index },
    });
  }

  for (const email of adminEmails) {
    const fullName = formatNameFromEmail(email);
    const supabaseUserId = await ensureSupabaseUser(
      email,
      bootstrapPassword,
      fullName,
    );

    await db.user.upsert({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email,
        },
      },
      create: {
        organizationId: organization.id,
        email,
        fullName,
        role: "ADMIN" satisfies UserRole,
        status: "ACTIVE",
        supabaseUserId,
      },
      update: {
        role: "ADMIN",
        status: "ACTIVE",
        supabaseUserId: supabaseUserId ?? undefined,
      },
    });
  }

  const teamLeadEmails = parseTeamLeadEmails();
  for (const email of teamLeadEmails) {
    const fullName = formatNameFromEmail(email);
    const supabaseUserId = await ensureSupabaseUser(
      email,
      bootstrapPassword,
      fullName,
    );

    const team =
      (await db.team.findFirst({
        where: {
          organizationId: organization.id,
          name: "Default Team",
          deletedAt: null,
        },
      })) ??
      (await db.team.create({
        data: {
          organizationId: organization.id,
          name: "Default Team",
          status: "ACTIVE",
        },
      }));

    const user = await db.user.upsert({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email,
        },
      },
      create: {
        organizationId: organization.id,
        email,
        fullName,
        role: "TEAM_LEAD" satisfies UserRole,
        status: "ACTIVE",
        teamId: team.id,
        supabaseUserId,
      },
      update: {
        role: "TEAM_LEAD",
        status: "ACTIVE",
        teamId: team.id,
        supabaseUserId: supabaseUserId ?? undefined,
      },
    });

    await db.team.update({
      where: { id: team.id },
      data: { teamLeadUserId: user.id },
    });
  }

  if (enableDemo) {
    console.log("Demo data seeding is enabled but minimal in bootstrap. Extend scripts/seed-demo-data.ts as needed.");
  }

  console.log("Bootstrap complete.");
  console.log(`Organization: ${organization.slug}`);
  console.log(`Admin emails: ${adminEmails.join(", ") || "(none configured)"}`);
  console.log(`Team lead emails: ${teamLeadEmails.join(", ") || "(none configured)"}`);
  if (adminEmails.length > 0 || teamLeadEmails.length > 0) {
    console.log(`Bootstrap admin password: ${bootstrapPassword}`);
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
