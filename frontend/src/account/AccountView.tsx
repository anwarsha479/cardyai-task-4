import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Divider,
  LinearProgress,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { Account, LoanView, Page, PaymentView, ReservationView } from '../api/types';
import { usePage } from '../api/usePage';
import { BookCover } from '../components/BookCover';
import { Pager } from '../components/Pager';
import { StatCard } from '../components/StatCard';
import { StatusChip } from '../components/StatusChip';
import { formatDate, formatDateTime, formatMoney, plural } from '../format';
import { statGridSx } from '../theme';

type TabKey = 'loans' | 'reservations' | 'fines' | 'history';

interface Column {
  label: string;
  width: string;
  align?: 'right';
}

/** Same column widths in every table, so the tabs line up. */
const COLUMN_WIDTHS = ['42%', '17%', '25%', '16%'];

function columns(...labels: string[]): Column[] {
  return labels.map((label, i) => ({ label, width: COLUMN_WIDTHS[i], align: i === labels.length - 1 ? 'right' : undefined }));
}

function BookCell({ title, sub }: { title: string; sub: string }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
      <BookCover title={title} width={30} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap title={title}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {sub}
        </Typography>
      </Box>
    </Stack>
  );
}

/** Due date, in red with the days late once it has passed. */
export function DueCell({ loan }: { loan: LoanView }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      <Typography variant="body2" color={loan.overdue ? 'error.main' : 'text.primary'} fontWeight={loan.overdue ? 650 : 400}>
        {formatDate(loan.dueAt)}
      </Typography>
      {loan.overdue ? <StatusChip tone="error">{plural(loan.daysLate, 'day')} overdue</StatusChip> : <StatusChip tone="success">On time</StatusChip>}
    </Stack>
  );
}

interface PagedTableProps<T> {
  path: string;
  refreshKey: number;
  columns: Column[];
  empty: string;
  initialPageSize?: number;
  row(item: T): ReactNode;
}

/** A table that loads one page at a time from `path` and shows page controls underneath. */
function PagedTable<T extends { id: string }>({ path, refreshKey, columns: cols, empty, initialPageSize = 10, row }: PagedTableProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const { data, error, loading, reload } = usePage<Page<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=${pageSize}`);

  useEffect(() => {
    if (refreshKey > 0) reload();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // After the last row of a page is removed (e.g. a cancelled reservation), step back a page.
  useEffect(() => {
    if (data && data.items.length === 0 && data.page > 1) setPage(data.page - 1);
  }, [data]);

  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  if (!data)
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
        <CircularProgress size={28} aria-label="Loading" />
      </Box>
    );
  if (data.total === 0)
    return (
      <Typography color="text.secondary" variant="body2" sx={{ py: 6, textAlign: 'center' }}>
        {empty}
      </Typography>
    );
  return (
    <Box sx={{ position: 'relative' }}>
      {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: 0, zIndex: 1 }} />}
      <TableContainer>
        <Table sx={{ tableLayout: 'fixed', minWidth: 680, opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          <TableHead>
            <TableRow>
              {cols.map((c) => (
                <TableCell key={c.label} sx={{ width: c.width }} align={c.align}>
                  {c.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>{data.items.map(row)}</TableBody>
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
    </Box>
  );
}

function reservationChip(r: ReservationView) {
  if (r.status === 'ready') return <StatusChip tone="warning">Ready · copy {r.heldCopyNumber}</StatusChip>;
  if (r.status === 'waiting') return <StatusChip tone="info">#{r.position} in queue</StatusChip>;
  return <StatusChip>{r.status}</StatusChip>;
}

interface Props {
  account: Account;
  /** Bump to reload the lists after a change made outside this view (e.g. a payment). */
  refreshKey?: number;
  /** Shown only to the member themself. */
  onCancelReservation?(reservation: ReservationView): void;
  busy?: boolean;
}

/** Loans, due dates, fines, payments and reservations for one member (LL-07). Every list is paged by the server. */
export function AccountView({ account, refreshKey = 0, onCancelReservation, busy }: Props) {
  const [tab, setTab] = useState<TabKey>('loans');
  const { limits, counts } = account;
  const base = `/members/${account.member.id}`;
  const ready = account.readyReservations;

  return (
    <Stack spacing={3}>
      {account.blocked && (
        <Alert severity="error">
          Unpaid fines of <b>{formatMoney(account.balanceCents)}</b> are over the {formatMoney(limits.fineBlockThresholdCents)} limit. Borrowing and
          reserving are blocked until a payment is made at the desk.
        </Alert>
      )}
      {ready.length > 0 && (
        <Alert severity="warning">
          {ready.map((r) => `“${r.book.title}”`).join(', ')} {ready.length === 1 ? 'is' : 'are'} waiting for you. Borrow from the catalogue before
          the hold ends, or it passes to the next member.
        </Alert>
      )}

      <Box sx={statGridSx}>
        <StatCard
          icon={<AutoStoriesOutlinedIcon />}
          label="Books on loan"
          value={`${counts.openLoans} of ${limits.maxActiveLoans}`}
          hint={`${limits.loanPeriodDays}-day loan period`}
        />
        <StatCard
          icon={<WarningAmberRoundedIcon />}
          label="Overdue"
          value={counts.overdueLoans}
          tone={counts.overdueLoans ? 'error' : 'success'}
          hint={account.accruingFineCents ? `${formatMoney(account.accruingFineCents)} building up` : 'Nothing overdue'}
        />
        <StatCard
          icon={<ReceiptLongOutlinedIcon />}
          label="Unpaid fines"
          value={formatMoney(account.balanceCents)}
          tone={account.blocked ? 'error' : 'primary'}
          hint={`Borrowing stops above ${formatMoney(limits.fineBlockThresholdCents)}`}
        />
        <StatCard
          icon={<BookmarkBorderRoundedIcon />}
          label="Reservations"
          value={counts.reservations}
          tone="info"
          hint={`Holds last ${plural(limits.reservationHoldHours, 'hour')}`}
        />
      </Box>

      <Card>
        <Tabs value={tab} onChange={(_, v: TabKey) => setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ px: { xs: 1, sm: 2 } }}>
          <Tab value="loans" label={`On loan (${counts.openLoans})`} />
          <Tab value="reservations" label={`Reservations (${counts.reservations})`} />
          <Tab value="fines" label={`Fines & payments (${counts.finedLoans + counts.payments})`} />
          <Tab value="history" label={`History (${counts.returnedLoans})`} />
        </Tabs>
        <Divider />

        {tab === 'loans' && (
          <PagedTable<LoanView>
            path={`${base}/loans?state=open`}
            refreshKey={refreshKey}
            columns={columns('Book', 'Borrowed', 'Due', 'Fine so far')}
            empty="No books on loan."
            row={(loan) => (
              <TableRow key={loan.id} hover>
                <TableCell>
                  <BookCell title={loan.book.title} sub={`${loan.book.author} · copy ${loan.copyNumber}`} />
                </TableCell>
                <TableCell>{formatDate(loan.checkedOutAt)}</TableCell>
                <TableCell>
                  <DueCell loan={loan} />
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: loan.overdue ? 'error.main' : undefined, fontWeight: loan.overdue ? 650 : 400 }}>
                  {loan.overdue ? formatMoney(loan.accruingFineCents) : '—'}
                </TableCell>
              </TableRow>
            )}
          />
        )}

        {tab === 'reservations' && (
          <PagedTable<ReservationView>
            path={`${base}/reservations`}
            refreshKey={refreshKey}
            columns={columns('Book', 'Reserved', 'Status', onCancelReservation ? 'Action' : 'Hold ends')}
            empty="No reservations. Reserve a book from the catalogue when every copy is out."
            row={(r) => (
              <TableRow key={r.id} hover>
                <TableCell>
                  <BookCell title={r.book.title} sub={r.book.author} />
                </TableCell>
                <TableCell>{formatDate(r.createdAt)}</TableCell>
                <TableCell>
                  <Stack spacing={0.5} alignItems="flex-start">
                    {reservationChip(r)}
                    {r.status === 'ready' && r.holdExpiresAt && (
                      <Typography variant="caption" color="text.secondary">
                        Until {formatDateTime(r.holdExpiresAt)}
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  {onCancelReservation ? (
                    <Button size="small" variant="outlined" color="error" disabled={busy} onClick={() => onCancelReservation(r)} sx={{ minWidth: 84 }}>
                      Cancel
                    </Button>
                  ) : r.status === 'ready' && r.holdExpiresAt ? (
                    formatDate(r.holdExpiresAt)
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            )}
          />
        )}

        {tab === 'fines' && (
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', py: 2.5 }}>
              {(
                [
                  ['Charged', account.totalFinesCents],
                  ['Paid', account.totalPaidCents],
                  ['Still due', account.balanceCents],
                ] as const
              ).map(([label, cents], i) => (
                <Box key={label} sx={{ borderLeft: i ? 1 : 0, borderColor: 'divider' }}>
                  <Typography variant="overline" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="h6" color={i === 2 && account.balanceCents > 0 ? 'error.main' : 'text.primary'}>
                    {formatMoney(cents)}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Divider />
            <Typography variant="subtitle2" sx={{ px: { xs: 2, sm: 2.5 }, pt: 2, pb: 1 }}>
              Fines charged
            </Typography>
            <PagedTable<LoanView>
              path={`${base}/loans?state=fined`}
              refreshKey={refreshKey}
              initialPageSize={5}
              columns={columns('Book', 'Due', 'Returned', 'Fine')}
              empty="No fines charged."
              row={(loan) => (
                <TableRow key={loan.id} hover>
                  <TableCell>
                    <BookCell title={loan.book.title} sub={loan.book.author} />
                  </TableCell>
                  <TableCell>{formatDate(loan.dueAt)}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{formatDate(loan.returnedAt!)}</span>
                      <StatusChip tone="warning">{plural(loan.daysLate, 'day')} late</StatusChip>
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(loan.fineCents)}
                  </TableCell>
                </TableRow>
              )}
            />
            <Divider />
            <Typography variant="subtitle2" sx={{ px: { xs: 2, sm: 2.5 }, pt: 2, pb: 1 }}>
              Payments
            </Typography>
            <PagedTable<PaymentView>
              path={`${base}/payments`}
              refreshKey={refreshKey}
              initialPageSize={5}
              columns={columns('Note', 'Date', 'Recorded by', 'Amount')}
              empty="No payments recorded."
              row={(p) => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.note ?? '—'}</TableCell>
                  <TableCell>{formatDate(p.createdAt)}</TableCell>
                  <TableCell>{p.recordedBy}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'success.main', fontWeight: 600 }}>
                    {formatMoney(p.amountCents)}
                  </TableCell>
                </TableRow>
              )}
            />
          </Box>
        )}

        {tab === 'history' && (
          <PagedTable<LoanView>
            path={`${base}/loans?state=returned`}
            refreshKey={refreshKey}
            columns={columns('Book', 'Borrowed', 'Returned', 'Fine')}
            empty="Nothing returned yet."
            row={(loan) => (
              <TableRow key={loan.id} hover>
                <TableCell>
                  <BookCell title={loan.book.title} sub={loan.book.author} />
                </TableCell>
                <TableCell>{formatDate(loan.checkedOutAt)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{formatDate(loan.returnedAt!)}</span>
                    {loan.daysLate > 0 ? <StatusChip tone="warning">{plural(loan.daysLate, 'day')} late</StatusChip> : <StatusChip tone="success">On time</StatusChip>}
                  </Stack>
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {loan.fineCents ? formatMoney(loan.fineCents) : '—'}
                </TableCell>
              </TableRow>
            )}
          />
        )}
      </Card>
    </Stack>
  );
}
