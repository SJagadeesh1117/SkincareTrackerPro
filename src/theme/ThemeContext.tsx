import React, { createContext, useContext, useState, useMemo } from 'react';
import { lightColors, darkColors, type ThemeColors } from './colors';

interface ThemeContextValue {
  colors: ThemeColors;
  mode: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  mode: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: mode === 'light' ? lightColors : darkColors,
      mode,
      toggleTheme: () => setMode(m => (m === 'light' ? 'dark' : 'light')),
    }),
    [mode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
