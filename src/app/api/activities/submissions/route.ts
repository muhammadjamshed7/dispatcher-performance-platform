import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { DISPATCHER } from "@/lib/constants/roles";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { listDispatcherSubmissions } from "@/server/services/approvals.service";

export async function GET() {
  return handleApi(async () => {
    const { scope } = await requireAccessScope();
    if (scope.role !== DISPATCHER) {
      throw new ForbiddenError("Dispatcher access is required.");
    }
    return listDispatcherSubmissions(scope);
  });
}
