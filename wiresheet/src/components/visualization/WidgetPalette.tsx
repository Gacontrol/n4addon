import React from 'react';
import {
  ToggleLeft, Square, SlidersHorizontal, PlusCircle, TextCursorInput,
  Gauge, MonitorDot, Lightbulb, BarChart3, Type, Container, Thermometer,
  RectangleHorizontal, Circle, Minus, ArrowRight, Navigation, Home, ChevronLeft,
  Hexagon, Star, Diamond, Plus, Spline, List, PanelLeft
} from 'lucide-react';
import { WidgetTemplate } from '../../types/visualization';
import { widgetTemplates } from '../../data/widgetTemplates';

interface WidgetPaletteProps {
  onDragStart: (template: WidgetTemplate) => void;
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  ToggleLeft,
  Square,
  SlidersHorizontal,
  PlusMinusIcon: PlusCircle,
  TextCursorInput,
  Gauge,
  MonitorDot,
  Lightbulb,
  BarChart3,
  Type,
  Container,
  Thermometer,
  RectangleHorizontal,
  Circle,
  Minus,
  ArrowRight,
  Navigation,
  Home,
  ChevronLeft,
  Hexagon,
  Star,
  Diamond,
  Plus,
  Spline,
  List,
  PanelLeft
};

const categoryLabels: Record<string, string> = {
  control: 'Bedienelemente',
  display: 'Anzeigen',
  indicator: 'Indikatoren',
  decoration: 'Dekoration'
};

const categoryColors: Record<string, string> = {
  control: 'bg-blue-900/50 border-blue-700',
  display: 'bg-green-900/50 border-green-700',
  indicator: 'bg-yellow-900/50 border-yellow-700',
  decoration: 'bg-slate-800/50 border-slate-600'
};

export const WidgetPalette: React.FC<WidgetPaletteProps> = ({ onDragStart }) => {
  const categories = ['control', 'display', 'indicator', 'decoration'] as const;

  const handleDragStart = (e: React.DragEvent, template: WidgetTemplate) => {
    e.dataTransfer.setData('widget-template', JSON.stringify(template));
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(template);
  };

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-700 overflow-y-auto">
      <div className="p-3 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-slate-300">Widgets</h2>
      </div>

      {categories.map((category) => {
        const categoryWidgets = widgetTemplates.filter(t => t.category === category);
        if (categoryWidgets.length === 0) return null;

        return (
          <div key={category} className="p-2">
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 px-1">
              {categoryLabels[category]}
            </h3>
            <div className="space-y-1">
              {categoryWidgets.map((template) => {
                const IconComponent = iconMap[template.icon] || Square;
                return (
                  <div
                    key={template.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, template)}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition-colors hover:bg-opacity-70 ${categoryColors[category]}`}
                  >
                    <IconComponent className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-300 truncate">{template.label}</div>
                      <div className="text-[10px] text-slate-500 truncate">{template.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
