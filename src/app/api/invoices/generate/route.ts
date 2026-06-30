import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { generateInvoice, generateInvoiceSchema } from "@/server/services/invoices.service";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("ADMIN");
    const body = await parseJsonBody(request, generateInvoiceSchema);
    return generateInvoice(scope, user, body);
  }, request);
}
