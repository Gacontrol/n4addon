import React from 'react';
import { NodeTemplate } from '../types/flow';
import { nodeTemplates } from '../data/nodeTemplates';
import * as Icons from 'lucide-react';

interface NodePaletteProps {
  onNodePointerDown: (template: NodeTemplate, clientX: number, clientY: number) => void;
}

export const NodePalette: React.FC<NodePaletteProps> = ({ onNodePointerDown }) => {
  const categories: Record<string, { label: string; color: string }> = {
    input: { label: 'HA Eingänge', color: 'bg-blue-500' },
    output: { label: 'HA Ausgänge', color: 'bg-amber-500' },
    datapoint: { label: 'Datenpunkte', color: 'bg-violet-500' },
    logic: { label: 'Logik', color: 'bg-emerald-500' },
    trigger: { label: 'Trigger', color: 'bg-sky-500' }
  };

  const groupedTemplates = nodeTemplates.reduce((acc, template) => {
    if (!acc[template.category]) acc[template.category] = [];
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, NodeTemplate[]>);

  return (
    <div className="w-72 bg-slate-800 border-r border-slate-700 overflow-y-auto flex-shrink-0">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-base font-bold text-white">Bausteine</h2>
        <p className="text-xs text-slate-400 mt-1">Auf Canvas ziehen zum Hinzufügen</p>
      </div>

      <div className="p-3 space-y-5">
        {Object.entries(categories).map(([key, { label, color }]) => {
          const templates = groupedTemplates[key] || [];
          if (templates.length === 0) return null;

          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {label}
                </h3>
              </div>
              <div className="space-y-1.5">
                {templates.map(template => {
                  const IconComponent = Icons[template.icon as keyof typeof Icons] as React.FC<{ className?: string }>;

                  return (
                    <div
                      key={template.type}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        onNodePointerDown(template, e.clientX, e.clientY);
                      }}
                      className="bg-slate-700 hover:bg-slate-600 p-2.5 rounded-lg cursor-grab active:cursor-grabbing transition-colors border border-slate-600 hover:border-slate-500 select-none"
                      style={{ borderLeftWidth: '3px', borderLeftColor: template.color }}
                    >
                      <div className="flex items-center gap-2">
                        {IconComponent && <IconComponent className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                        <span className="text-sm font-medium text-white">{template.label}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 pl-5">{template.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
