import { parseSearchParams } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { invoiceFiltersSchema, listInvoices } from "@/server/services/invoices.service";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("ADMIN");
    const url = new URL(request.url);
    const filters = parseSearchParams(url.searchParams, invoiceFiltersSchema);
    return listInvoices(scope, user, filters);
  });
}
