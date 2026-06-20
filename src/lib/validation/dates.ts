import { z } from "zod";

export const dateRangeSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
});
