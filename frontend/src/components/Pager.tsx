import { TablePagination } from '@mui/material';

export const PAGE_SIZES = [5, 10, 25, 50];

interface Props {
  /** 1-based, like the API. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange(page: number): void;
  onPageSizeChange(pageSize: number): void;
}

/** Page controls under a table: rows per page, "11–20 of 87", previous and next. */
export function Pager({ page, pageSize, total, onPageChange, onPageSizeChange }: Props) {
  return (
    <TablePagination
      component="div"
      count={total}
      page={Math.max(0, page - 1)}
      rowsPerPage={pageSize}
      rowsPerPageOptions={PAGE_SIZES}
      onPageChange={(_, next) => onPageChange(next + 1)}
      onRowsPerPageChange={(e) => onPageSizeChange(Number(e.target.value))}
      labelRowsPerPage="Rows per page"
      showFirstButton
      showLastButton
      sx={{ borderTop: 1, borderColor: 'divider', '& .MuiTablePagination-toolbar': { minHeight: 56 } }}
    />
  );
}
