import { ActivitiesPageContent } from "@/components/activities/activities-page-content";

export const dynamic = "force-dynamic";

export default function AdminActivitiesPage() {
  return <ActivitiesPageContent showScopeAndFilters={false} />;
}
