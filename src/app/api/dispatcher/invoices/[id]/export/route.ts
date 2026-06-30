import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import {
  exportInvoice,
  exportInvoiceSchema,
} from "@/server/services/invoices.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("DISPATCHER");
    const { id } = await context.params;
    const body = await parseJsonBody(request, exportInvoiceSchema);
    return exportInvoice(scope, user, id, body.format);
  }, request);
}
