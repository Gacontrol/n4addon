import React from 'react';
import { NodeTemplate } from '../types/flow';
import { nodeTemplates } from '../data/nodeTemplates';
import * as Icons from 'lucide-react';

interface NodePaletteProps {
  onNodeDragStart: (template: NodeTemplate) => void;
}

export const NodePalette: React.FC<NodePaletteProps> = ({ onNodeDragStart }) => {
  const categories = {
    sensor: { label: 'Sensoren', color: 'bg-blue-500' },
    actuator: { label: 'Aktoren', color: 'bg-amber-500' },
    logic: { label: 'Logik', color: 'bg-green-500' },
    trigger: { label: 'Trigger', color: 'bg-purple-500' }
  };

  const groupedTemplates = nodeTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, NodeTemplate[]>);

  return (
    <div className="w-80 bg-slate-800 border-r border-slate-700 overflow-y-auto">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-xl font-bold text-white">Komponenten</h2>
        <p className="text-sm text-slate-400 mt-1">Ziehe Bausteine auf das Canvas</p>
      </div>

      <div className="p-4 space-y-6">
        {Object.entries(categories).map(([key, { label, color }]) => {
          const templates = groupedTemplates[key] || [];
          if (templates.length === 0) return null;

          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                  {label}
                </h3>
              </div>
              <div className="space-y-2">
                {templates.map(template => {
                  const IconComponent = Icons[template.icon as keyof typeof Icons] as React.FC<{ className?: string }>;

                  return (
                    <div
                      key={template.type}
                      draggable
                      onDragStart={() => onNodeDragStart(template)}
                      className="bg-slate-700 hover:bg-slate-600 p-3 rounded-lg cursor-move transition-colors border border-slate-600 hover:border-slate-500"
                      style={{ borderLeftWidth: '3px', borderLeftColor: template.color }}
                    >
                      <div className="flex items-center gap-2">
                        {IconComponent && <IconComponent className="w-4 h-4 text-slate-300" />}
                        <span className="text-sm font-medium text-white">{template.label}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{template.description}</p>
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
