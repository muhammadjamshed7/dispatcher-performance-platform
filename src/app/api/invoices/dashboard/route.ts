import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { getInvoiceDashboard } from "@/server/services/invoices.service";

export async function GET() {
  return handleApi(async () => {
    const { scope } = await requireAccessScope("ADMIN");
    return getInvoiceDashboard(scope);
  });
}
