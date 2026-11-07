import type { ReactNode } from 'react';
import { Box, Card, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ink, serif } from '../theme';
import type { Tone } from './StatusChip';

interface Props {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}

/** Ledger-style tile: small-caps label and icon, a large serif figure, one line of context. */
export function StatCard({ icon, label, value, hint, tone = 'primary' }: Props) {
  const theme = useTheme();
  const color = tone === 'neutral' ? ink[500] : theme.palette[tone].main;
  return (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: color }} />
      <Box sx={{ p: 2.5, pl: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography variant="overline" color="text.secondary" noWrap>
            {label}
          </Typography>
          <Box sx={{ color, display: 'grid', '& svg': { fontSize: 20 } }}>{icon}</Box>
        </Stack>
        <Typography sx={{ fontFamily: serif, fontWeight: 600, fontSize: '2rem', lineHeight: 1.15, mt: 0.5, color: tone === 'error' || tone === 'warning' ? color : 'text.primary' }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
            {hint}
          </Typography>
        )}
      </Box>
    </Card>
  );
}
