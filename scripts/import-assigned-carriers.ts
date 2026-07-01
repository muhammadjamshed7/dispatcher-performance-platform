import "dotenv/config";

import {
  PrismaClient,
  type Carrier,
  type Dispatcher,
  type Organization,
  type Team,
  type User,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const DEFAULT_TRUCK_TYPE = "DRY_VAN";
const DEFAULT_DISPATCH_FEE_PERCENTAGE = 10;
const PLACEHOLDER_DRIVER_NAME = "TBD";

const ASSIGNMENTS = [
  { carrierName: "Brain", dispatcherName: "Ali" },
  { carrierName: "Doug Moody", dispatcherName: "Ali" },
  { carrierName: "Darren", dispatcherName: "Ali" },
  { carrierName: "Victor", dispatcherName: "Zeerak" },
  { carrierName: "Demetrius Hawkins", dispatcherName: "Ghulam Mustafa" },
  { carrierName: "Iuqman", dispatcherName: "Ghulam Mustafa" },
  { carrierName: "Frederick carney", dispatcherName: "Ghulam Mustafa" },
  { carrierName: "Daylen", dispatcherName: "Ghulam Mustafa" },
  { carrierName: "Steven", dispatcherName: "Bilalalam" },
  { carrierName: "James adam", dispatcherName: "Bilalalam" },
  { carrierName: "Jonathan Lucas", dispatcherName: "Bilalalam" },
  { carrierName: "Milton", dispatcherName: "Zunair" },
  { carrierName: "Damien", dispatcherName: "Zunair" },
  { carrierName: "Talisaj", dispatcherName: "Zunair" },
  { carrierName: "Anthony", dispatcherName: "Mateen" },
  { carrierName: "Julian", dispatcherName: "Mateen" },
  { carrierName: "Max", dispatcherName: "Mateen" },
  { carrierName: "Troneyans", dispatcherName: "Mateen" },
  { carrierName: "D’angelo", dispatcherName: "Rafey" },
  { carrierName: "James Boyce", dispatcherName: "Mohammad Ibrahim" },
  { carrierName: "Fairilia Turner", dispatcherName: "Mohammad Ibrahim" },
  { carrierName: "Henry", dispatcherName: "Mughees" },
  { carrierName: "Courtney Lynch", dispatcherName: "Khalifa Ahmed" },
  { carrierName: "Gary", dispatcherName: "Khalifa Ahmed" },
  { carrierName: "Brandy/Todd", dispatcherName: "Mutahir" },
  { carrierName: "Nathan", dispatcherName: "Abdul rehman" },
] as const;

type DispatcherRecord = Dispatcher & {
  team: Team;
  user: User;
};

type CarrierRecord = Carrier & {
  dispatcher?: (Dispatcher & { user: Pick<User, "fullName"> }) | null;
};

type ImportReport = {
  added: string[];
  alreadyExisting: string[];
  updated: string[];
  missingDispatchers: string[];
  failed: Array<{ carrierName: string; reason: string }>;
};

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

function normalizeKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactKey(value: string): string {
  return normalizeKey(value).replace(/\s+/g, "");
}

function createMcBase(carrierName: string): string {
  const slug = normalizeKey(carrierName).replace(/\s+/g, "-");
  return `PENDING-${slug || "carrier"}`.toUpperCase();
}

async function createUniqueMcNumber(
  db: PrismaClient,
  organizationId: string,
  carrierName: string,
): Promise<string> {
  const base = createMcBase(carrierName);
  let candidate = base;
  let suffix = 1;

  while (
    await db.carrier.findUnique({
      where: {
        organizationId_mcNumber: {
          organizationId,
          mcNumber: candidate,
        },
      },
      select: { id: true },
    })
  ) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

function addUnique(list: string[], value: string) {
  if (!list.includes(value)) {
    list.push(value);
  }
}

function findDispatcher(
  dispatchers: DispatcherRecord[],
  requestedName: string,
): DispatcherRecord | null | "ambiguous" {
  const requestedKey = normalizeKey(requestedName);
  const exactMatches = dispatchers.filter(
    (dispatcher) => normalizeKey(dispatcher.user.fullName) === requestedKey,
  );

  if (exactMatches.length === 1) {
    return exactMatches[0]!;
  }

  if (exactMatches.length > 1) {
    return "ambiguous";
  }

  const requestedTokens = requestedKey.split(" ").filter(Boolean);
  if (requestedTokens.length !== 1) {
    return null;
  }

  const tokenMatches = dispatchers.filter((dispatcher) =>
    normalizeKey(dispatcher.user.fullName).split(" ").includes(requestedKey),
  );

  if (tokenMatches.length === 1) {
    return tokenMatches[0]!;
  }

  return tokenMatches.length > 1 ? "ambiguous" : null;
}

function findCarrier(
  carriers: CarrierRecord[],
  requestedName: string,
): CarrierRecord | null | "ambiguous" {
  const requestedCompactKey = compactKey(requestedName);
  const matches = carriers.filter(
    (carrier) => compactKey(carrier.carrierName) === requestedCompactKey,
  );

  if (matches.length === 1) {
    return matches[0]!;
  }

  return matches.length > 1 ? "ambiguous" : null;
}

async function getOrganization(db: PrismaClient): Promise<Organization> {
  const orgSlugArg = process.argv.find((arg) =>
    arg.startsWith("--organization-slug="),
  );
  const orgSlug = orgSlugArg?.split("=").slice(1).join("=").trim();

  if (orgSlug) {
    const organization = await db.organization.findFirst({
      where: { slug: orgSlug, deletedAt: null },
    });

    if (!organization) {
      throw new Error(`No active organization found for slug "${orgSlug}".`);
    }

    return organization;
  }

  const organizations = await db.organization.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (organizations.length === 0) {
    throw new Error("No active organization found.");
  }

  if (organizations.length > 1) {
    throw new Error(
      `Multiple active organizations found. Re-run with --organization-slug=<slug>. Available slugs: ${organizations
        .map((organization) => organization.slug)
        .join(", ")}`,
    );
  }

  return organizations[0]!;
}

async function getActorUserId(
  db: PrismaClient,
  organizationId: string,
): Promise<string> {
  const actor = await db.user.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      status: "ACTIVE",
      role: { in: ["ADMIN", "TEAM_LEAD", "DISPATCHER"] },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  if (!actor) {
    throw new Error("No active user found to record assignment history.");
  }

  return actor.id;
}

async function importCarriers(db: PrismaClient): Promise<ImportReport> {
  const organization = await getOrganization(db);
  const actorUserId = await getActorUserId(db, organization.id);

  const settings = await db.organizationSettings.findUnique({
    where: { organizationId: organization.id },
    select: { defaultDispatchFeePercent: true },
  });
  const dispatchFeePercentage =
    settings?.defaultDispatchFeePercent.toNumber() ??
    DEFAULT_DISPATCH_FEE_PERCENTAGE;

  const dispatchers = await db.dispatcher.findMany({
    where: {
      organizationId: organization.id,
      deletedAt: null,
      status: "ACTIVE",
      team: { deletedAt: null, status: "ACTIVE" },
      user: { deletedAt: null },
    },
    include: { team: true, user: true },
  });

  const carriers: CarrierRecord[] = await db.carrier.findMany({
    where: { organizationId: organization.id },
    include: {
      dispatcher: { include: { user: { select: { fullName: true } } } },
    },
  });

  const report: ImportReport = {
    added: [],
    alreadyExisting: [],
    updated: [],
    missingDispatchers: [],
    failed: [],
  };

  for (const assignment of ASSIGNMENTS) {
    try {
      const dispatcher = findDispatcher(dispatchers, assignment.dispatcherName);

      if (!dispatcher) {
        addUnique(report.missingDispatchers, assignment.dispatcherName);
        continue;
      }

      if (dispatcher === "ambiguous") {
        report.failed.push({
          carrierName: assignment.carrierName,
          reason: `Dispatcher "${assignment.dispatcherName}" matched multiple users.`,
        });
        continue;
      }

      const existingCarrier = findCarrier(carriers, assignment.carrierName);

      if (existingCarrier === "ambiguous") {
        report.failed.push({
          carrierName: assignment.carrierName,
          reason: "Carrier name matched multiple existing records.",
        });
        continue;
      }

      if (!existingCarrier) {
        const mcNumber = await createUniqueMcNumber(
          db,
          organization.id,
          assignment.carrierName,
        );

        const carrier = await db.$transaction(async (tx) => {
          const created = await tx.carrier.create({
            data: {
              organizationId: organization.id,
              carrierName: assignment.carrierName,
              driverName: PLACEHOLDER_DRIVER_NAME,
              mcNumber,
              truckType: DEFAULT_TRUCK_TYPE,
              teamId: dispatcher.teamId,
              dispatcherId: dispatcher.id,
              dispatchFeePercentage,
              status: "INACTIVE",
            },
          });

          await tx.carrierAssignmentHistory.create({
            data: {
              organizationId: organization.id,
              carrierId: created.id,
              teamId: dispatcher.teamId,
              dispatcherId: dispatcher.id,
              teamNameSnapshot: dispatcher.team.name,
              dispatcherNameSnapshot: dispatcher.user.fullName,
              assignedByUserId: actorUserId,
              notes: "Initial placeholder import.",
            },
          });

          await tx.auditLog.create({
            data: {
              organizationId: organization.id,
              actorUserId,
              action: "CARRIER_CREATED",
              entityType: "Carrier",
              entityId: created.id,
              metadata: {
                entityName: assignment.carrierName,
                carrierName: assignment.carrierName,
                mcNumber,
                teamId: dispatcher.teamId,
                teamName: dispatcher.team.name,
                dispatcherId: dispatcher.id,
                dispatcherName: dispatcher.user.fullName,
                importSource: "scripts/import-assigned-carriers.ts",
              },
            },
          });

          return created;
        });

        carriers.push(carrier);
        report.added.push(
          `${assignment.carrierName} -> ${dispatcher.user.fullName}`,
        );
        continue;
      }

      const shouldCorrectPlaceholderName =
        existingCarrier.carrierName !== assignment.carrierName &&
        existingCarrier.driverName === PLACEHOLDER_DRIVER_NAME &&
        existingCarrier.mcNumber.startsWith("PENDING-");

      if (
        existingCarrier.dispatcherId === dispatcher.id &&
        existingCarrier.teamId === dispatcher.teamId
      ) {
        if (shouldCorrectPlaceholderName) {
          const previousCarrierName = existingCarrier.carrierName;

          await db.$transaction(async (tx) => {
            await tx.carrier.update({
              where: { id: existingCarrier.id },
              data: { carrierName: assignment.carrierName },
            });

            await tx.auditLog.create({
              data: {
                organizationId: organization.id,
                actorUserId,
                action: "CARRIER_UPDATED",
                entityType: "Carrier",
                entityId: existingCarrier.id,
                metadata: {
                  entityName: assignment.carrierName,
                  oldData: { carrierName: previousCarrierName },
                  newData: { carrierName: assignment.carrierName },
                  changedFields: ["carrierName"],
                  importSource: "scripts/import-assigned-carriers.ts",
                },
              },
            });
          });

          existingCarrier.carrierName = assignment.carrierName;
          report.updated.push(
            `${previousCarrierName} -> ${assignment.carrierName}`,
          );
          continue;
        }

        report.alreadyExisting.push(
          `${assignment.carrierName} -> ${dispatcher.user.fullName}`,
        );
        continue;
      }

      const previousDispatcherName =
        existingCarrier.dispatcher?.user.fullName ?? null;

      await db.$transaction(async (tx) => {
        await tx.carrierAssignmentHistory.updateMany({
          where: { carrierId: existingCarrier.id, unassignedAt: null },
          data: { unassignedAt: new Date() },
        });

        await tx.carrierAssignmentHistory.create({
          data: {
            organizationId: organization.id,
            carrierId: existingCarrier.id,
            teamId: dispatcher.teamId,
            dispatcherId: dispatcher.id,
            teamNameSnapshot: dispatcher.team.name,
            dispatcherNameSnapshot: dispatcher.user.fullName,
            assignedByUserId: actorUserId,
            notes: "Assignment corrected by placeholder carrier import.",
          },
        });

        await tx.carrier.update({
          where: { id: existingCarrier.id },
          data: {
            ...(shouldCorrectPlaceholderName
              ? { carrierName: assignment.carrierName }
              : {}),
            teamId: dispatcher.teamId,
            dispatcherId: dispatcher.id,
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId: organization.id,
            actorUserId,
            action: "CARRIER_REASSIGNED",
            entityType: "Carrier",
            entityId: existingCarrier.id,
            metadata: {
              entityName: existingCarrier.carrierName,
              oldData: {
                teamId: existingCarrier.teamId,
                dispatcherId: existingCarrier.dispatcherId,
                dispatcherName: previousDispatcherName,
              },
              newData: {
                teamId: dispatcher.teamId,
                dispatcherId: dispatcher.id,
                teamName: dispatcher.team.name,
                dispatcherName: dispatcher.user.fullName,
              },
              importSource: "scripts/import-assigned-carriers.ts",
            },
          },
        });
      });

      existingCarrier.teamId = dispatcher.teamId;
      existingCarrier.dispatcherId = dispatcher.id;
      existingCarrier.dispatcher = {
        ...dispatcher,
        user: { fullName: dispatcher.user.fullName },
      };
      report.updated.push(
        `${assignment.carrierName}: ${previousDispatcherName ?? "unassigned"} -> ${dispatcher.user.fullName}`,
      );
    } catch (error) {
      report.failed.push({
        carrierName: assignment.carrierName,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return report;
}

function printReport(report: ImportReport) {
  console.log("Carrier import complete.");
  console.log(`Carriers added (${report.added.length}):`);
  report.added.forEach((item) => console.log(`- ${item}`));
  console.log(`Carriers already existing (${report.alreadyExisting.length}):`);
  report.alreadyExisting.forEach((item) => console.log(`- ${item}`));
  console.log(`Carriers updated (${report.updated.length}):`);
  report.updated.forEach((item) => console.log(`- ${item}`));
  console.log(`Missing dispatchers (${report.missingDispatchers.length}):`);
  report.missingDispatchers.forEach((item) => console.log(`- ${item}`));
  console.log(`Failed records (${report.failed.length}):`);
  report.failed.forEach((item) =>
    console.log(`- ${item.carrierName}: ${item.reason}`),
  );
}

async function main() {
  const db = createDb();

  try {
    const report = await importCarriers(db);
    printReport(report);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
