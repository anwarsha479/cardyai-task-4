import { Box, Stack, Typography } from '@mui/material';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import { brass, burgundy, ink, paper, serif } from '../theme';

/** "Folio" wordmark. `inverse` is for dark backgrounds. */
export function BrandMark({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box
        sx={{
          width: 38,
          height: 38,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          color: paper[50],
          bgcolor: burgundy.main,
          boxShadow: `inset 0 -3px 0 ${burgundy.dark}, 0 0 0 1px ${inverse ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
        }}
      >
        <AutoStoriesRoundedIcon sx={{ fontSize: 22 }} />
      </Box>
      {!compact && (
        <Box>
          <Typography sx={{ fontFamily: serif, fontWeight: 650, fontSize: '1.3rem', lineHeight: 1, color: inverse ? paper[50] : ink[900] }}>
            Folio
          </Typography>
          <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.6, color: inverse ? brass.light : brass.main }}>
            Library lending
          </Typography>
        </Box>
      )}
    </Stack>
  );
}
