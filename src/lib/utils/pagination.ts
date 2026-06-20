export type PaginationInput = {
  page: number;
  pageSize: number;
  total: number;
};

export type PaginationResult = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  offset: number;
};

export function getPagination({
  page,
  pageSize,
  total,
}: PaginationInput): PaginationResult {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    page,
    pageSize,
    total,
    totalPages,
    offset: (page - 1) * pageSize,
  };
}
