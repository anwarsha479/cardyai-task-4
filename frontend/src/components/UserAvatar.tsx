import { Avatar } from '@mui/material';
import { serif } from '../theme';

const PALETTE = ['#7A2233', '#A86B1E', '#3F6B3A', '#35577D', '#8A4B2F', '#5E3A6E'];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Initials avatar with a colour that stays the same for the same name. */
export function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return (
    <Avatar sx={{ width: size, height: size, fontSize: size * 0.4, fontFamily: serif, fontWeight: 600, bgcolor: PALETTE[hash % PALETTE.length] }}>
      {initials(name)}
    </Avatar>
  );
}
