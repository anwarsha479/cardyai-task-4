import { Box, Typography } from '@mui/material';
import { serif } from '../theme';

/** Cloth-binding colours: [cover, band]. */
const BINDINGS: [string, string][] = [
  ['#7A2233', '#D9A55B'],
  ['#2F4F3A', '#D9A55B'],
  ['#2A3F5F', '#E2D6C3'],
  ['#8A4B2F', '#F2E3C9'],
  ['#4A2F5A', '#D9A55B'],
  ['#3D3530', '#C9A26B'],
  ['#6B5B1F', '#F2E3C9'],
  ['#2F5D62', '#E2D6C3'],
];

function initialsOf(title: string): string {
  return title
    .replace(/^(the|a|an)\s+/i, '')
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** A generated cloth cover: the same title always gets the same binding. Large covers print the title. */
export function BookCover({ title, width = 56 }: { title: string; width?: number }) {
  const hash = [...title].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const [cover, band] = BINDINGS[hash % BINDINGS.length];
  const large = width >= 56;
  return (
    <Box
      aria-hidden
      sx={{
        width,
        height: Math.round(width * 1.45),
        flexShrink: 0,
        borderRadius: '2px 5px 5px 2px',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: cover,
        color: band,
        boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 2px 3px 8px rgba(31,26,23,0.28)',
        backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,0.28) 0 6%, rgba(255,255,255,0.10) 6% 8%, transparent 8%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: large ? 0.75 : 0,
        pl: large ? 1.25 : 0.25,
      }}
    >
      <Box sx={{ position: 'absolute', left: '12%', right: '6%', top: '12%', height: 2, bgcolor: band, opacity: 0.8 }} />
      <Box sx={{ position: 'absolute', left: '12%', right: '6%', bottom: '12%', height: 2, bgcolor: band, opacity: 0.8 }} />
      {large ? (
        <Typography
          sx={{
            fontFamily: serif,
            fontWeight: 600,
            fontSize: width * 0.15,
            lineHeight: 1.15,
            textAlign: 'center',
            color: band,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {title}
        </Typography>
      ) : (
        <Typography sx={{ fontFamily: serif, fontWeight: 650, fontSize: width * 0.36, color: band, pl: 0.25 }}>{initialsOf(title)}</Typography>
      )}
    </Box>
  );
}
