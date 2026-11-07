import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { api, ApiError } from '../api/client';
import type { Account } from '../api/types';
import { AccountView } from '../account/AccountView';
import { PageHeader } from '../components/PageHeader';
import { StatusChip } from '../components/StatusChip';
import { UserAvatar } from '../components/UserAvatar';
import { CURRENCY_SYMBOL, formatMoney, MINOR_UNITS } from '../format';

/** Librarian view of one member's account, with fine payments. */
export function MemberDetailPage() {
  const { memberId } = useParams();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [payError, setPayError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => {
    api<Account>(`/members/${memberId}/account`)
      .then(setAccount)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the member'));
  }, [memberId]);

  useEffect(load, [load]);

  function openPayment() {
    setPayError(null);
    setNote('');
    setAmount(account ? String(account.balanceCents / MINOR_UNITS) : '');
    setPaying(true);
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    setPayError(null);
    setSaving(true);
    const amountCents = Math.round(Number(amount) * MINOR_UNITS);
    try {
      setAccount(await api<Account>(`/members/${memberId}/payments`, { method: 'POST', body: { amountCents, note: note || null } }));
      setSaved(`Payment of ${formatMoney(amountCents)} recorded`);
      setRefreshKey((k) => k + 1);
      setPaying(false);
    } catch (err) {
      setPayError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Could not record the payment'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        back={{ to: '/members', label: 'All members' }}
        leading={account && <UserAvatar name={account.member.name} size={56} />}
        title={account?.member.name ?? 'Member'}
        subtitle={
          account && (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {account.member.email}
              {account.blocked ? <StatusChip tone="error">Blocked</StatusChip> : <StatusChip tone="success">Can borrow</StatusChip>}
            </Box>
          )
        }
        actions={
          account && (
            <Button variant="contained" startIcon={<PaymentsOutlinedIcon />} disabled={account.balanceCents === 0} onClick={openPayment}>
              Record payment
            </Button>
          )
        }
      />
      {error && <Alert severity="error">{error}</Alert>}
      {!account && !error && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress aria-label="Loading member" />
        </Box>
      )}
      {account && <AccountView account={account} refreshKey={refreshKey} />}

      <Dialog open={paying} onClose={() => setPaying(false)} fullWidth maxWidth="xs">
        <form onSubmit={submitPayment} noValidate>
          <DialogTitle>Record a fine payment</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              {account?.member.name} owes <b>{formatMoney(account?.balanceCents ?? 0)}</b>. A payment cannot be more than that.
            </Typography>
            <Stack spacing={2.5}>
              {payError && !Object.keys(payError.fieldErrors).length && <Alert severity="error">{payError.message}</Alert>}
              <TextField
                label="Amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                error={Boolean(payError?.fieldErrors.amountCents)}
                helperText={payError?.fieldErrors.amountCents?.[0]}
                slotProps={{
                  htmlInput: { min: 1 / MINOR_UNITS, step: 1 / MINOR_UNITS },
                  input: { startAdornment: <InputAdornment position="start">{CURRENCY_SYMBOL}</InputAdornment> },
                }}
                autoFocus
                fullWidth
              />
              <TextField label="Note (optional)" placeholder="e.g. Paid in cash at the desk" value={note} onChange={(e) => setNote(e.target.value)} fullWidth />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={() => setPaying(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              Record payment
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <Snackbar open={Boolean(saved)} autoHideDuration={3000} onClose={() => setSaved(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setSaved(null)}>
          {saved}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
