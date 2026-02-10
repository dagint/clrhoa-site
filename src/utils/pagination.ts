/**
 * Pagination utilities for list views.
 * Provides helpers for calculating pages, limits, and offsets.
 */

export interface PaginationInfo {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  startIndex: number;
  endIndex: number;
}

/**
 * Calculate pagination metadata from query parameters.
 *
 * @param totalItems - Total number of items in the dataset
 * @param currentPage - Current page number (1-indexed)
 * @param itemsPerPage - Number of items per page
 * @returns Pagination information object
 *
 * @example
 * const pagination = calculatePagination(500, 2, 50);
 * // { currentPage: 2, totalItems: 500, itemsPerPage: 50, totalPages: 10, ... }
 */
export function calculatePagination(
  totalItems: number,
  currentPage: number = 1,
  itemsPerPage: number = 50
): PaginationInfo {
  const safePage = Math.max(1, Math.floor(currentPage));
  const safePerPage = Math.max(1, Math.min(itemsPerPage, 500)); // Max 500 per page
  const totalPages = Math.max(1, Math.ceil(totalItems / safePerPage));
  const clampedPage = Math.min(safePage, totalPages);

  const startIndex = (clampedPage - 1) * safePerPage;
  const endIndex = Math.min(startIndex + safePerPage, totalItems);

  return {
    currentPage: clampedPage,
    totalItems,
    itemsPerPage: safePerPage,
    totalPages,
    hasNextPage: clampedPage < totalPages,
    hasPrevPage: clampedPage > 1,
    startIndex,
    endIndex,
  };
}

/**
 * Get pagination offset for database queries.
 *
 * @param page - Current page (1-indexed)
 * @param limit - Items per page
 * @returns Database offset (0-indexed)
 */
export function getOffset(page: number, limit: number): number {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, limit);
  return (safePage - 1) * safeLimit;
}

/**
 * Generate array of page numbers for pagination UI.
 * Shows current page with context (e.g., [1, 2, 3, 4, 5] or [1, ..., 8, 9, 10, 11, 12, ..., 20])
 *
 * @param currentPage - Current page number
 * @param totalPages - Total number of pages
 * @param maxVisible - Maximum number of page buttons to show (default: 7)
 * @returns Array of page numbers or 'ellipsis' markers
 */
export function getPageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 7
): (number | 'ellipsis')[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];
  const halfVisible = Math.floor((maxVisible - 3) / 2); // Reserve 3 for first, last, ellipsis

  // Always show first page
  pages.push(1);

  if (currentPage <= halfVisible + 2) {
    // Near start: [1, 2, 3, 4, 5, ..., 20]
    for (let i = 2; i <= maxVisible - 2; i++) {
      pages.push(i);
    }
    pages.push('ellipsis');
  } else if (currentPage >= totalPages - halfVisible - 1) {
    // Near end: [1, ..., 16, 17, 18, 19, 20]
    pages.push('ellipsis');
    for (let i = totalPages - (maxVisible - 3); i < totalPages; i++) {
      pages.push(i);
    }
  } else {
    // Middle: [1, ..., 8, 9, 10, 11, 12, ..., 20]
    pages.push('ellipsis');
    for (let i = currentPage - halfVisible; i <= currentPage + halfVisible; i++) {
      pages.push(i);
    }
    pages.push('ellipsis');
  }

  // Always show last page
  pages.push(totalPages);

  return pages;
}
