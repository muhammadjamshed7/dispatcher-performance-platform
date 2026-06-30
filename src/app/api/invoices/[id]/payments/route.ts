import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import {
  recordInvoicePayment,
  recordPaymentSchema,
} from "@/server/services/invoices.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("ADMIN");
    const { id } = await context.params;
    const body = await parseJsonBody(request, recordPaymentSchema);
    return recordInvoicePayment(scope, user, id, body);
  }, request);
}
