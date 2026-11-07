import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';
import LocalLibraryOutlinedIcon from '@mui/icons-material/LocalLibraryOutlined';
import { api, ApiError } from '../api/client';
import type { Account, ReservationView } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { UserAvatar } from '../components/UserAvatar';
import { AccountView } from './AccountView';

/** The member's own page: loans, due dates, fines and reservations. */
export function AccountPage() {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => {
    if (!user) return;
    api<Account>(`/members/${user.id}/account`)
      .then(setAccount)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load your account'));
  }, [user]);

  useEffect(load, [load]);

  async function cancel(reservation: ReservationView) {
    setBusy(true);
    setError(null);
    try {
      await api(`/reservations/${reservation.id}/cancel`, { method: 'POST' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel the reservation');
    } finally {
      setBusy(false);
      load();
      setRefreshKey((k) => k + 1);
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        leading={user && <UserAvatar name={user.name} size={56} />}
        title="My account"
        subtitle="Your loans, due dates, fines and reservations."
        actions={
          <Button component={RouterLink} to="/catalogue" variant="outlined" startIcon={<LocalLibraryOutlinedIcon />}>
            Browse catalogue
          </Button>
        }
      />
      {error && <Alert severity="error">{error}</Alert>}
      {!account && !error && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress aria-label="Loading your account" />
        </Box>
      )}
      {account && <AccountView account={account} refreshKey={refreshKey} onCancelReservation={cancel} busy={busy} />}
    </Stack>
  );
}
