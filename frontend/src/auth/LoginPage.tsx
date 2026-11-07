import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ApiError } from '../api/client';
import { BrandMark } from '../components/BrandMark';
import { brass, burgundy, ink, paper, serif } from '../theme';
import { useAuth } from './AuthContext';

/** Decorative shelf: spines of different heights, widths and colours. */
const SPINES: [number, number, string][] = [
  [86, 22, '#7A2233'], [104, 28, '#A86B1E'], [92, 18, '#3F6B3A'], [112, 30, '#35577D'], [78, 20, '#E2D6C3'],
  [98, 26, '#5E3A6E'], [108, 22, '#8A4B2F'], [88, 34, '#7A2233'], [100, 18, '#D9A55B'], [94, 24, '#3D3530'],
  [110, 28, '#3F6B3A'], [84, 20, '#A8485A'], [102, 26, '#35577D'],
];

function Bookshelf() {
  return (
    <Box aria-hidden sx={{ '@media (max-height: 700px)': { display: 'none' } }}>
      <Stack direction="row" alignItems="flex-end" spacing={0.5} sx={{ px: 1 }}>
        {SPINES.map(([height, width, colour], i) => (
          <Box
            key={i}
            sx={{
              height,
              width,
              flexShrink: 0,
              borderRadius: '3px 3px 1px 1px',
              bgcolor: colour,
              transform: i === 9 ? 'rotate(-8deg) translateX(4px)' : undefined,
              transformOrigin: 'bottom left',
              backgroundImage: `linear-gradient(90deg, ${alpha('#000', 0.22)} 0 3px, transparent 3px calc(100% - 3px), ${alpha('#000', 0.18)} calc(100% - 3px)), linear-gradient(transparent 18%, ${alpha('#fff', 0.35)} 18% 21%, transparent 21% 76%, ${alpha('#fff', 0.35)} 76% 79%, transparent 79%)`,
            }}
          />
        ))}
      </Stack>
      <Box sx={{ height: 10, borderRadius: 1, bgcolor: '#8A5A2B', boxShadow: `0 10px 24px ${alpha('#000', 0.45)}` }} />
    </Box>
  );
}

const STEPS = [
  ['Borrow', 'Take a free copy'],
  ['Reserve', 'Join the queue'],
  ['Return', 'Bring it back on time'],
];

/** Accounts created by `npm run seed`. */
const DEMO_ACCOUNTS = [
  { role: 'Member', email: 'member1@example.test' },
  { role: 'Librarian', email: 'librarian@example.test' },
];
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD;
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Sign in failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (field: string) => error?.fieldErrors[field]?.[0];

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        height: { md: '100dvh' },
        overflow: { md: 'hidden' },
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        bgcolor: paper[100],
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 4,
          p: { md: 6, lg: 8 },
          minHeight: 0,
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          color: paper[100],
          bgcolor: ink[900],
          backgroundImage: `radial-gradient(800px 420px at 100% 0%, ${alpha(burgundy.main, 0.45)}, transparent 65%), radial-gradient(600px 400px at 0% 100%, ${alpha(brass.main, 0.18)}, transparent 60%)`,
        }}
      >
        <BrandMark inverse />
        <Box>
          <Typography variant="h3" component="p" sx={{ mb: 6, lineHeight: 1.08, fontSize: { md: '2.6rem', lg: '3.1rem' } }}>
            Every book, <Box component="em" sx={{ color: brass.light }}>fairly</Box> shared.
          </Typography>
          <Bookshelf />
        </Box>
        <Stack direction="row" spacing={4}>
          {STEPS.map(([title, text], i) => (
            <Box key={title}>
              <Typography sx={{ fontFamily: serif, fontSize: '1.25rem', color: brass.light, lineHeight: 1 }}>{`0${i + 1}`}</Typography>
              <Typography fontWeight={700} sx={{ mt: 0.75 }}>
                {title}
              </Typography>
              <Typography variant="body2" sx={{ color: alpha(paper[100], 0.6) }}>
                {text}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Flex with an auto margin centres the form in the visible screen and still lets it scroll on short windows. */}
      <Box sx={{ display: 'flex', minHeight: 0, overflowY: 'auto', p: { xs: 3, sm: 6 } }}>
        <Stack component="form" spacing={3} onSubmit={handleSubmit} noValidate sx={{ width: '100%', maxWidth: 400, m: 'auto' }}>
          <Box sx={{ display: { md: 'none' } }}>
            <BrandMark />
          </Box>
          <Box>
            <Typography variant="h4" component="h1">
              Welcome back
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Sign in with your library account.
            </Typography>
          </Box>
          {error && !Object.keys(error.fieldErrors).length && <Alert severity="error">{error.message}</Alert>}
          <TextField
            label="Email address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={Boolean(fieldError('email'))}
            helperText={fieldError('email')}
            required
            autoFocus
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={Boolean(fieldError('password'))}
            helperText={fieldError('password')}
            required
            fullWidth
          />
          <Button type="submit" variant="contained" size="large" loading={submitting} fullWidth>
            Sign in
          </Button>
          <Box sx={{ pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="overline" color="text.secondary" component="div" sx={{ mb: 1.25 }}>
              Demo accounts
            </Typography>
            <Stack spacing={1.25}>
              {DEMO_ACCOUNTS.map((account) => (
                <Stack
                  key={account.email}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: paper[50] }}
                >
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {account.role}
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1, rowGap: 0.25, mt: 0.5, fontSize: '0.8rem' }}>
                      <Typography variant="caption" color="text.secondary">
                        User ID
                      </Typography>
                      <Typography variant="caption" sx={{ fontFamily: MONO, overflowWrap: 'anywhere' }}>
                        {account.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Password
                      </Typography>
                      <Typography variant="caption" sx={{ fontFamily: MONO, overflowWrap: 'anywhere' }}>
                        {DEMO_PASSWORD || 'see SEED_DEMO_PASSWORD in .env'}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ flexShrink: 0, minWidth: 64 }}
                    onClick={() => {
                      setEmail(account.email);
                      if (DEMO_PASSWORD) setPassword(DEMO_PASSWORD);
                      setError(null);
                    }}
                  >
                    Use
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
