import { Suspense } from "react";

import { PendingApprovalsPageContent } from "@/components/activities/pending-approvals-page-content";

export const dynamic = "force-dynamic";

export default function AdminPendingApprovalsPage() {
  return (
    <Suspense fallback={<div className="py-10 text-sm text-[#64748B]">Loading pending approvals...</div>}>
      <PendingApprovalsPageContent />
    </Suspense>
  );
}
