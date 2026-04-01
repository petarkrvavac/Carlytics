export function getVisiblePages(currentPage: number, totalPages: number, siblingCount = 1) {
  const pages = new Set<number>([1, totalPages, currentPage]);

  for (let offset = 1; offset <= siblingCount; offset += 1) {
    pages.add(currentPage - offset);
    pages.add(currentPage + offset);
  }

  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
}