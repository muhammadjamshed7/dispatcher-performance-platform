import "dotenv/config";

import { PrismaClient, type TruckType } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

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

async function main() {
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

  console.log("Bootstrap complete.");
  console.log(`Organization: ${organization.slug}`);
  console.log(
    "Create users in Supabase Auth, then link them with: npm run sync-auth-user -- <email> <ADMIN|TEAM_LEAD|DISPATCHER>",
  );

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
