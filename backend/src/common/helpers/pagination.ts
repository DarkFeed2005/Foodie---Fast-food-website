export interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export function getPaginationParams(pageRaw: number, limitRaw: number): PaginationParams {
  const page = pageRaw > 0 ? pageRaw : 1;
  const limit = Math.min(Math.max(limitRaw > 0 ? limitRaw : 12, 1), 100);
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function buildPaginated<T>(
  items: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / params.limit);
  return {
    items,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPrevPage: params.page > 1,
    },
  };
}
