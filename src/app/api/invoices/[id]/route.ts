import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import {
  getInvoiceDetail,
  updateInvoice,
  updateInvoiceSchema,
} from "@/server/services/invoices.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("ADMIN");
    const { id } = await context.params;
    return getInvoiceDetail(scope, user, id);
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("ADMIN");
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateInvoiceSchema);
    return updateInvoice(scope, user, id, body);
  }, request);
}
