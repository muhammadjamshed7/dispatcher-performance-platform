// Database access: Supabase (service role) for all runtime backend queries.
export { db, T } from "@/lib/db/client";
export type * from "@/lib/db/types";
export {
  assertDb,
  assertDbVoid,
  countRows,
  createId,
  decimalToNumber,
  nowIso,
  toDateOnly,
  toIsoString,
} from "@/lib/db/utils";
