import React, { useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Home, LayoutDashboard, Settings, Activity, Zap, Thermometer,
  BarChart2, Cpu, Globe, Bell, FileText, Layers, Monitor,
  Wind, Droplets, Sun, Power, Map
} from 'lucide-react';
import { FrameConfig, FrameItem } from '../../types/visualization';

interface VisuFrameProps {
  config: FrameConfig;
  isEditMode: boolean;
  activePageId?: string;
  onNavigateToPage?: (pageId: string) => void;
  visuPages?: { id: string; name: string }[];
}

const iconMap: Record<string, React.FC<{ className?: string; size?: number }>> = {
  Home,
  LayoutDashboard,
  Settings,
  Activity,
  Zap,
  Thermometer,
  BarChart2,
  Cpu,
  Globe,
  Bell,
  FileText,
  Layers,
  Monitor,
  Wind,
  Droplets,
  Sun,
  Power,
  Map
};

export const VisuFrame: React.FC<VisuFrameProps> = ({
  config,
  isEditMode,
  activePageId,
  onNavigateToPage,
  visuPages = []
}) => {
  const [collapsed, setCollapsed] = useState(config.defaultCollapsed ?? false);

  const pos = config.position ?? 'left';
  const isVertical = pos === 'left' || pos === 'right';
  const accent = config.accentColor || '#3b82f6';
  const bg = config.backgroundColor || '#0f172a';
  const text = config.textColor || '#e2e8f0';

  const toggleBtn = config.collapsible !== false ? (
    <button
      className="flex items-center justify-center transition-colors hover:opacity-80 flex-shrink-0"
      style={{ color: text, opacity: 0.6 }}
      onClick={(e) => {
        e.stopPropagation();
        setCollapsed(c => !c);
      }}
      title={collapsed ? 'Aufklappen' : 'Einklappen'}
    >
      {isVertical ? (
        pos === 'left'
          ? (collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)
          : (collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)
      ) : (
        pos === 'top'
          ? (collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />)
          : (collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />)
      )}
    </button>
  ) : null;

  const renderItem = (item: FrameItem, index: number) => {
    if (item.type === 'section') {
      if (collapsed && isVertical) return null;
      return (
        <div key={item.id} className={`${index > 0 ? 'mt-3' : ''}`}>
          <div
            className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest truncate"
            style={{ color: accent, opacity: 0.8 }}
          >
            {collapsed && isVertical ? null : item.label}
          </div>
          <div className="h-px mx-3 mb-1" style={{ backgroundColor: accent, opacity: 0.2 }} />
        </div>
      );
    }

    const isActive = item.targetPageId && item.targetPageId === activePageId;
    const IconComp = item.icon ? iconMap[item.icon] : null;

    return (
      <button
        key={item.id}
        className={`w-full flex items-center gap-2.5 rounded-lg transition-all text-left group relative
          ${collapsed && isVertical ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
          ${isEditMode ? 'cursor-default' : 'cursor-pointer'}
        `}
        style={{
          color: isActive ? '#fff' : text,
          backgroundColor: isActive ? accent : 'transparent',
          opacity: isActive ? 1 : 0.75
        }}
        onMouseEnter={e => {
          if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${accent}22`;
        }}
        onMouseLeave={e => {
          if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isEditMode && item.targetPageId) {
            onNavigateToPage?.(item.targetPageId);
          }
        }}
        title={collapsed && isVertical ? item.label : undefined}
      >
        {IconComp && (
          <IconComp
            size={16}
            className="flex-shrink-0"
          />
        )}
        {!IconComp && collapsed && isVertical && (
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: isActive ? '#fff' : text, opacity: isActive ? 1 : 0.5 }}
          />
        )}
        {(!collapsed || !isVertical) && (
          <span className="text-sm truncate font-medium">{item.label}</span>
        )}
        {isActive && !collapsed && isVertical && (
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-l"
            style={{ backgroundColor: '#fff', opacity: 0.6 }}
          />
        )}
      </button>
    );
  };

  if (isVertical) {
    return (
      <div
        className="h-full flex flex-col transition-all duration-200"
        style={{
          backgroundColor: bg,
          width: collapsed ? 48 : '100%',
          minWidth: collapsed ? 48 : undefined,
          maxWidth: '100%',
          overflow: 'hidden',
          borderRight: pos === 'left' ? `1px solid ${accent}22` : undefined,
          borderLeft: pos === 'right' ? `1px solid ${accent}22` : undefined,
        }}
      >
        <div
          className="flex items-center justify-between px-3 py-3 border-b flex-shrink-0"
          style={{ borderColor: `${accent}22` }}
        >
          {!collapsed && config.title && (
            <span className="text-sm font-semibold truncate" style={{ color: text }}>
              {config.title}
            </span>
          )}
          {collapsed && (
            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mx-auto"
              style={{ backgroundColor: `${accent}33` }}>
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: accent }} />
            </div>
          )}
          <div className={collapsed ? 'w-full flex justify-center' : ''}>
            {toggleBtn}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-1.5 space-y-0.5">
          {config.items.map((item, i) => renderItem(item, i))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full flex flex-col transition-all duration-200 overflow-hidden"
      style={{
        backgroundColor: bg,
        height: collapsed ? 44 : '100%',
        borderBottom: pos === 'top' ? `1px solid ${accent}22` : undefined,
        borderTop: pos === 'bottom' ? `1px solid ${accent}22` : undefined,
      }}
    >
      <div
        className="flex items-center gap-3 px-3 flex-shrink-0"
        style={{ height: 44, borderBottom: !collapsed ? `1px solid ${accent}22` : undefined }}
      >
        {config.title && (
          <span className="text-sm font-semibold" style={{ color: text }}>
            {config.title}
          </span>
        )}
        {!collapsed && (
          <div className="flex-1 flex items-center gap-1 overflow-x-auto">
            {config.items.filter(i => i.type === 'nav-button').map((item) => {
              const isActive = item.targetPageId && item.targetPageId === activePageId;
              const IconComp = item.icon ? iconMap[item.icon] : null;
              return (
                <button
                  key={item.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0"
                  style={{
                    color: isActive ? '#fff' : text,
                    backgroundColor: isActive ? accent : `${accent}15`,
                    opacity: isActive ? 1 : 0.75
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isEditMode && item.targetPageId) onNavigateToPage?.(item.targetPageId);
                  }}
                >
                  {IconComp && <IconComp size={14} />}
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
        <div className="ml-auto flex-shrink-0">{toggleBtn}</div>
      </div>
    </div>
  );
};
