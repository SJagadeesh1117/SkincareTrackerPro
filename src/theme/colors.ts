export const lightColors = {
  background:   '#FFFFFF',
  surface:      '#F5F3FF',
  headerCard:   '#DCD5FA',
  border:       '#EEEAFE',
  borderStrong: '#DCD5FA',
  primary:      '#7F77DD',
  primaryDark:  '#3C3489',
  primaryMid:   '#534AB7',
  muted:        '#AFA9EC',
  divider:      '#EEEAFE',
  white:        '#FFFFFF',
};

export const darkColors = {
  // Dark values — same keys, swap in later via ThemeProvider
  background:   '#0F0A1A',
  surface:      '#211640',
  headerCard:   '#2D1B69',
  border:       '#3A2468',
  borderStrong: '#7C5AE0',
  primary:      '#8B5CF6',
  primaryDark:  '#C4B5FD',
  primaryMid:   '#A78BFA',
  muted:        '#9B7FD4',
  divider:      '#3A2468',
  white:        '#FFFFFF',
};

export type ThemeColors = typeof lightColors;
