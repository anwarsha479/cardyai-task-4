import { useState, type ReactNode } from 'react';
import { NavLink, Link as RouterLink, Outlet, useNavigate } from 'react-router-dom';
import { AppBar, Box, ButtonBase, Container, Drawer, IconButton, Stack, Toolbar, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LocalLibraryOutlinedIcon from '@mui/icons-material/LocalLibraryOutlined';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useAuth } from '../auth/AuthContext';
import { BrandMark } from '../components/BrandMark';
import { UserAvatar } from '../components/UserAvatar';
import { brass, ink, paper } from '../theme';

const SIDEBAR_WIDTH = 272;

interface NavEntry {
  to: string;
  icon: ReactNode;
  label: string;
}

function NavItem({ to, icon, label, onNavigate }: NavEntry & { onNavigate?: () => void }) {
  return (
    <ButtonBase
      component={NavLink}
      to={to}
      onClick={onNavigate}
      sx={{
        justifyContent: 'flex-start',
        gap: 1.5,
        width: '100%',
        px: 1.75,
        py: 1.1,
        borderRadius: 2,
        position: 'relative',
        fontWeight: 600,
        fontSize: '0.95rem',
        color: alpha(paper[100], 0.72),
        transition: 'background-color .15s, color .15s',
        '& svg': { fontSize: 21 },
        '&:hover': { bgcolor: alpha(paper[100], 0.06), color: paper[50] },
        '&.active': {
          color: paper[50],
          bgcolor: alpha(paper[100], 0.1),
          '&::before': { content: '""', position: 'absolute', left: -12, top: 8, bottom: 8, width: 4, borderRadius: 4, bgcolor: brass.light },
          '& svg': { color: brass.light },
        },
      }}
    >
      {icon}
      {label}
    </ButtonBase>
  );
}

function NavGroup({ title, items, onNavigate }: { title: string; items: NavEntry[]; onNavigate?: () => void }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="overline" sx={{ px: 1.75, color: alpha(paper[100], 0.4) }}>
        {title}
      </Typography>
      {items.map((item) => (
        <NavItem key={item.to} {...item} onNavigate={onNavigate} />
      ))}
    </Stack>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleSignOut() {
    setOpen(false);
    logout();
    navigate('/login', { replace: true });
  }

  const browse: NavEntry[] = [
    { to: '/catalogue', icon: <LocalLibraryOutlinedIcon />, label: 'Catalogue' },
    ...(user?.role === 'member' ? [{ to: '/account', icon: <AccountCircleOutlinedIcon />, label: 'My account' }] : []),
  ];
  const desk: NavEntry[] =
    user?.role === 'librarian'
      ? [
          { to: '/loans', icon: <AssignmentReturnOutlinedIcon />, label: 'Loans & returns' },
          { to: '/members', icon: <GroupsOutlinedIcon />, label: 'Members' },
          { to: '/settings', icon: <TuneRoundedIcon />, label: 'Lending rules' },
        ]
      : [];

  const sidebar = (
    <Stack sx={{ height: '100%', p: 2.5, pl: 3 }}>
      <Box component={RouterLink} to="/" onClick={() => setOpen(false)} sx={{ textDecoration: 'none', mb: 4, mt: 0.5 }}>
        <BrandMark inverse />
      </Box>
      <Stack spacing={3} component="nav" sx={{ flexGrow: 1 }}>
        <NavGroup title="Library" items={browse} onNavigate={() => setOpen(false)} />
        {desk.length > 0 && <NavGroup title="Front desk" items={desk} onNavigate={() => setOpen(false)} />}
      </Stack>
      {user && (
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ p: 1.5, borderRadius: 2.5, bgcolor: alpha(paper[100], 0.06), border: `1px solid ${alpha(paper[100], 0.08)}` }}
        >
          <UserAvatar name={user.name} size={38} />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="body2" fontWeight={650} noWrap sx={{ color: paper[50] }}>
              {user.name}
            </Typography>
            <Typography variant="caption" sx={{ color: alpha(paper[100], 0.55) }}>
              {user.role === 'librarian' ? 'Librarian' : 'Member'}
            </Typography>
          </Box>
          <Tooltip title="Sign out">
            <IconButton onClick={handleSignOut} aria-label="Sign out" sx={{ color: alpha(paper[100], 0.7), '&:hover': { color: paper[50], bgcolor: alpha(paper[100], 0.08) } }}>
              <LogoutRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
    </Stack>
  );

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH } }}>
        {sidebar}
      </Drawer>
      <Drawer variant="temporary" open={open} onClose={() => setOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH } }}>
        {sidebar}
      </Drawer>

      <AppBar position="sticky" elevation={0} sx={{ display: { md: 'none' }, bgcolor: paper[50], color: ink[900], borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={() => setOpen(true)} aria-label="Open menu">
            <MenuRoundedIcon />
          </IconButton>
          <BrandMark />
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ ml: { md: `${SIDEBAR_WIDTH}px` } }}>
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3, md: 5 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
