import { z } from "zod";

// Runtime ids are generated with crypto.randomUUID() (see createId in
// src/lib/db/utils.ts). The Prisma schema still declares @default(cuid()),
// so accept both UUID and legacy CUID formats to avoid 500s on valid ids.
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const CUID_PATTERN = /^[cC][0-9a-z]{6,}$/;

export const idSchema = z
  .string()
  .trim()
  .refine((value) => UUID_PATTERN.test(value) || CUID_PATTERN.test(value), {
    message: "Invalid id.",
  });
