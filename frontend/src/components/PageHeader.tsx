import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
  /** Shown left of the title, e.g. an avatar. */
  leading?: ReactNode;
}

export function PageHeader({ title, subtitle, actions, back, leading }: Props) {
  return (
    <Stack spacing={1.5}>
      {back && (
        <Box>
          <Button component={RouterLink} to={back.to} size="small" color="inherit" startIcon={<ArrowBackRoundedIcon />} sx={{ ml: -1, color: 'text.secondary' }}>
            {back.label}
          </Button>
        </Box>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={2}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
          {leading}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4" component="h1" noWrap>
              {title}
            </Typography>
            {subtitle && (
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
        {actions && (
          <Stack direction="row" spacing={1} flexShrink={0} sx={{ '& > *': { flex: { xs: 1, sm: 'none' } } }}>
            {actions}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
