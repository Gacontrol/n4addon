import type { CSSProperties } from 'react';
import { WidgetTheme } from '../types/visualization';

export interface ThemeVars {
  bg: string;
  border: string;
  text: string;
  accent: string;
  subText: string;
  trackBg: string;
  glowClass: string;
  borderRadius: number;
  boxShadow?: string;
  backdropFilter?: string;
}

const themes: Record<WidgetTheme, ThemeVars> = {
  'default': {
    bg: '#1e293b',
    border: '#334155',
    text: '#e2e8f0',
    accent: '#3b82f6',
    subText: '#94a3b8',
    trackBg: '#0f172a',
    glowClass: '',
    borderRadius: 8,
  },
  'dark-glass': {
    bg: 'rgba(15,23,42,0.7)',
    border: 'rgba(59,130,246,0.25)',
    text: '#e2e8f0',
    accent: '#60a5fa',
    subText: '#93c5fd',
    trackBg: 'rgba(0,0,0,0.4)',
    glowClass: '',
    borderRadius: 12,
    boxShadow: '0 4px 24px rgba(59,130,246,0.12)',
    backdropFilter: 'blur(12px)',
  },
  'neon-glow': {
    bg: '#020617',
    border: '#22d3ee',
    text: '#ecfeff',
    accent: '#22d3ee',
    subText: '#67e8f9',
    trackBg: '#0a0a0a',
    glowClass: '',
    borderRadius: 6,
    boxShadow: '0 0 12px rgba(34,211,238,0.4), inset 0 0 8px rgba(34,211,238,0.05)',
  },
  'minimal-flat': {
    bg: '#475569',
    border: 'transparent',
    text: '#f8fafc',
    accent: '#38bdf8',
    subText: '#cbd5e1',
    trackBg: '#334155',
    glowClass: '',
    borderRadius: 4,
  },
  'industrial': {
    bg: '#27272a',
    border: '#ea580c',
    text: '#fafafa',
    accent: '#f97316',
    subText: '#a1a1aa',
    trackBg: '#18181b',
    glowClass: '',
    borderRadius: 3,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  },
  'soft-light': {
    bg: '#f1f5f9',
    border: '#cbd5e1',
    text: '#1e293b',
    accent: '#2563eb',
    subText: '#475569',
    trackBg: '#e2e8f0',
    glowClass: '',
    borderRadius: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  'midnight-blue': {
    bg: '#1e3a5f',
    border: '#3b82f6',
    text: '#dbeafe',
    accent: '#60a5fa',
    subText: '#93c5fd',
    trackBg: '#0f2040',
    glowClass: '',
    borderRadius: 8,
    boxShadow: '0 2px 12px rgba(30,58,138,0.5)',
  },
  'carbon-fiber': {
    bg: '#171717',
    border: '#404040',
    text: '#fafafa',
    accent: '#d4d4d4',
    subText: '#737373',
    trackBg: '#0a0a0a',
    glowClass: '',
    borderRadius: 5,
    boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
  },
  'warm-amber': {
    bg: '#431407',
    border: '#d97706',
    text: '#fef3c7',
    accent: '#f59e0b',
    subText: '#fbbf24',
    trackBg: '#1c0a00',
    glowClass: '',
    borderRadius: 8,
    boxShadow: '0 2px 12px rgba(217,119,6,0.25)',
  },
  'arctic-white': {
    bg: '#ffffff',
    border: '#e2e8f0',
    text: '#0f172a',
    accent: '#0284c7',
    subText: '#64748b',
    trackBg: '#f8fafc',
    glowClass: '',
    borderRadius: 10,
    boxShadow: '0 1px 6px rgba(0,0,0,0.1)',
  },
};

export function getThemeVars(theme?: WidgetTheme): ThemeVars {
  return themes[theme ?? 'default'] ?? themes['default'];
}

export function applyThemeToContainerStyle(theme: ThemeVars, overrides: {
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
}): CSSProperties {
  return {
    backgroundColor: overrides.backgroundColor || theme.bg,
    border: `1px solid ${overrides.borderColor || theme.border}`,
    borderRadius: overrides.borderRadius ?? theme.borderRadius,
    boxShadow: theme.boxShadow,
    backdropFilter: theme.backdropFilter,
    WebkitBackdropFilter: theme.backdropFilter,
    color: theme.text,
  };
}
