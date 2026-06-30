import { z } from "zod";

import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { cancelInvoice } from "@/server/services/invoices.service";

const cancelInvoiceSchema = z.object({
  notes: z.string().max(1000).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("ADMIN");
    const { id } = await context.params;
    const body = await parseJsonBody(request, cancelInvoiceSchema);
    return cancelInvoice(scope, user, id, body.notes);
  }, request);
}
