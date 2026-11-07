import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  LinearProgress,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { api, ApiError } from '../api/client';
import type { LoanView, OpenLoanPage, ReturnResult } from '../api/types';
import { queryString, useDebounced, usePage } from '../api/usePage';
import { BookCover } from '../components/BookCover';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Pager } from '../components/Pager';
import { StatCard } from '../components/StatCard';
import { StatusChip } from '../components/StatusChip';
import { UserAvatar } from '../components/UserAvatar';
import { formatDate, formatDateTime, formatMoney, plural } from '../format';
import { statGridSx } from '../theme';

function SummaryRow({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={strong ? 700 : 500} textAlign="right" color={danger ? 'error.main' : 'text.primary'}>
        {value}
      </Typography>
    </Stack>
  );
}

/** Librarian desk: open loans, soonest due first, one page at a time, with returns and the fine they charge. */
export function LoansPage() {
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [returning, setReturning] = useState<LoanView | null>(null);
  const [result, setResult] = useState<ReturnResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const query = useDebounced(search.trim(), 300);
  const { data, error, loading, reload } = usePage<OpenLoanPage>(
    `/loans${queryString({ overdue: overdueOnly, search: query, page, pageSize })}`,
  );

  async function confirmReturn() {
    if (!returning) return;
    setBusy(true);
    setActionError(null);
    try {
      setResult(await api<ReturnResult>(`/loans/${returning.id}/return`, { method: 'POST' }));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not return the loan');
    } finally {
      setBusy(false);
      setReturning(null);
      reload();
    }
  }

  const summary = data?.summary;

  return (
    <Stack spacing={3}>
      <PageHeader title="Loans & returns" subtitle="Books out now. Processing a return charges any fine and passes the copy to the queue." />

      {summary && (
        <Box sx={statGridSx}>
          <StatCard icon={<AutoStoriesOutlinedIcon />} label="On loan" value={summary.open} hint="Open loans across all members" />
          <StatCard
            icon={<WarningAmberRoundedIcon />}
            label="Overdue"
            value={summary.overdue}
            tone={summary.overdue ? 'error' : 'success'}
            hint={summary.overdue ? `Oldest ${plural(summary.oldestDaysLate, 'day')} overdue` : 'Nothing overdue'}
          />
          <StatCard
            icon={<ReceiptLongOutlinedIcon />}
            label="Fines building up"
            value={formatMoney(summary.accruingFineCents)}
            tone="error"
            hint="If every overdue book came back now"
          />
        </Box>
      )}

      {(error || actionError) && <Alert severity="error">{error ?? actionError}</Alert>}
      {result && (
        <Alert severity={result.loan.fineCents ? 'warning' : 'success'} onClose={() => setResult(null)}>
          <b>“{result.loan.book.title}”</b> returned by {result.loan.member.name}
          {result.loan.fineCents ? ` · ${plural(result.loan.daysLate, 'day')} late, fine ${formatMoney(result.loan.fineCents)}` : ' · on time, no fine'}
          {result.heldFor
            ? `. Copy ${result.loan.copyNumber} is now held for ${result.heldFor.member.name} until ${formatDateTime(result.heldFor.holdExpiresAt)}.`
            : '. The copy is back on the shelf.'}
        </Alert>
      )}

      <Card sx={{ position: 'relative' }}>
        {loading && data && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: 0, zIndex: 1 }} />}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ p: 1.5 }}>
          <TextField
            placeholder="Search by book or member"
            size="small"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            sx={{ flexGrow: 1 }}
            aria-label="Search loans"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <ToggleButtonGroup
              size="small"
              exclusive
              value={overdueOnly ? 'overdue' : 'all'}
              onChange={(_, v) => {
                if (!v) return;
                setOverdueOnly(v === 'overdue');
                setPage(1);
              }}
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="overdue">Overdue</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 72, textAlign: 'right' }}>
              {data ? plural(data.total, 'loan') : ''}
            </Typography>
          </Stack>
        </Stack>
        <Divider />
        {!data && !error && (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress aria-label="Loading loans" />
          </Box>
        )}
        {data && data.total === 0 && (
          <Box sx={{ p: 2 }}>
            <EmptyState icon={<AssignmentReturnOutlinedIcon />} title={overdueOnly ? 'Nothing overdue' : query ? 'No matching loans' : 'No books on loan'} />
          </Box>
        )}
        {data && data.total > 0 && (
          <>
            <TableContainer>
              <Table sx={{ tableLayout: 'fixed', minWidth: 820, opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '31%' }}>Book</TableCell>
                    <TableCell sx={{ width: '22%' }}>Member</TableCell>
                    <TableCell sx={{ width: '13%' }}>Borrowed</TableCell>
                    <TableCell sx={{ width: '16%' }}>Due</TableCell>
                    <TableCell sx={{ width: '9%' }} align="right">
                      Fine now
                    </TableCell>
                    <TableCell sx={{ width: '9%' }} align="right">
                      <Box component="span" sx={{ visibility: 'hidden' }}>
                        Action
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((loan) => (
                    <TableRow key={loan.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                          <BookCover title={loan.book.title} width={30} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap title={loan.book.title}>
                              {loan.book.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Copy {loan.copyNumber}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                          <UserAvatar name={loan.member.name} size={28} />
                          <Link component={RouterLink} to={`/members/${loan.member.id}`} underline="hover" color="inherit" variant="body2" noWrap>
                            {loan.member.name}
                          </Link>
                        </Stack>
                      </TableCell>
                      <TableCell>{formatDate(loan.checkedOutAt)}</TableCell>
                      <TableCell>
                        <Stack spacing={0.5} alignItems="flex-start">
                          <Typography variant="body2" color={loan.overdue ? 'error.main' : 'text.primary'} fontWeight={loan.overdue ? 650 : 400}>
                            {formatDate(loan.dueAt)}
                          </Typography>
                          {loan.overdue && <StatusChip tone="error">{plural(loan.daysLate, 'day')} overdue</StatusChip>}
                        </Stack>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontVariantNumeric: 'tabular-nums', color: loan.overdue ? 'error.main' : undefined, fontWeight: loan.overdue ? 650 : 400 }}
                      >
                        {loan.accruingFineCents ? formatMoney(loan.accruingFineCents) : '—'}
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" onClick={() => setReturning(loan)} sx={{ minWidth: 76 }}>
                          Return
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Pager
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </Card>

      <Dialog open={Boolean(returning)} onClose={() => setReturning(null)} fullWidth maxWidth="xs">
        <DialogTitle>Process this return?</DialogTitle>
        {returning && (
          <DialogContent>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ my: 2 }}>
              <BookCover title={returning.book.title} width={44} />
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={600}>{returning.book.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Copy {returning.copyNumber} · {returning.member.name}
                </Typography>
              </Box>
            </Stack>
            <Stack spacing={1} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
              <SummaryRow label="Due" value={formatDate(returning.dueAt)} danger={returning.overdue} />
              <SummaryRow label="Days late" value={returning.overdue ? String(returning.daysLate) : 'On time'} danger={returning.overdue} />
              <Divider />
              <SummaryRow label="Fine to charge" value={formatMoney(returning.accruingFineCents)} strong danger={returning.accruingFineCents > 0} />
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button color="inherit" onClick={() => setReturning(null)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={confirmReturn} disabled={busy}>
            Process return
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
