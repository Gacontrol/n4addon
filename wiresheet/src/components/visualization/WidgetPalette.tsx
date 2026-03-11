import React, { useState } from 'react';
import {
  ToggleLeft, Square, SlidersHorizontal, PlusCircle, TextCursorInput,
  Gauge, MonitorDot, Lightbulb, BarChart3, Type, Container,
  Thermometer, RectangleHorizontal, Circle, Minus, ArrowRight,
  Navigation, Home, ChevronLeft, Hexagon, Star, Diamond, Plus,
  Spline, List, PanelLeft, Image as ImageIcon,
  TrendingUp, Activity, Zap
} from 'lucide-react';
import { WidgetTemplate } from '../../types/visualization';
import { widgetTemplates } from '../../data/widgetTemplates';

interface WidgetPaletteProps {
  onDragStart: (template: WidgetTemplate) => void;
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  ToggleLeft, Square, SlidersHorizontal,
  PlusMinusIcon: PlusCircle,
  TextCursorInput, Gauge, MonitorDot, Lightbulb, BarChart3,
  Type, Container, Thermometer, RectangleHorizontal, Circle,
  Minus, ArrowRight, Navigation, Home, ChevronLeft, Hexagon,
  Star, Diamond, Plus, Spline, List, PanelLeft, ImageIcon,
  TrendingUp, Activity, Zap
};

const groups: { key: string; label: string; categories: string[]; color: string; dot: string }[] = [
  {
    key: 'classic-control',
    label: 'Classic – Bedienen',
    categories: ['control'],
    color: 'rgba(59,130,246,0.08)',
    dot: '#3b82f6'
  },
  {
    key: 'classic-display',
    label: 'Classic – Anzeigen',
    categories: ['display', 'indicator'],
    color: 'rgba(34,197,94,0.08)',
    dot: '#22c55e'
  },
  {
    key: 'classic-deco',
    label: 'Classic – Dekoration',
    categories: ['decoration'],
    color: 'rgba(100,116,139,0.08)',
    dot: '#64748b'
  },
  {
    key: 'modern',
    label: 'Modern',
    categories: ['modern'],
    color: 'rgba(14,165,233,0.08)',
    dot: '#0ea5e9'
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    categories: ['dashboard'],
    color: 'rgba(168,85,247,0.06)',
    dot: '#a855f7'
  }
];

export const WidgetPalette: React.FC<WidgetPaletteProps> = ({ onDragStart }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleDragStart = (e: React.DragEvent, template: WidgetTemplate) => {
    e.dataTransfer.setData('widget-template', JSON.stringify(template));
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(template);
  };

  const toggleGroup = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="w-60 bg-slate-900 border-r border-slate-800 overflow-y-auto flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-800">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Widgets</h2>
      </div>

      {groups.map((group) => {
        const items = widgetTemplates.filter(t => group.categories.includes(t.category));
        if (items.length === 0) return null;
        const isOpen = !collapsed[group.key];

        return (
          <div key={group.key} className="border-b border-slate-800/60">
            <button
              onClick={() => toggleGroup(group.key)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800/40 transition-colors text-left"
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: group.dot }} />
              <span className="text-xs font-semibold text-slate-300 flex-1">{group.label}</span>
              <span className="text-[10px] text-slate-600 tabular-nums">{items.length}</span>
              <svg
                className="w-3 h-3 text-slate-600 transition-transform duration-200 flex-shrink-0"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isOpen && (
              <div className="pb-1.5 px-2" style={{ backgroundColor: group.color }}>
                {items.map((template) => {
                  const IconComponent = iconMap[template.icon] ?? Square;
                  return (
                    <div
                      key={template.type}
                      draggable
                      onDragStart={(e) => handleDragStart(e, template)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-colors hover:bg-white/5 select-none"
                    >
                      <IconComponent className="w-3.5 h-3.5 flex-shrink-0" style={{ color: group.dot }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-300 truncate leading-tight">{template.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
