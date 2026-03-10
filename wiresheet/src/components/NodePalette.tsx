import React, { useState } from 'react';
import { NodeTemplate } from '../types/flow';
import { nodeTemplates } from '../data/nodeTemplates';
import * as Icons from 'lucide-react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface NodePaletteProps {
  onNodePointerDown: (template: NodeTemplate, clientX: number, clientY: number) => void;
}

interface CategoryConfig {
  label: string;
  color: string;
  icon: keyof typeof Icons;
}

export const NodePalette: React.FC<NodePaletteProps> = ({ onNodePointerDown }) => {
  const categories: Record<string, CategoryConfig> = {
    input: { label: 'HA Eingaenge', color: '#3b82f6', icon: 'ArrowRightToLine' },
    output: { label: 'HA Ausgaenge', color: '#f59e0b', icon: 'ArrowRightFromLine' },
    driver: { label: 'Treiber', color: '#059669', icon: 'Network' },
    datapoint: { label: 'Datenpunkte', color: '#8b5cf6', icon: 'Database' },
    logic: { label: 'Logik', color: '#10b981', icon: 'GitMerge' },
    math: { label: 'Mathematik', color: '#f59e0b', icon: 'Calculator' },
    trigger: { label: 'Trigger', color: '#0ea5e9', icon: 'Zap' },
    special: { label: 'Spezial', color: '#64748b', icon: 'Sparkles' }
  };

  const categoryOrder = ['input', 'output', 'driver', 'datapoint', 'logic', 'math', 'trigger', 'special'];

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['input', 'output', 'logic'])
  );

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const groupedTemplates = nodeTemplates.reduce((acc, template) => {
    if (!acc[template.category]) acc[template.category] = [];
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, NodeTemplate[]>);

  return (
    <div className="h-full bg-slate-800 overflow-y-auto">
      <div className="p-3 border-b border-slate-700 bg-slate-800/80 backdrop-blur sticky top-0 z-10">
        <p className="text-xs text-slate-400">Bausteine auf Canvas ziehen</p>
      </div>

      <div className="p-2 space-y-1">
        {categoryOrder.map(key => {
          const cat = categories[key];
          if (!cat) return null;
          const templates = groupedTemplates[key] || [];
          if (templates.length === 0) return null;
          const isExpanded = expandedCategories.has(key);
          const CatIcon = Icons[cat.icon] as React.FC<{ className?: string }>;

          return (
            <div key={key} className="rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(key)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-700/50 transition-colors"
                style={{ borderLeft: `3px solid ${cat.color}` }}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                )}
                {CatIcon && <CatIcon className="w-4 h-4 flex-shrink-0" style={{ color: cat.color }} />}
                <span className="text-sm font-medium text-slate-200 flex-1">{cat.label}</span>
                <span className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
                  {templates.length}
                </span>
              </button>

              {isExpanded && (
                <div className="py-1 px-1 space-y-1 bg-slate-900/30">
                  {templates.map(template => {
                    const IconComponent = Icons[template.icon as keyof typeof Icons] as React.FC<{ className?: string }>;

                    return (
                      <div
                        key={template.type}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          onNodePointerDown(template, e.clientX, e.clientY);
                        }}
                        className="bg-slate-700/60 hover:bg-slate-600/80 px-3 py-2 rounded cursor-grab active:cursor-grabbing transition-all border border-transparent hover:border-slate-500/50 select-none group"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${template.color}20` }}
                          >
                            {IconComponent && (
                              <IconComponent
                                className="w-3.5 h-3.5"
                                style={{ color: template.color }}
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-white block truncate">
                              {template.label}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {template.description}
                            </span>
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
    </div>
  );
};
