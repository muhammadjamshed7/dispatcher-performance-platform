import "dotenv/config";

import { PrismaClient, type UserRole } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const ROLES = ["ADMIN", "TEAM_LEAD", "DISPATCHER"] as const;

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

function formatNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "User";
  return local
    .replaceAll(".", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const roleInput = (process.argv[3] ?? "").trim().toUpperCase();
  const fullNameArg = process.argv.slice(4).join(" ").trim();

  if (!email || !ROLES.includes(roleInput as (typeof ROLES)[number])) {
    throw new Error(
      "Usage: npm run sync-auth-user -- <email> <ADMIN|TEAM_LEAD|DISPATCHER> [fullName]\n" +
        "Create the user in Supabase Dashboard → Authentication first, then run this script.",
    );
  }

  const role = roleInput as UserRole;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env",
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listData, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) {
    throw new Error(listError.message);
  }

  const authUser = listData.users.find(
    (user) => user.email?.toLowerCase() === email,
  );

  if (!authUser) {
    throw new Error(
      `No Supabase Auth user for ${email}. Create the user in Supabase Dashboard → Authentication first.`,
    );
  }

  const db = createDb();

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

  const fullName =
    fullNameArg ||
    (typeof authUser.user_metadata?.fullName === "string"
      ? authUser.user_metadata.fullName
      : formatNameFromEmail(email));

  let teamId: string | undefined;

  if (role === "TEAM_LEAD" || role === "DISPATCHER") {
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

    teamId = team.id;
  }

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
      role,
      status: "ACTIVE",
      teamId,
      supabaseUserId: authUser.id,
    },
    update: {
      fullName,
      role,
      status: "ACTIVE",
      teamId: teamId ?? undefined,
      supabaseUserId: authUser.id,
    },
  });

  if (role === "TEAM_LEAD" && teamId) {
    await db.team.update({
      where: { id: teamId },
      data: { teamLeadUserId: user.id },
    });
  }

  if (role === "DISPATCHER" && teamId) {
    await db.dispatcher.upsert({
      where: { userId: user.id },
      create: {
        organizationId: organization.id,
        userId: user.id,
        teamId,
        status: "ACTIVE",
      },
      update: {
        teamId,
        status: "ACTIVE",
        deletedAt: null,
      },
    });
  }

  console.log(`Linked ${email} as ${role} (user id: ${user.id}).`);
  console.log(
    "Password is managed in Supabase Auth only — not stored in this app.",
  );

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
