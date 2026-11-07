import type { ReactNode } from 'react';
import { Box, Card, Stack, Typography } from '@mui/material';
import { tint } from '../theme';

interface Props {
  icon: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: Props) {
  return (
    <Card sx={{ borderStyle: 'dashed' }}>
      <Stack alignItems="center" spacing={1.5} sx={{ py: 5, px: 3, textAlign: 'center' }}>
        <Box
          sx={(t) => ({
            width: 56,
            height: 56,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: t.palette.primary.main,
            bgcolor: tint(t.palette.primary.main),
          })}
        >
          {icon}
        </Box>
        <Typography variant="subtitle1">{title}</Typography>
        {message && (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
            {message}
          </Typography>
        )}
        {action}
      </Stack>
    </Card>
  );
}
