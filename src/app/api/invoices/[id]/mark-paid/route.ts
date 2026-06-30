import { z } from "zod";

import { INVOICE_PAYMENT_METHODS } from "@/lib/constants/invoices";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { markInvoicePaid } from "@/server/services/invoices.service";

const markPaidSchema = z.object({
  paymentDate: z.string().optional(),
  paymentMethod: z.enum(INVOICE_PAYMENT_METHODS).optional(),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("ADMIN");
    const { id } = await context.params;
    const body = await parseJsonBody(request, markPaidSchema);
    return markInvoicePaid(scope, user, id, body);
  }, request);
}
