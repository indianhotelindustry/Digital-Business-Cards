import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ThemeMode } from '../../types/theme';

interface ThemeToggleProps {
  variant?: 'segmented' | 'icon' | 'dropdown' | 'compact';
  className?: string;
  onThemeChange?: (mode: ThemeMode) => void;
  customMode?: ThemeMode;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'segmented',
  className = '',
  onThemeChange,
  customMode,
}) => {
  const { mode: contextMode, resolvedTheme, setMode: setContextMode, toggleTheme } = useTheme();
  const currentMode = customMode !== undefined ? customMode : contextMode;

  const handleSelect = (selected: ThemeMode) => {
    if (onThemeChange) {
      onThemeChange(selected);
    } else {
      setContextMode(selected);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={toggleTheme}
        className={`p-2 rounded-xl transition duration-200 flex items-center justify-center ${
          resolvedTheme === 'dark'
            ? 'bg-slate-800 text-amber-300 hover:bg-slate-700 border border-slate-700'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
        } ${className}`}
        title={`Current theme: ${currentMode} (${resolvedTheme}). Click to toggle.`}
        aria-label="Toggle color theme"
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="w-4 h-4" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500" />
        )}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center p-1 rounded-xl bg-slate-900/60 backdrop-blur-md border border-slate-700/60 shadow-sm ${className}`}>
        <button
          onClick={() => handleSelect('light')}
          className={`p-1.5 rounded-lg text-xs transition ${
            currentMode === 'light'
              ? 'bg-white text-slate-900 shadow-sm font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Light Theme"
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
        </button>
        <button
          onClick={() => handleSelect('dark')}
          className={`p-1.5 rounded-lg text-xs transition ${
            currentMode === 'dark'
              ? 'bg-teal-600 text-white shadow-sm font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Dark Theme"
        >
          <Moon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleSelect('system')}
          className={`p-1.5 rounded-lg text-xs transition ${
            currentMode === 'system'
              ? 'bg-slate-700 text-teal-300 shadow-sm font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
          title="System (Auto)"
        >
          <Laptop className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Default segmented control
  return (
    <div
      className={`inline-flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition ${className}`}
      role="group"
      aria-label="Appearance Mode"
    >
      <button
        type="button"
        onClick={() => handleSelect('light')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
          currentMode === 'light'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Sun className="w-3.5 h-3.5 text-amber-500" />
        <span>Light</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect('dark')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
          currentMode === 'dark'
            ? 'bg-teal-700 dark:bg-teal-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Moon className="w-3.5 h-3.5" />
        <span>Dark</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect('system')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
          currentMode === 'system'
            ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Laptop className="w-3.5 h-3.5" />
        <span>System</span>
      </button>
    </div>
  );
};
