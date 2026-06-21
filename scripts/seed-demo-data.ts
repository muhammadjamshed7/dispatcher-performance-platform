/**
 * Demo / UI test seed data (Pakistani names, carriers, mixed activity statuses).
 * Safe to re-run — upserts by email / MC number / carrier+date.
 *
 * Usage:
 *   npm run seed:demo
 *   npm run seed:demo -- --remove   # delete all @demo.dpp.local data
 */
import "dotenv/config";

import {
  PrismaClient,
  type LoadActivityStatus,
  type TruckType,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const DEMO_EMAIL_DOMAIN = "demo.dpp.local";
const DEMO_PASSWORD = "DemoPass123!";

const STATUS_REASONS = [
  "Driver unavailable for scheduled pickup",
  "Shipper cancelled load after rate confirmation",
  "No suitable freight available for lane",
  "Equipment breakdown",
  "Rate negotiation failed",
  "Customer rescheduled pickup",
];

const TRUCK_TYPES: TruckType[] = [
  "DRY_VAN",
  "REEFER",
  "FLATBED",
  "BOX_TRUCK",
  "HOTSHOT",
  "POWER_ONLY",
  "CARGO_VAN",
];

const TEAMS = ["Lahore Team", "Karachi Team", "Islamabad Team"] as const;

const DISPATCHERS: {
  fullName: string;
  emailLocal: string;
  phone: string;
  team: (typeof TEAMS)[number];
}[] = [
  { fullName: "Jamshed Ali", emailLocal: "jamshed.ali", phone: "+92-300-1112233", team: "Lahore Team" },
  { fullName: "Ahmad Hassan", emailLocal: "ahmad.hassan", phone: "+92-321-4455667", team: "Lahore Team" },
  { fullName: "Mansha Khan", emailLocal: "mansha.khan", phone: "+92-333-7788990", team: "Lahore Team" },
  { fullName: "Rehan Malik", emailLocal: "rehan.malik", phone: "+92-300-5544332", team: "Karachi Team" },
  { fullName: "Usman Raza", emailLocal: "usman.raza", phone: "+92-345-6677889", team: "Karachi Team" },
  { fullName: "Bilal Sheikh", emailLocal: "bilal.sheikh", phone: "+92-312-9900112", team: "Karachi Team" },
  { fullName: "Hassan Iqbal", emailLocal: "hassan.iqbal", phone: "+92-301-2233445", team: "Islamabad Team" },
  { fullName: "Faisal Mahmood", emailLocal: "faisal.mahmood", phone: "+92-322-5566778", team: "Islamabad Team" },
];

const CARRIER_TEMPLATES: {
  carrierName: string;
  driverName: string;
  mcNumber: string;
  truckType: TruckType;
  fee: number;
}[] = [
  { carrierName: "Al-Hamd Logistics", driverName: "Muhammad Asif", mcNumber: "MC-PK-1001", truckType: "DRY_VAN", fee: 10 },
  { carrierName: "Karachi Express Carriers", driverName: "Ali Raza", mcNumber: "MC-PK-1002", truckType: "REEFER", fee: 12 },
  { carrierName: "Lahore Freight Lines", driverName: "Imran Siddiqui", mcNumber: "MC-PK-1003", truckType: "FLATBED", fee: 11 },
  { carrierName: "Punjab Road Transport", driverName: "Nadeem Akhtar", mcNumber: "MC-PK-1004", truckType: "BOX_TRUCK", fee: 9 },
  { carrierName: "Sindh Cargo Movers", driverName: "Shahid Mehmood", mcNumber: "MC-PK-1005", truckType: "DRY_VAN", fee: 10.5 },
  { carrierName: "Green Line Haulers", driverName: "Tariq Jamil", mcNumber: "MC-PK-1006", truckType: "HOTSHOT", fee: 13 },
  { carrierName: "Capital Freight PK", driverName: "Waqas Butt", mcNumber: "MC-PK-1007", truckType: "CARGO_VAN", fee: 8.5 },
  { carrierName: "Indus Valley Transport", driverName: "Saeed Anwar", mcNumber: "MC-PK-1008", truckType: "POWER_ONLY", fee: 11.5 },
  { carrierName: "Metro Dispatch Carriers", driverName: "Kamran Aftab", mcNumber: "MC-PK-1009", truckType: "DRY_VAN", fee: 10 },
  { carrierName: "North Star Logistics", driverName: "Arslan Tariq", mcNumber: "MC-PK-1010", truckType: "REEFER", fee: 12.5 },
  { carrierName: "Falcon Freight Services", driverName: "Hamza Saleem", mcNumber: "MC-PK-1011", truckType: "FLATBED", fee: 11 },
  { carrierName: "Royal Cargo PK", driverName: "Zeeshan Ali", mcNumber: "MC-PK-1012", truckType: "BOX_TRUCK", fee: 9.5 },
  { carrierName: "Swift Wheels Transport", driverName: "Adnan Qureshi", mcNumber: "MC-PK-1013", truckType: "DRY_VAN", fee: 10 },
  { carrierName: "Pak Star Haulage", driverName: "Babar Azam", mcNumber: "MC-PK-1014", truckType: "HOTSHOT", fee: 14 },
  { carrierName: "City Link Carriers", driverName: "Danish Kaneria", mcNumber: "MC-PK-1015", truckType: "CARGO_VAN", fee: 8 },
  { carrierName: "Highway Masters PK", driverName: "Salman Butt", mcNumber: "MC-PK-1016", truckType: "DRY_VAN", fee: 10.5 },
  { carrierName: "Prime Movers Lahore", driverName: "Umar Akmal", mcNumber: "MC-PK-1017", truckType: "REEFER", fee: 12 },
  { carrierName: "Desert Road Logistics", driverName: "Shoaib Akhtar", mcNumber: "MC-PK-1018", truckType: "FLATBED", fee: 11.5 },
  { carrierName: "Port City Freight", driverName: "Wasim Akram", mcNumber: "MC-PK-1019", truckType: "BOX_TRUCK", fee: 9 },
  { carrierName: "Mountain Pass Transport", driverName: "Yasir Shah", mcNumber: "MC-PK-1020", truckType: "DRY_VAN", fee: 10 },
  { carrierName: "River Side Carriers", driverName: "Fakhar Zaman", mcNumber: "MC-PK-1021", truckType: "POWER_ONLY", fee: 11 },
  { carrierName: "Golden Gate Logistics", driverName: "Haris Rauf", mcNumber: "MC-PK-1022", truckType: "HOTSHOT", fee: 13.5 },
  { carrierName: "National Express PK", driverName: "Shaheen Afridi", mcNumber: "MC-PK-1023", truckType: "CARGO_VAN", fee: 8.5 },
  { carrierName: "Unity Cargo Lines", driverName: "Mohammad Rizwan", mcNumber: "MC-PK-1024", truckType: "DRY_VAN", fee: 10 },
];

const ROUTES = [
  { origin: "Karachi, PK", destination: "Lahore, PK", miles: 760, amount: 2850 },
  { origin: "Islamabad, PK", destination: "Multan, PK", miles: 420, amount: 1680 },
  { origin: "Lahore, PK", destination: "Faisalabad, PK", miles: 120, amount: 620 },
  { origin: "Karachi, PK", destination: "Hyderabad, PK", miles: 165, amount: 740 },
  { origin: "Rawalpindi, PK", destination: "Peshawar, PK", miles: 185, amount: 810 },
  { origin: "Quetta, PK", destination: "Karachi, PK", miles: 690, amount: 3100 },
  { origin: "Sialkot, PK", destination: "Lahore, PK", miles: 130, amount: 580 },
  { origin: "Gujranwala, PK", destination: "Islamabad, PK", miles: 210, amount: 920 },
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

function demoEmail(local: string) {
  return `${local}@${DEMO_EMAIL_DOMAIN}`.toLowerCase();
}

function utcDateOnly(daysAgo = 0): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo),
  );
}

function calculateRatePerMile(loadAmount: number, totalMiles: number): number {
  if (totalMiles <= 0) return 0;
  return Math.round((loadAmount / totalMiles) * 10000) / 10000;
}

function calculateDispatchFee(loadAmount: number, pct: number): number {
  return Math.round(loadAmount * (pct / 100) * 100) / 100;
}

function pickStatus(seed: number): LoadActivityStatus {
  const statuses: LoadActivityStatus[] = [
    "DELIVERED",
    "DELIVERED",
    "DELIVERED",
    "CANCELLED",
    "NOT_BOOKED",
    "NOT_WORKING",
  ];
  return statuses[seed % statuses.length]!;
}

async function ensureSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for demo seed.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureAuthUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
  fullName: string,
) {
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw new Error(listError.message);

  const existing = listData.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );
  if (existing) return existing.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { fullName, demoSeed: true },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? `Failed to create auth user ${email}`);
  }

  return data.user.id;
}

async function removeDemoData(db: PrismaClient) {
  const org = await db.organization.findFirst({ where: { deletedAt: null } });
  if (!org) {
    console.log("No organization found.");
    return;
  }

  const demoUsers = await db.user.findMany({
    where: {
      organizationId: org.id,
      email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` },
    },
    select: {
      id: true,
      email: true,
      supabaseUserId: true,
      dispatcher: { select: { id: true } },
    },
  });

  if (demoUsers.length === 0) {
    console.log("No demo seed data found.");
    return;
  }

  const dispatcherIds = demoUsers
    .map((user) => user.dispatcher?.id)
    .filter((id): id is string => Boolean(id));

  await db.dailyActivity.deleteMany({
    where: {
      OR: [
        { dispatcherId: { in: dispatcherIds } },
        { organizationId: org.id, carrier: { mcNumber: { startsWith: "MC-PK-" } } },
      ],
    },
  });

  await db.dailySubmission.deleteMany({
    where: { dispatcherId: { in: dispatcherIds } },
  });

  await db.carrierAssignmentHistory.deleteMany({
    where: { carrier: { organizationId: org.id, mcNumber: { startsWith: "MC-PK-" } } },
  });

  await db.carrier.deleteMany({
    where: { organizationId: org.id, mcNumber: { startsWith: "MC-PK-" } },
  });

  for (const user of demoUsers) {
    if (user.dispatcher) {
      await db.dispatcher.delete({ where: { id: user.dispatcher.id } }).catch(() => undefined);
    }
    await db.user.delete({ where: { id: user.id } });
  }

  const supabase = await ensureSupabase();
  for (const user of demoUsers) {
    if (user.supabaseUserId) {
      await supabase.auth.admin.deleteUser(user.supabaseUserId).catch(() => undefined);
    }
  }

  console.log(`Removed ${demoUsers.length} demo users and related carriers/activities.`);
}

async function seedDemoData(db: PrismaClient) {
  const supabase = await ensureSupabase();

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
      allowedTruckTypes: TRUCK_TYPES,
      timezone: organization.timezone,
    },
    update: { allowedTruckTypes: TRUCK_TYPES },
  });

  for (const [index, label] of STATUS_REASONS.entries()) {
    await db.statusReason.upsert({
      where: {
        organizationId_label: { organizationId: organization.id, label },
      },
      create: { organizationId: organization.id, label, sortOrder: index },
      update: { isActive: true, sortOrder: index },
    });
  }

  const admin = await db.user.findFirst({
    where: { organizationId: organization.id, role: "ADMIN", status: "ACTIVE" },
  });

  const teamIds = new Map<string, string>();
  for (const teamName of TEAMS) {
    const team = await db.team.upsert({
      where: {
        organizationId_name: { organizationId: organization.id, name: teamName },
      },
      create: { organizationId: organization.id, name: teamName, status: "ACTIVE" },
      update: { status: "ACTIVE", deletedAt: null },
    });
    teamIds.set(teamName, team.id);
  }

  type DispatcherRecord = {
    userId: string;
    dispatcherId: string;
    fullName: string;
    emailLocal: string;
    teamId: string;
    teamName: string;
  };

  const dispatchers: DispatcherRecord[] = [];

  for (const profile of DISPATCHERS) {
    const email = demoEmail(profile.emailLocal);
    const teamId = teamIds.get(profile.team)!;
    const supabaseUserId = await ensureAuthUser(supabase, email, profile.fullName);

    const user = await db.user.upsert({
      where: {
        organizationId_email: { organizationId: organization.id, email },
      },
      create: {
        organizationId: organization.id,
        supabaseUserId,
        email,
        fullName: profile.fullName,
        phoneNumber: profile.phone,
        role: "DISPATCHER",
        status: "ACTIVE",
        teamId,
      },
      update: {
        supabaseUserId,
        fullName: profile.fullName,
        phoneNumber: profile.phone,
        role: "DISPATCHER",
        status: "ACTIVE",
        teamId,
        deletedAt: null,
      },
    });

    const dispatcher = await db.dispatcher.upsert({
      where: { userId: user.id },
      create: {
        organizationId: organization.id,
        userId: user.id,
        teamId,
        status: "ACTIVE",
      },
      update: { teamId, status: "ACTIVE", deletedAt: null },
    });

    dispatchers.push({
      userId: user.id,
      dispatcherId: dispatcher.id,
      fullName: profile.fullName,
      emailLocal: profile.emailLocal,
      teamId,
      teamName: profile.team,
    });
  }

  let carrierIndex = 0;
  const carriersByDispatcher = new Map<string, string[]>();

  for (const dispatcher of dispatchers) {
    const assigned: string[] = [];
    for (let slot = 0; slot < 3; slot += 1) {
      const template = CARRIER_TEMPLATES[carrierIndex % CARRIER_TEMPLATES.length]!;
      carrierIndex += 1;
      const mcNumber = `MC-PK-${dispatcher.emailLocal.toUpperCase().replaceAll(".", "-")}-${slot + 1}`;

      const carrier = await db.carrier.upsert({
        where: {
          organizationId_mcNumber: {
            organizationId: organization.id,
            mcNumber,
          },
        },
        create: {
          organizationId: organization.id,
          carrierName: template.carrierName,
          driverName: template.driverName,
          mcNumber,
          truckType: template.truckType,
          teamId: dispatcher.teamId,
          dispatcherId: dispatcher.dispatcherId,
          dispatchFeePercentage: template.fee,
          status: "ACTIVE",
        },
        update: {
          carrierName: template.carrierName,
          driverName: template.driverName,
          teamId: dispatcher.teamId,
          dispatcherId: dispatcher.dispatcherId,
          dispatchFeePercentage: template.fee,
          status: "ACTIVE",
          deletedAt: null,
        },
      });

      if (admin) {
        const existingHistory = await db.carrierAssignmentHistory.findFirst({
          where: { carrierId: carrier.id, unassignedAt: null },
        });
        if (!existingHistory) {
          await db.carrierAssignmentHistory.create({
            data: {
              organizationId: organization.id,
              carrierId: carrier.id,
              teamId: dispatcher.teamId,
              dispatcherId: dispatcher.dispatcherId,
              teamNameSnapshot: dispatcher.teamName,
              dispatcherNameSnapshot: dispatcher.fullName,
              assignedByUserId: admin.id,
              notes: "Demo seed assignment",
            },
          });
        }
      }

      assigned.push(carrier.id);
    }
    carriersByDispatcher.set(dispatcher.dispatcherId, assigned);
  }

  let activityCount = 0;

  for (const dispatcher of dispatchers) {
    const carrierIds = carriersByDispatcher.get(dispatcher.dispatcherId) ?? [];

    for (let daysAgo = 0; daysAgo <= 7; daysAgo += 1) {
      const activityDate = utcDateOnly(daysAgo);
      const carrierId = carrierIds[daysAgo % carrierIds.length];
      if (!carrierId) continue;

      const carrier = await db.carrier.findUnique({ where: { id: carrierId } });
      if (!carrier) continue;

      const status = pickStatus(activityCount + daysAgo);
      const route = ROUTES[(activityCount + daysAgo) % ROUTES.length]!;
      const feePct = carrier.dispatchFeePercentage.toNumber();

      let origin: string | null = null;
      let destination: string | null = null;
      let totalMiles: number | null = null;
      let loadAmount: number | null = null;
      let ratePerMile: number | null = null;
      let dispatchFee: number | null = null;
      let reason: string | null = null;

      if (status === "DELIVERED") {
        origin = route.origin;
        destination = route.destination;
        totalMiles = route.miles + (activityCount % 40);
        loadAmount = route.amount + (activityCount % 5) * 75;
        ratePerMile = calculateRatePerMile(loadAmount, totalMiles);
        dispatchFee = calculateDispatchFee(loadAmount, feePct);
      } else {
        reason = STATUS_REASONS[(activityCount + daysAgo) % STATUS_REASONS.length]!;
      }

      await db.dailyActivity.upsert({
        where: {
          carrierId_activityDate: { carrierId, activityDate },
        },
        create: {
          organizationId: organization.id,
          activityDate,
          carrierId,
          dispatcherId: dispatcher.dispatcherId,
          teamId: dispatcher.teamId,
          status,
          carrierNameSnapshot: carrier.carrierName,
          driverNameSnapshot: carrier.driverName,
          dispatcherNameSnapshot: dispatcher.fullName,
          teamNameSnapshot: dispatcher.teamName,
          truckTypeSnapshot: carrier.truckType,
          dispatchFeePercentageSnapshot: feePct,
          origin,
          destination,
          totalMiles,
          loadAmount,
          ratePerMile,
          dispatchFee,
          reason,
          notes: status === "DELIVERED" ? "Demo delivered load" : "Demo test entry",
        },
        update: {
          status,
          origin,
          destination,
          totalMiles,
          loadAmount,
          ratePerMile,
          dispatchFee,
          reason,
          notes: status === "DELIVERED" ? "Demo delivered load" : "Demo test entry",
        },
      });

      activityCount += 1;
    }

    const today = utcDateOnly(0);
    const todayActivities = await db.dailyActivity.count({
      where: {
        dispatcherId: dispatcher.dispatcherId,
        activityDate: today,
      },
    });

    await db.dailySubmission.upsert({
      where: {
        dispatcherId_submissionDate: {
          dispatcherId: dispatcher.dispatcherId,
          submissionDate: today,
        },
      },
      create: {
        organizationId: organization.id,
        dispatcherId: dispatcher.dispatcherId,
        teamId: dispatcher.teamId,
        submissionDate: today,
        carrierCount: carrierIds.length,
        activityCount: todayActivities,
      },
      update: {
        carrierCount: carrierIds.length,
        activityCount: todayActivities,
        submittedAt: new Date(),
      },
    });
  }

  console.log("");
  console.log("Demo seed complete.");
  console.log(`Organization: ${organization.name}`);
  console.log(`Teams: ${TEAMS.join(", ")}`);
  console.log(`Dispatchers: ${DISPATCHERS.length} (Pakistani names)`);
  console.log(`Carriers: ~${dispatchers.length * 3} with MC-PK-* numbers`);
  console.log(`Activities: ${activityCount}+ entries (today + last 7 days, mixed statuses)`);
  console.log("");
  console.log("Demo dispatcher login (all use the same password):");
  console.log(`  Password: ${DEMO_PASSWORD}`);
  for (const profile of DISPATCHERS) {
    console.log(`  ${profile.fullName.padEnd(18)} → ${demoEmail(profile.emailLocal)}`);
  }
  console.log("");
  console.log("Remove later: npm run seed:demo -- --remove");
}

async function main() {
  const remove = process.argv.includes("--remove");
  const db = createDb();

  try {
    if (remove) {
      await removeDemoData(db);
    } else {
      await seedDemoData(db);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
