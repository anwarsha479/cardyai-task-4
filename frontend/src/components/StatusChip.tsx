import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { ink, paper } from '../theme';

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral';

/** Flat status tag with a dot, so statuses never look like buttons. */
export function StatusChip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const theme = useTheme();
  const color = tone === 'neutral' ? ink[500] : theme.palette[tone].main;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        height: 24,
        borderRadius: 1,
        fontSize: '0.78rem',
        fontWeight: 650,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color,
        bgcolor: tone === 'neutral' ? paper[200] : alpha(color, 0.1),
        border: `1px solid ${tone === 'neutral' ? paper[300] : alpha(color, 0.22)}`,
        '&::before': { content: '""', width: 6, height: 6, borderRadius: '50%', bgcolor: color, flexShrink: 0 },
      }}
    >
      {children}
    </Box>
  );
}
