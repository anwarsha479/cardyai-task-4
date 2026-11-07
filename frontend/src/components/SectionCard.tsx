import type { ReactNode } from 'react';
import { Box, Card, Divider, Stack, Typography } from '@mui/material';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

/** A titled card: header row (title left, action right) above a list or form. */
export function SectionCard({ title, subtitle, action, children }: Props) {
  return (
    <Card>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ px: { xs: 2, sm: 2.5 }, py: 2, minHeight: 64 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6">{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Stack>
      <Divider />
      {children}
    </Card>
  );
}
