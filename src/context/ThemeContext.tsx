import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { ThemeMode, ResolvedTheme, ThemeContextType } from '../types/theme';

const STORAGE_KEY = 'dsbc_theme_mode';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultMode = 'system',
  storageKey = STORAGE_KEY,
}) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    }
    return defaultMode;
  });

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  // Listen to OS color scheme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      // Legacy fallback
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (mode === 'system') {
      return systemTheme;
    }
    return mode;
  }, [mode, systemTheme]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(storageKey, newMode);
    } catch (err) {
      console.warn('Could not persist theme mode:', err);
    }
  };

  const toggleTheme = () => {
    if (resolvedTheme === 'dark') {
      setMode('light');
    } else {
      setMode('dark');
    }
  };

  // Synchronize <html> root class & dataset attribute for global styling
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  }, [resolvedTheme]);

  const value: ThemeContextType = {
    mode,
    resolvedTheme,
    setMode,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if rendered outside ThemeProvider
    const system = getSystemTheme();
    return {
      mode: 'system',
      resolvedTheme: system,
      setMode: () => {},
      toggleTheme: () => {},
      isDark: system === 'dark',
    };
  }
  return context;
};

/**
 * ThemeScope Component
 * Allows isolating a child component tree with a specific appearance configuration,
 * while allowing a visitor/local override.
 */
interface ThemeScopeProps {
  mode?: ThemeMode;
  children: React.ReactNode;
  className?: string;
}

export const ThemeScope: React.FC<ThemeScopeProps> = ({
  mode = 'system',
  children,
  className = '',
}) => {
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  const resolved = mode === 'system' ? systemTheme : mode;

  return (
    <div
      data-theme={resolved}
      className={`${resolved === 'dark' ? 'dark' : 'light'} ${className}`}
    >
      {children}
    </div>
  );
};
