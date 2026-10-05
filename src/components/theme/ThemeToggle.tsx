'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`
        relative p-2 rounded-xl transition-all duration-200 flex items-center gap-2
        ${isDark
          ? 'bg-white/10 hover:bg-white/20 text-amber-300 hover:text-amber-200'
          : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white'
        }
      `}
      title={isDark ? 'Switch to Light Theme (Minimal Slate Glass)' : 'Switch to Dark Theme (Obsidian Glow)'}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
      <span className="text-xs font-semibold hidden group-[.expanded]:inline">
        {isDark ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
