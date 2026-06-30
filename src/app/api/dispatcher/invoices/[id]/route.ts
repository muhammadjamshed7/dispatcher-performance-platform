import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { getInvoiceDetail } from "@/server/services/invoices.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("DISPATCHER");
    const { id } = await context.params;
    return getInvoiceDetail(scope, user, id);
  });
}
