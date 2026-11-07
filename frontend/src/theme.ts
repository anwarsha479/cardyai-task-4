import { alpha, createTheme } from '@mui/material/styles';

/** Folio palette: warm paper, dark ink, burgundy binding and brass details. */
export const paper = { 50: '#FDFBF7', 100: '#F7F2EA', 200: '#EFE7DA', 300: '#E2D6C3' };
export const ink = { 900: '#1F1A17', 700: '#3D3530', 500: '#6E625A', 300: '#A3978D' };
export const burgundy = { main: '#7A2233', dark: '#5A1624', light: '#A8485A' };
export const brass = { main: '#A86B1E', light: '#D9A55B' };

export const serif = '"Fraunces Variable", Georgia, "Times New Roman", serif';
const sans = '"Source Sans 3 Variable", "Segoe UI", system-ui, -apple-system, sans-serif';
const line = paper[300];

export const theme = createTheme({
  palette: {
    primary: { main: burgundy.main, dark: burgundy.dark, light: burgundy.light, contrastText: '#FFFFFF' },
    secondary: { main: brass.main, light: brass.light, contrastText: '#FFFFFF' },
    success: { main: '#3F6B3A', light: '#E3EDDC' },
    warning: { main: '#A15C07', light: '#F6E7CE' },
    error: { main: '#A2312C', light: '#F5DEDA' },
    info: { main: '#35577D', light: '#DDE6F0' },
    background: { default: paper[100], paper: paper[50] },
    text: { primary: ink[900], secondary: ink[500] },
    divider: line,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: sans,
    fontSize: 15,
    h3: { fontFamily: serif, fontWeight: 600, letterSpacing: '-0.02em' },
    h4: { fontFamily: serif, fontWeight: 600, letterSpacing: '-0.015em', fontSize: '2rem' },
    h5: { fontFamily: serif, fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontFamily: serif, fontWeight: 600, fontSize: '1.15rem' },
    subtitle1: { fontWeight: 650 },
    subtitle2: { fontWeight: 650 },
    overline: { fontWeight: 700, letterSpacing: '0.12em', fontSize: '0.7rem' },
    button: { textTransform: 'none', fontWeight: 650, letterSpacing: '0.01em' },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { backgroundColor: paper[100] } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, paddingInline: 18, minHeight: 40, whiteSpace: 'nowrap' },
        sizeSmall: { minHeight: 32, paddingInline: 12, fontSize: '0.85rem' },
        sizeLarge: { minHeight: 48, fontSize: '1rem' },
        contained: { boxShadow: `inset 0 -2px 0 ${alpha('#000', 0.18)}` },
        outlined: { borderColor: line, backgroundColor: paper[50], '&:hover': { borderColor: ink[300], backgroundColor: '#FFFFFF' } },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiToggleButtonGroup: { styleOverrides: { root: { backgroundColor: paper[50] } } },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 650,
          paddingInline: 14,
          borderColor: line,
          color: ink[500],
          '&.Mui-selected': { backgroundColor: burgundy.main, color: '#FFFFFF', '&:hover': { backgroundColor: burgundy.dark } },
        },
      },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderColor: line, borderRadius: 10, backgroundColor: paper[50] } },
    },
    MuiPaper: { styleOverrides: { outlined: { borderColor: line } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 12, backgroundColor: paper[50] } } },
    MuiDialogTitle: { styleOverrides: { root: { fontFamily: serif, fontWeight: 600, fontSize: '1.35rem', paddingBottom: 4 } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '12px 24px 20px', gap: 4 } } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: paper[200], paddingTop: 14, paddingBottom: 14 },
        head: {
          fontWeight: 700,
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: ink[500],
          backgroundColor: paper[100],
          borderColor: line,
          paddingTop: 10,
          paddingBottom: 10,
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { '&:last-of-type td': { borderBottom: 0 }, '&.MuiTableRow-hover:hover': { backgroundColor: alpha(brass.light, 0.08) } },
      },
    },
    MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 3, backgroundColor: burgundy.main } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 650, minHeight: 52, fontSize: '0.95rem' } } },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10, alignItems: 'center', border: '1px solid' }, standardError: { borderColor: '#E7C1BB' }, standardWarning: { borderColor: '#EBCF9F' }, standardSuccess: { borderColor: '#C6D9BC' }, standardInfo: { borderColor: '#C2D1E2' } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8, backgroundColor: '#FFFFFF', '& .MuiOutlinedInput-notchedOutline': { borderColor: line } },
      },
    },
    MuiDrawer: { styleOverrides: { paper: { backgroundColor: ink[900], color: paper[100], borderRight: 0 } } },
  },
});

/** Responsive tile grid: one column on phones, two on tablets, up to four on desktop. */
export const statGridSx = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
} as const;

/** Soft tinted background for icon badges, e.g. tint(theme.palette.primary.main). */
export const tint = (color: string) => alpha(color, 0.1);
