/** Minimal Supabase query surface for scoped filter helpers (avoids `any`). */
export type FilterableQuery = {
  eq: (column: string, value: string | number | boolean) => FilterableQuery;
  is: (column: string, value: null) => FilterableQuery;
  in: (column: string, values: readonly string[]) => FilterableQuery;
  gte: (column: string, value: string) => FilterableQuery;
  lte: (column: string, value: string) => FilterableQuery;
  or: (
    filters: string,
    options?: { referencedTable?: string },
  ) => FilterableQuery;
};

export type DbQueryResult = PromiseLike<{
  data: unknown;
  error: { message: string; code?: string } | null;
}>;

export function asFilterable<T>(query: T): FilterableQuery & T {
  return query as FilterableQuery & T;
}

export function applyScopeWhere<T extends FilterableQuery>(
  query: T,
  scopeFields: Record<string, string | null | undefined>,
): T {
  let scoped: FilterableQuery = query;

  for (const [column, value] of Object.entries(scopeFields)) {
    if (value === undefined) {
      continue;
    }

    if (value === null) {
      scoped = scoped.is(column, null);
    } else {
      scoped = scoped.eq(column, value);
    }
  }

  return scoped as T;
}
