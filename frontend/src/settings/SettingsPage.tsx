import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Divider,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { api, ApiError } from '../api/client';
import type { SettingKey, SettingView } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { SectionCard } from '../components/SectionCard';
import { CURRENCY_SYMBOL, formatMoney, MINOR_UNITS, plural } from '../format';

const COPY: Record<SettingKey, { label: string; help: string; unit?: string; money?: boolean }> = {
  loanPeriodDays: { label: 'Loan period', help: 'How long a member keeps a book. Loans already made keep their due date.', unit: 'day' },
  maxActiveLoans: { label: 'Maximum active loans', help: 'How many books a member can have at once.', unit: 'book' },
  finePerDayCents: { label: 'Fine per day late', help: 'Charged for every started day after the due date, at return.', money: true },
  maxFinePerLoanCents: { label: 'Fine cap per loan', help: 'The most one late loan can cost.', money: true },
  fineBlockThresholdCents: { label: 'Borrowing block threshold', help: 'Members whose unpaid fines are over this cannot borrow or reserve.', money: true },
  reservationHoldHours: {
    label: 'Reservation hold window',
    help: 'How long a returned copy is kept for the next member in the queue before it passes on.',
    unit: 'hour',
  },
};

const GROUPS: { title: string; subtitle: string; keys: SettingKey[] }[] = [
  { title: 'Loans', subtitle: 'Applies to the next checkout.', keys: ['loanPeriodDays', 'maxActiveLoans'] },
  { title: 'Fines', subtitle: 'Applies to the next return and checkout.', keys: ['finePerDayCents', 'maxFinePerLoanCents', 'fineBlockThresholdCents'] },
  { title: 'Reservations', subtitle: 'Applies to the next hold.', keys: ['reservationHoldHours'] },
];

const toInput = (s: SettingView) => (COPY[s.key].money ? String(s.value / MINOR_UNITS) : String(s.value));
const fromInput = (key: SettingKey, text: string) => (COPY[key].money ? Math.round(Number(text) * MINOR_UNITS) : Number(text));
const describe = (key: SettingKey, value: number) => (COPY[key].money ? formatMoney(value) : plural(value, COPY[key].unit!));

/** Librarian-only. Changes apply to the very next checkout, return or hold, with no restart (LL-DM-5). */
export function SettingsPage() {
  const [settings, setSettings] = useState<SettingView[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function show(list: SettingView[]) {
    setSettings(list);
    setDraft(Object.fromEntries(list.map((s) => [s.key, toInput(s)])));
  }

  useEffect(() => {
    api<{ settings: SettingView[] }>('/settings')
      .then((res) => show(res.settings))
      .catch((err: unknown) => setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Could not load settings')));
  }, []);

  const byKey = new Map(settings?.map((s) => [s.key, s]));
  const changes = settings
    ? Object.fromEntries(settings.filter((s) => draft[s.key] !== toInput(s)).map((s) => [s.key, fromInput(s.key, draft[s.key])]))
    : {};
  const changeCount = Object.keys(changes).length;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!changeCount) return;
    setError(null);
    setSaving(true);
    try {
      const res = await api<{ settings: SettingView[] }>('/settings', { method: 'PATCH', body: changes });
      show(res.settings);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Could not save settings'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3} component="form" onSubmit={handleSubmit} noValidate sx={{ maxWidth: 860, mx: 'auto', width: '100%' }}>
      <PageHeader title="Lending rules" subtitle="These apply to the whole library. Changes take effect straight away, with no restart." />
      {!settings && !error && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress aria-label="Loading settings" />
        </Box>
      )}
      {error && !Object.keys(error.fieldErrors).length && <Alert severity="error">{error.message}</Alert>}

      {settings &&
        GROUPS.map((group) => (
          <SectionCard key={group.title} title={group.title} subtitle={group.subtitle}>
            <Stack divider={<Divider />}>
              {group.keys.map((key) => {
                const s = byKey.get(key);
                if (!s) return null;
                const copy = COPY[key];
                const fieldError = error?.fieldErrors[key]?.[0];
                const changed = draft[key] !== toInput(s);
                return (
                  <Stack
                    key={key}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 1.5, sm: 3 }}
                    justifyContent="space-between"
                    alignItems={{ sm: 'center' }}
                    sx={{ px: { xs: 2, sm: 2.5 }, py: 2.25 }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2">{copy.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {copy.help}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                        Allowed {describe(key, s.min)} – {describe(key, s.max)} · default {describe(key, s.defaultValue)}
                        {s.updatedBy && ` · last changed by ${s.updatedBy.name}${s.updatedAt ? ` on ${new Date(s.updatedAt).toLocaleDateString()}` : ''}`}
                      </Typography>
                    </Box>
                    <TextField
                      type="number"
                      size="small"
                      value={draft[key] ?? ''}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                      error={Boolean(fieldError)}
                      helperText={fieldError}
                      aria-label={copy.label}
                      color={changed ? 'warning' : 'primary'}
                      focused={changed || undefined}
                      sx={{ width: { xs: '100%', sm: 180 }, flexShrink: 0 }}
                      slotProps={{
                        htmlInput: copy.money
                          ? { min: s.min / MINOR_UNITS, max: s.max / MINOR_UNITS, step: 1 / MINOR_UNITS, style: { textAlign: 'right' } }
                          : { min: s.min, max: s.max, step: 1, style: { textAlign: 'right' } },
                        input: copy.money
                          ? { startAdornment: <InputAdornment position="start">{CURRENCY_SYMBOL}</InputAdornment> }
                          : { endAdornment: <InputAdornment position="end">{copy.unit}s</InputAdornment> },
                      }}
                    />
                  </Stack>
                );
              })}
            </Stack>
          </SectionCard>
        ))}

      {settings && (
        <Card sx={{ position: 'sticky', bottom: 16, zIndex: 1, boxShadow: changeCount ? '0 10px 30px rgba(31,26,23,0.14)' : undefined }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5 }}>
            <Typography variant="body2" color={changeCount ? 'warning.main' : 'text.secondary'} fontWeight={changeCount ? 600 : 400}>
              {changeCount ? `${changeCount} unsaved change${changeCount === 1 ? '' : 's'}` : 'All changes saved'}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button color="inherit" disabled={!changeCount || saving} onClick={() => settings && show(settings)}>
                Discard
              </Button>
              <Button type="submit" variant="contained" disabled={!changeCount || saving}>
                Save changes
              </Button>
            </Stack>
          </Stack>
        </Card>
      )}

      <Snackbar open={saved} autoHideDuration={3000} onClose={() => setSaved(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setSaved(false)}>
          Settings saved
        </Alert>
      </Snackbar>
    </Stack>
  );
}
