import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import {
  exportInvoiceListCsv,
  invoiceFiltersSchema,
} from "@/server/services/invoices.service";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("ADMIN");
    const body = await parseJsonBody(request, invoiceFiltersSchema);
    return exportInvoiceListCsv(scope, user, body);
  }, request);
}
