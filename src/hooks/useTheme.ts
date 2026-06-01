import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeProvider';
import type { ThemeContextValue } from '../contexts/ThemeProvider';

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
