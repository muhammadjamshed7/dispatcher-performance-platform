type PageHeaderProps = {
  title: string;
  description?: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="border-b bg-card px-4 py-6 md:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? (
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
