import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import LibraryAddCheckOutlinedIcon from '@mui/icons-material/LibraryAddCheckOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { api, ApiError } from '../api/client';
import type { BookPage, BookView } from '../api/types';
import { queryString, useDebounced } from '../api/usePage';
import { useAuth } from '../auth/AuthContext';
import { BookCover } from '../components/BookCover';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { formatDate, formatDateTime, plural } from '../format';
import { ink, paper } from '../theme';
import { BookFormDialog } from './BookFormDialog';

type Filter = 'all' | 'available' | 'mine';

const MAX_DOTS = 10;
const PAGE_SIZE = 24;

/** One little spine per copy: green on the shelf, amber held for the queue, pale when on loan. */
function CopyDots({ book }: { book: BookView }) {
  const { available, onHold } = book.availability;
  if (book.totalCopies === 0 || book.totalCopies > MAX_DOTS) return null;
  const colour = (i: number) => (i < available ? 'success.main' : i < available + onHold ? 'warning.main' : paper[300]);
  return (
    <Stack direction="row" spacing={0.4} alignItems="flex-end" aria-hidden>
      {Array.from({ length: book.totalCopies }, (_, i) => (
        <Box key={i} sx={{ width: 6, height: i % 2 ? 16 : 18, borderRadius: '2px 2px 1px 1px', bgcolor: colour(i) }} />
      ))}
    </Stack>
  );
}

function StatusLine({ icon, tone, children }: { icon: ReactNode; tone: string; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: tone, '& svg': { fontSize: 18 } }}>
      {icon}
      <Typography variant="body2" fontWeight={600} color="inherit" noWrap>
        {children}
      </Typography>
    </Stack>
  );
}

export function CataloguePage() {
  const { user } = useAuth();
  const isLibrarian = user?.role === 'librarian';
  const [books, setBooks] = useState<BookView[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<BookView | null | 'new'>(null);
  const query = useDebounced(search.trim(), 300);
  const latest = useRef(0);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const pagePath = useCallback(
    (after: string | null) => `/books${queryString({ search: query, filter: filter === 'all' ? null : filter, limit: PAGE_SIZE, cursor: after })}`,
    [query, filter],
  );

  /** First page for the current search and filter; answers to older searches are dropped. */
  const loadFirst = useCallback(() => {
    const request = ++latest.current;
    setBooks(null);
    api<BookPage>(pagePath(null))
      .then((page) => {
        if (request !== latest.current) return;
        setBooks(page.items);
        setCursor(page.nextCursor);
        setTotal(page.total);
        setError(null);
      })
      .catch((err: unknown) => request === latest.current && setError(err instanceof ApiError ? err.message : 'Could not load the catalogue'));
  }, [pagePath]);

  useEffect(loadFirst, [loadFirst]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    const request = latest.current;
    setLoadingMore(true);
    api<BookPage>(pagePath(cursor))
      .then((page) => {
        if (request !== latest.current) return;
        setBooks((current) => {
          const seen = new Set(current?.map((b) => b.id));
          return [...(current ?? []), ...page.items.filter((b) => !seen.has(b.id))];
        });
        setCursor(page.nextCursor);
        setTotal(page.total);
      })
      .catch((err: unknown) => request === latest.current && setError(err instanceof ApiError ? err.message : 'Could not load more books'))
      .finally(() => setLoadingMore(false));
  }, [cursor, loadingMore, pagePath]);

  // Fetch the next page when the end of the grid comes within a screen's height of the viewport.
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !cursor) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: '600px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  /** Re-reads one book after an action, instead of reloading every page already shown. */
  async function refreshBook(id: string) {
    const fresh = await api<BookView>(`/books/${id}`);
    setBooks((current) => current?.map((b) => (b.id === id ? fresh : b)) ?? current);
  }

  async function act(book: BookView, path: string, success: string) {
    setBusy(book.id);
    setError(null);
    try {
      await api(path, { method: 'POST' });
      setNotice(success);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
      await refreshBook(book.id).catch(() => undefined);
    }
  }

  /** The status line and the single full-width action at the bottom of each card. */
  function footer(book: BookView): { status: ReactNode; action: ReactNode } {
    const disabled = busy === book.id;
    const { available, queueLength } = book.availability;
    if (isLibrarian) {
      return {
        status: (
          <StatusLine icon={<PeopleOutlineRoundedIcon />} tone="text.secondary">
            {queueLength > 0 ? `${plural(queueLength, 'member')} waiting` : 'No queue'}
          </StatusLine>
        ),
        action: (
          <Button fullWidth variant="outlined" color="inherit" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(book)}>
            Edit book
          </Button>
        ),
      };
    }
    const borrow = () => act(book, `/books/${book.id}/checkout`, `You borrowed “${book.title}”`);
    if (book.myLoan) {
      const overdue = new Date(book.myLoan.dueAt).getTime() < Date.now();
      return {
        status: (
          <StatusLine icon={<EventOutlinedIcon />} tone={overdue ? 'error.main' : 'primary.main'}>
            {overdue ? `Overdue · was due ${formatDate(book.myLoan.dueAt)}` : `Due ${formatDate(book.myLoan.dueAt)}`}
          </StatusLine>
        ),
        action: (
          <Button fullWidth variant="outlined" color="inherit" disabled startIcon={<CheckCircleOutlineRoundedIcon />}>
            On loan to you
          </Button>
        ),
      };
    }
    const reservation = book.myReservation;
    if (reservation?.status === 'ready') {
      return {
        status: (
          <Tooltip title={`Held for you until ${formatDateTime(reservation.holdExpiresAt!)}`}>
            <span>
              <StatusLine icon={<LibraryAddCheckOutlinedIcon />} tone="warning.main">
                Held for you · until {formatDate(reservation.holdExpiresAt!)}
              </StatusLine>
            </span>
          </Tooltip>
        ),
        action: (
          <Button fullWidth variant="contained" color="warning" disabled={disabled} onClick={borrow}>
            Borrow held copy
          </Button>
        ),
      };
    }
    if (reservation?.status === 'waiting') {
      return {
        status: (
          <StatusLine icon={<HourglassTopRoundedIcon />} tone="info.main">
            You are #{reservation.position} in the queue
          </StatusLine>
        ),
        action: (
          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            disabled={disabled}
            onClick={() => act(book, `/reservations/${reservation.id}/cancel`, `You left the queue for “${book.title}”`)}
          >
            Leave queue
          </Button>
        ),
      };
    }
    if (available > 0) {
      return {
        status: (
          <StatusLine icon={<CheckCircleOutlineRoundedIcon />} tone="success.main">
            Ready to borrow
          </StatusLine>
        ),
        action: (
          <Button fullWidth variant="contained" disabled={disabled} onClick={borrow}>
            Borrow
          </Button>
        ),
      };
    }
    return {
      status: (
        <StatusLine icon={<HourglassTopRoundedIcon />} tone="text.secondary">
          {queueLength > 0 ? `All out · ${queueLength} waiting` : 'All copies are out'}
        </StatusLine>
      ),
      action: (
        <Button
          fullWidth
          variant="outlined"
          startIcon={<BookmarkAddOutlinedIcon />}
          disabled={disabled}
          onClick={() => act(book, `/books/${book.id}/reservations`, `You joined the queue for “${book.title}”`)}
        >
          Reserve
        </Button>
      ),
    };
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Catalogue"
        subtitle={isLibrarian ? 'Every book, its copies and its queue.' : 'Borrow a book, or reserve it when every copy is out.'}
        actions={
          isLibrarian && (
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditing('new')}>
              Add book
            </Button>
          )
        }
      />

      <Card sx={{ p: 1.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <TextField
            placeholder="Search by title or author"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ flexGrow: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon />
                  </InputAdornment>
                ),
              },
            }}
            aria-label="Search the catalogue"
          />
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v: Filter | null) => v && setFilter(v)} aria-label="Filter books">
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="available">Available</ToggleButton>
              {!isLibrarian && <ToggleButton value="mine">My books</ToggleButton>}
            </ToggleButtonGroup>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 72, textAlign: 'right' }}>
              {books ? plural(total, 'book') : ''}
            </Typography>
          </Stack>
        </Stack>
      </Card>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {!books && !error && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress aria-label="Loading catalogue" />
        </Box>
      )}
      {books?.length === 0 && (
        <EmptyState
          icon={<MenuBookOutlinedIcon />}
          title="No books found"
          message={query ? 'Try another title or author.' : filter !== 'all' ? 'Try another filter.' : 'Add the first book to the catalogue.'}
        />
      )}
      {books && books.length > 0 && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))' }}>
          {books.map((book) => {
            const { status, action } = footer(book);
            const { available, onLoan, onHold } = book.availability;
            return (
              <Card
                key={book.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'box-shadow .15s, border-color .15s, transform .15s',
                  '&:hover': { boxShadow: `0 10px 24px ${alpha(ink[900], 0.1)}`, borderColor: ink[300], transform: 'translateY(-2px)' },
                }}
              >
                <Stack direction="row" spacing={2} sx={{ p: 2.5, pb: 2 }}>
                  <BookCover title={book.title} width={64} />
                  <Box sx={{ minWidth: 0, flexGrow: 1, pt: 0.25 }}>
                    <Typography
                      variant="h6"
                      component="h2"
                      title={book.title}
                      sx={{ lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.5em' }}
                    >
                      {book.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap title={book.author} sx={{ fontStyle: 'italic', mt: 0.5 }}>
                      {book.author}
                    </Typography>
                  </Box>
                </Stack>

                <Stack spacing={0.75} sx={{ px: 2.5, pb: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {book.totalCopies === 0 ? 'No copies yet' : `${available} of ${book.totalCopies} available`}
                    </Typography>
                    <CopyDots book={book} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ minHeight: 20 }}>
                    {[onLoan > 0 && `${onLoan} on loan`, onHold > 0 && `${onHold} on hold`].filter(Boolean).join(' · ') || 'All copies on the shelf'}
                  </Typography>
                </Stack>

                <Box sx={{ mt: 'auto', px: 2.5, pt: 1.5, pb: 2.5, borderTop: 1, borderColor: 'divider', bgcolor: paper[100] }}>
                  <Box sx={{ height: 24, mb: 1.5, display: 'flex', alignItems: 'center' }}>{status}</Box>
                  {action}
                </Box>
              </Card>
            );
          })}
        </Box>
      )}

      {books && books.length > 0 && (
        <Stack ref={sentinel} alignItems="center" spacing={1.5} sx={{ py: 2 }}>
          {cursor ? (
            <>
              <Typography variant="body2" color="text.secondary">
                Showing {books.length} of {total}
              </Typography>
              <Button variant="outlined" color="inherit" onClick={loadMore} disabled={loadingMore} sx={{ minWidth: 160 }}>
                {loadingMore ? 'Loading…' : 'Load more books'}
              </Button>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {books.length > PAGE_SIZE ? `That's all ${plural(total, 'book')}` : ''}
            </Typography>
          )}
        </Stack>
      )}

      <BookFormDialog
        open={editing !== null}
        book={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setNotice(editing === 'new' ? `Added “${saved.title}”` : `Saved “${saved.title}”`);
          if (editing === 'new') loadFirst();
          else void refreshBook(saved.id);
          setEditing(null);
        }}
      />
      <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
