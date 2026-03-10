import React from 'react';
import { Home, ChevronLeft, Navigation } from 'lucide-react';
import {
  VisuWidget as VisuWidgetType,
  SwitchConfig,
  ButtonConfig,
  SliderConfig,
  IncrementerConfig,
  InputConfig,
  MultistateConfig,
  GaugeConfig,
  DisplayConfig,
  LedConfig,
  BarConfig,
  LabelConfig,
  TankConfig,
  ThermometerConfig,
  RectConfig,
  CircleConfig,
  LineConfig,
  ArrowConfig,
  NavButtonConfig,
  HomeButtonConfig,
  BackButtonConfig
} from '../../types/visualization';
import {
  VisuSwitch,
  VisuButton,
  VisuSlider,
  VisuIncrementer,
  VisuInput,
  VisuGauge,
  VisuDisplay,
  VisuLed,
  VisuBar,
  VisuTank,
  VisuThermometer,
  VisuLabel,
  VisuMultistate
} from './index';

interface VisuWidgetProps {
  widget: VisuWidgetType;
  value: unknown;
  statusValue?: unknown;
  onValueChange: (value: unknown) => void;
  isEditMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
  onNavigateToPage?: (pageId: string) => void;
  onNavigateBack?: () => void;
  onNavigateHome?: () => void;
  visuPages?: { id: string; name: string }[];
}

export const VisuWidgetRenderer: React.FC<VisuWidgetProps> = ({
  widget,
  value,
  statusValue,
  onValueChange,
  isEditMode,
  isSelected,
  onSelect,
  onDoubleClick,
  onNavigateToPage,
  onNavigateBack,
  onNavigateHome,
  visuPages = []
}) => {
  const renderWidget = () => {
    switch (widget.type) {
      case 'visu-switch': {
        const swCfg = widget.config as SwitchConfig;
        const isWriteOnly = !!widget.binding && widget.binding.direction === 'write';
        const switchValue = isWriteOnly
          ? Boolean(statusValue ?? swCfg.defaultValue ?? false)
          : Boolean(value ?? swCfg.defaultValue ?? false);
        return (
          <VisuSwitch
            value={switchValue}
            statusValue={widget.statusBinding ? Boolean(statusValue) : undefined}
            onChange={onValueChange}
            config={swCfg}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
            writeOnly={isWriteOnly && !widget.statusBinding}
          />
        );
      }

      case 'visu-button':
        return (
          <VisuButton
            onValueChange={onValueChange}
            config={widget.config as ButtonConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
            statusValue={statusValue}
          />
        );

      case 'visu-multistate':
        return (
          <VisuMultistate
            value={value as number | string | null}
            onChange={onValueChange}
            config={widget.config as MultistateConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );

      case 'visu-slider':
        return (
          <VisuSlider
            value={typeof value === 'number' ? value : 0}
            onChange={(v) => onValueChange(v)}
            config={widget.config as SliderConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
            width={widget.size.width - 20}
          />
        );

      case 'visu-incrementer':
        return (
          <VisuIncrementer
            value={typeof value === 'number' ? value : 0}
            onChange={(v) => onValueChange(v)}
            config={widget.config as IncrementerConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );

      case 'visu-input':
        return (
          <VisuInput
            value={value as number | string}
            onChange={(v) => onValueChange(v)}
            config={widget.config as InputConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );

      case 'visu-gauge':
        return (
          <VisuGauge
            value={typeof value === 'number' ? value : 0}
            config={widget.config as GaugeConfig}
            style={widget.style}
            label={widget.label}
            size={widget.size}
          />
        );

      case 'visu-display':
        return (
          <VisuDisplay
            value={value as number | string | boolean | null}
            config={widget.config as DisplayConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'visu-led':
        return (
          <VisuLed
            value={Boolean(value)}
            config={widget.config as LedConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'visu-bar':
        return (
          <VisuBar
            value={typeof value === 'number' ? value : 0}
            config={widget.config as BarConfig}
            style={widget.style}
            label={widget.label}
            size={widget.size}
          />
        );

      case 'visu-tank':
        return (
          <VisuTank
            value={typeof value === 'number' ? value : 0}
            config={widget.config as TankConfig}
            style={widget.style}
            label={widget.label}
            size={widget.size}
          />
        );

      case 'visu-thermometer':
        return (
          <VisuThermometer
            value={typeof value === 'number' ? value : 0}
            config={widget.config as ThermometerConfig}
            style={widget.style}
            label={widget.label}
            size={widget.size}
          />
        );

      case 'visu-label':
        return (
          <VisuLabel
            config={widget.config as LabelConfig}
            style={widget.style}
          />
        );

      case 'visu-rect': {
        const rCfg = widget.config as RectConfig;
        return (
          <svg width="100%" height="100%" style={{ overflow: 'visible', opacity: rCfg.opacity ?? 1 }}>
            <rect
              x="0" y="0"
              width="100%" height="100%"
              fill={rCfg.fillColor || '#1e293b'}
              stroke={rCfg.strokeColor || '#475569'}
              strokeWidth={rCfg.strokeWidth ?? 2}
              rx={widget.style.borderRadius ?? 4}
            />
          </svg>
        );
      }

      case 'visu-circle': {
        const cCfg = widget.config as CircleConfig;
        const cx = widget.size.width / 2;
        const cy = widget.size.height / 2;
        const rx = Math.max(1, cx - (cCfg.strokeWidth ?? 2) / 2);
        const ry = Math.max(1, cy - (cCfg.strokeWidth ?? 2) / 2);
        return (
          <svg width="100%" height="100%" style={{ overflow: 'visible', opacity: cCfg.opacity ?? 1 }}>
            <ellipse
              cx={cx} cy={cy} rx={rx} ry={ry}
              fill={cCfg.fillColor || '#1e293b'}
              stroke={cCfg.strokeColor || '#475569'}
              strokeWidth={cCfg.strokeWidth ?? 2}
            />
          </svg>
        );
      }

      case 'visu-line': {
        const lCfg = widget.config as LineConfig;
        const cy = widget.size.height / 2;
        return (
          <svg width="100%" height="100%" style={{ overflow: 'visible', opacity: lCfg.opacity ?? 1 }}>
            <line
              x1="0" y1={cy} x2={widget.size.width} y2={cy}
              stroke={lCfg.strokeColor || '#64748b'}
              strokeWidth={lCfg.strokeWidth ?? 2}
            />
          </svg>
        );
      }

      case 'visu-arrow': {
        const aCfg = widget.config as ArrowConfig;
        const cy = widget.size.height / 2;
        const sw = aCfg.strokeWidth ?? 2;
        const arrowSize = Math.max(8, sw * 3);
        const markerId = `arrowhead-${widget.id}`;
        const markerStartId = `arrowhead-start-${widget.id}`;
        return (
          <svg width="100%" height="100%" style={{ overflow: 'visible', opacity: aCfg.opacity ?? 1 }}>
            <defs>
              <marker id={markerId} markerWidth={arrowSize} markerHeight={arrowSize} refX={arrowSize - 1} refY={arrowSize / 2} orient="auto">
                <polygon points={`0 0, ${arrowSize} ${arrowSize / 2}, 0 ${arrowSize}`} fill={aCfg.strokeColor || '#64748b'} />
              </marker>
              <marker id={markerStartId} markerWidth={arrowSize} markerHeight={arrowSize} refX="1" refY={arrowSize / 2} orient="auto-start-reverse">
                <polygon points={`0 0, ${arrowSize} ${arrowSize / 2}, 0 ${arrowSize}`} fill={aCfg.strokeColor || '#64748b'} />
              </marker>
            </defs>
            <line
              x1={aCfg.arrowStart ? arrowSize : 0} y1={cy}
              x2={aCfg.arrowEnd ? widget.size.width - arrowSize : widget.size.width} y2={cy}
              stroke={aCfg.strokeColor || '#64748b'}
              strokeWidth={sw}
              markerEnd={aCfg.arrowEnd ? `url(#${markerId})` : undefined}
              markerStart={aCfg.arrowStart ? `url(#${markerStartId})` : undefined}
            />
          </svg>
        );
      }

      case 'visu-nav-button': {
        const navCfg = widget.config as NavButtonConfig;
        if (isEditMode) {
          return (
            <div
              className="w-full h-full flex items-center justify-center gap-2 rounded-lg text-white font-medium text-sm"
              style={{ backgroundColor: navCfg.color || '#3b82f6' }}
            >
              <Navigation className="w-4 h-4" />
              {navCfg.label || 'Seite'}
            </div>
          );
        }
        return (
          <button
            className="w-full h-full flex items-center justify-center gap-2 rounded-lg text-white font-medium text-sm transition-all active:scale-95"
            style={{ backgroundColor: navCfg.color || '#3b82f6' }}
            onClick={(e) => {
              if (navCfg.targetPageId) {
                e.stopPropagation();
                onNavigateToPage?.(navCfg.targetPageId);
              }
            }}
          >
            <Navigation className="w-4 h-4" />
            {navCfg.label || 'Seite'}
          </button>
        );
      }

      case 'visu-home-button': {
        const homeCfg = widget.config as HomeButtonConfig & { homePageId?: string };
        if (isEditMode) {
          return (
            <div
              className="w-full h-full flex items-center justify-center gap-2 rounded-lg text-white font-medium text-sm"
              style={{ backgroundColor: homeCfg.color || '#10b981' }}
            >
              <Home className="w-4 h-4" />
              {homeCfg.label || 'Home'}
            </div>
          );
        }
        return (
          <button
            className="w-full h-full flex items-center justify-center gap-2 rounded-lg text-white font-medium text-sm transition-all active:scale-95"
            style={{ backgroundColor: homeCfg.color || '#10b981' }}
            onClick={(e) => {
              e.stopPropagation();
              if (homeCfg.homePageId) {
                onNavigateToPage?.(homeCfg.homePageId);
              } else {
                onNavigateHome?.();
              }
            }}
          >
            <Home className="w-4 h-4" />
            {homeCfg.label || 'Home'}
          </button>
        );
      }

      case 'visu-back-button': {
        const backCfg = widget.config as BackButtonConfig;
        if (isEditMode) {
          return (
            <div
              className="w-full h-full flex items-center justify-center gap-2 rounded-lg text-white font-medium text-sm"
              style={{ backgroundColor: backCfg.color || '#64748b' }}
            >
              <ChevronLeft className="w-4 h-4" />
              {backCfg.label || 'Zurueck'}
            </div>
          );
        }
        return (
          <button
            className="w-full h-full flex items-center justify-center gap-2 rounded-lg text-white font-medium text-sm transition-all active:scale-95"
            style={{ backgroundColor: backCfg.color || '#64748b' }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigateBack?.();
            }}
          >
            <ChevronLeft className="w-4 h-4" />
            {backCfg.label || 'Zurueck'}
          </button>
        );
      }

      default:
        return <div className="text-red-400">Unbekannter Widget-Typ</div>;
    }
  };

  const isDrawingWidget = ['visu-rect', 'visu-circle', 'visu-line', 'visu-arrow'].includes(widget.type);
  const isNavWidget = ['visu-nav-button', 'visu-home-button', 'visu-back-button'].includes(widget.type);

  return (
    <div
      className={`absolute ${isEditMode ? 'cursor-move' : ''} ${isDrawingWidget || isNavWidget ? '' : 'flex items-center justify-center'}`}
      style={{
        left: widget.position.x,
        top: widget.position.y,
        width: widget.size.width,
        height: widget.size.height,
        zIndex: widget.zIndex || 1,
        backgroundColor: isDrawingWidget ? 'transparent' : widget.style.backgroundColor,
        borderRadius: isDrawingWidget ? 0 : (widget.style.borderRadius ?? 8),
        border: isSelected ? '2px solid #3b82f6' : (!isDrawingWidget && widget.style.borderColor) ? `1px solid ${widget.style.borderColor}` : 'none',
        padding: isDrawingWidget || isNavWidget ? 0 : 8
      }}
      onClick={(e) => {
        if (isEditMode) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onDoubleClick={(e) => {
        if (isEditMode) {
          e.stopPropagation();
          onDoubleClick();
        }
      }}
    >
      {renderWidget()}
      {isEditMode && isSelected && (
        <>
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-nw-resize" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-ne-resize" />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-sw-resize" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-se-resize" />
        </>
      )}
    </div>
  );
};
