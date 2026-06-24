import { DispatcherFinancePageContent } from "@/components/finance/dispatcher-finance-page-content";

type AdminDispatcherFinancePageProps = {
  params: Promise<{ dispatcherId: string }>;
};

export default async function AdminDispatcherFinancePage({
  params,
}: AdminDispatcherFinancePageProps) {
  const { dispatcherId } = await params;

  return (
    <DispatcherFinancePageContent
      variant="admin"
      dispatcherId={dispatcherId}
      backHref="/admin/dispatchers"
    />
  );
}
