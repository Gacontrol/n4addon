import React, { useState } from 'react';
import { NodeTemplate } from '../types/flow';
import { nodeTemplates } from '../data/nodeTemplates';
import * as Icons from 'lucide-react';

interface NodePaletteProps {
  onNodePointerDown: (template: NodeTemplate, clientX: number, clientY: number) => void;
}

interface GroupConfig {
  key: string;
  label: string;
  categories: string[];
  dot: string;
  bg: string;
}

const groups: GroupConfig[] = [
  {
    key: 'io',
    label: 'Home Assistant',
    categories: ['input', 'output'],
    dot: '#3b82f6',
    bg: 'rgba(59,130,246,0.06)'
  },
  {
    key: 'datapoint',
    label: 'Datenpunkte',
    categories: ['datapoint'],
    dot: '#8b5cf6',
    bg: 'rgba(139,92,246,0.06)'
  },
  {
    key: 'logic',
    label: 'Logik',
    categories: ['logic'],
    dot: '#10b981',
    bg: 'rgba(16,185,129,0.06)'
  },
  {
    key: 'math',
    label: 'Mathematik',
    categories: ['math'],
    dot: '#f59e0b',
    bg: 'rgba(245,158,11,0.06)'
  },
  {
    key: 'trigger',
    label: 'Trigger',
    categories: ['trigger'],
    dot: '#0ea5e9',
    bg: 'rgba(14,165,233,0.06)'
  },
  {
    key: 'special',
    label: 'Spezial',
    categories: ['special'],
    dot: '#64748b',
    bg: 'rgba(100,116,139,0.06)'
  },
  {
    key: 'complex',
    label: 'Komplexe Bausteine',
    categories: ['complex'],
    dot: '#ef4444',
    bg: 'rgba(239,68,68,0.06)'
  },
  {
    key: 'driver',
    label: 'Treiber',
    categories: ['driver'],
    dot: '#059669',
    bg: 'rgba(5,150,105,0.06)'
  }
];

export const NodePalette: React.FC<NodePaletteProps> = ({ onNodePointerDown }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    datapoint: true,
    math: true,
    trigger: true,
    special: true,
    driver: true
  });

  const toggleGroup = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="h-full bg-slate-900 overflow-y-auto flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-800 sticky top-0 z-10 bg-slate-900">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Bausteine</h2>
        <p className="text-[10px] text-slate-600 mt-0.5">Auf Canvas ziehen</p>
      </div>

      {groups.map(group => {
        const items = nodeTemplates.filter(t => group.categories.includes(t.category));
        if (items.length === 0) return null;
        const isOpen = !collapsed[group.key];

        return (
          <div key={group.key} className="border-b border-slate-800/60">
            <button
              onClick={() => toggleGroup(group.key)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-800/50 transition-colors text-left"
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: group.dot }}
              />
              <span className="text-xs font-semibold text-slate-200 flex-1">{group.label}</span>
              <span className="text-[10px] text-slate-500 tabular-nums">{items.length}</span>
              <svg
                className="w-3 h-3 text-slate-500 transition-transform duration-200 flex-shrink-0"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isOpen && (
              <div className="pb-1.5 px-2" style={{ backgroundColor: group.bg }}>
                {items.map(template => {
                  const IconComponent = Icons[template.icon as keyof typeof Icons] as React.FC<{ className?: string }>;
                  return (
                    <div
                      key={template.type}
                      onPointerDown={e => {
                        e.preventDefault();
                        onNodePointerDown(template, e.clientX, e.clientY);
                      }}
                      className="flex items-center gap-2.5 px-2 py-2 rounded-md cursor-grab active:cursor-grabbing transition-colors hover:bg-white/5 select-none group"
                    >
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${template.color}22` }}
                      >
                        {IconComponent && (
                          <IconComponent
                            className="w-3.5 h-3.5 flex-shrink-0"
                            style={{ color: template.color }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-200 truncate leading-tight font-medium">
                          {template.label}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                          {template.description}
                        </div>
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
