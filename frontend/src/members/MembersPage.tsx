import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  CircularProgress,
  Divider,
  InputAdornment,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import type { MemberPage } from '../api/types';
import { queryString, useDebounced, usePage } from '../api/usePage';
import { PageHeader } from '../components/PageHeader';
import { Pager } from '../components/Pager';
import { StatCard } from '../components/StatCard';
import { StatusChip } from '../components/StatusChip';
import { UserAvatar } from '../components/UserAvatar';
import { formatMoney, plural } from '../format';
import { statGridSx } from '../theme';

export function MembersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const query = useDebounced(search.trim(), 300);
  const { data, error, loading } = usePage<MemberPage>(`/members${queryString({ search: query, page, pageSize })}`);
  const summary = data?.summary;

  return (
    <Stack spacing={3}>
      <PageHeader title="Members" subtitle="Open a member to see their account or record a fine payment." />

      {summary && (
        <Box sx={statGridSx}>
          <StatCard icon={<GroupsOutlinedIcon />} label="Members" value={summary.members} hint={`${plural(summary.booksOnLoan, 'book')} on loan`} />
          <StatCard
            icon={<ReceiptLongOutlinedIcon />}
            label="Unpaid fines"
            value={formatMoney(summary.unpaidCents)}
            tone="warning"
            hint={`${plural(summary.owing, 'member')} owe something`}
          />
          <StatCard
            icon={<BlockRoundedIcon />}
            label="Blocked"
            value={summary.blocked}
            tone={summary.blocked ? 'error' : 'success'}
            hint="Over the fine threshold"
          />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      <Card sx={{ position: 'relative' }}>
        {loading && data && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: 0, zIndex: 1 }} />}
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 1.5 }}>
          <TextField
            placeholder="Search by name or email"
            size="small"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            sx={{ flexGrow: 1 }}
            aria-label="Search members"
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
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 88, textAlign: 'right' }}>
            {data ? plural(data.total, 'member') : ''}
          </Typography>
        </Stack>
        <Divider />
        {!data && !error && (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress aria-label="Loading members" />
          </Box>
        )}
        {data && data.total === 0 && (
          <Typography color="text.secondary" variant="body2" sx={{ py: 6, textAlign: 'center' }}>
            No members match “{query}”.
          </Typography>
        )}
        {data && data.total > 0 && (
          <>
            <TableContainer>
              <Table sx={{ tableLayout: 'fixed', minWidth: 760, opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '36%' }}>Member</TableCell>
                    <TableCell sx={{ width: '12%' }} align="center">
                      On loan
                    </TableCell>
                    <TableCell sx={{ width: '12%' }} align="center">
                      Overdue
                    </TableCell>
                    <TableCell sx={{ width: '14%' }} align="center">
                      Reservations
                    </TableCell>
                    <TableCell sx={{ width: '20%' }} align="right">
                      Unpaid fines
                    </TableCell>
                    <TableCell sx={{ width: '6%' }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((m) => (
                    <TableRow key={m.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/members/${m.id}`)}>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                          <UserAvatar name={m.name} size={36} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {m.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap component="div">
                              {m.email}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="center">{m.openLoans}</TableCell>
                      <TableCell align="center">{m.overdueLoans ? <StatusChip tone="error">{m.overdueLoans}</StatusChip> : '—'}</TableCell>
                      <TableCell align="center">{m.activeReservations || '—'}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          {m.blocked && <StatusChip tone="error">Blocked</StatusChip>}
                          <Typography variant="body2" fontWeight={m.balanceCents ? 600 : 400} sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 64 }}>
                            {formatMoney(m.balanceCents)}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>
                        <ChevronRightRoundedIcon fontSize="small" sx={{ verticalAlign: 'middle' }} />
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
    </Stack>
  );
}
