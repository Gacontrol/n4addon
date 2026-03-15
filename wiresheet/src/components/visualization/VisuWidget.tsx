import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  PolygonConfig,
  StarConfig,
  DiamondConfig,
  CrossConfig,
  PolylineConfig,
  NavButtonConfig,
  HomeButtonConfig,
  BackButtonConfig,
  FrameConfig,
  ImageConfig,
  ModernSwitchConfig,
  ModernButtonConfig,
  ModernGaugeConfig,
  ModernDisplayConfig,
  ModernBarConfig,
  ModernLedConfig,
  ModernSliderConfig,
  DashStatConfig,
  DashProgressConfig,
  DashValueCardConfig,
  DashToggleCardConfig,
  DashBatteryConfig,
  DashSignalConfig,
  DashSparklineConfig,
  DashMultivalueConfig,
  DashHeatbarConfig,
  DashCompassConfig,
  DashClockConfig,
  DashRatingConfig,
  DashLevelConfig,
  DashWindConfig,
  DashMultistateConfig,
  ModernMultistateConfig,
  PumpWidgetConfig,
  ValveWidgetConfig,
  SensorWidgetConfig,
  PIDWidgetConfig,
  AlarmConsoleWidgetConfig,
  TrendChartConfig
} from '../../types/visualization';
import { AlarmClass, AlarmConsole, ActiveAlarm } from '../../types/alarm';
import { VisuFrame } from './VisuFrame';
import { VisuPump } from './VisuPump';
import { VisuValve } from './VisuValve';
import { VisuSensor } from './VisuSensor';
import { VisuPID } from './VisuPID';
import { VisuHeatingCurve } from './VisuHeatingCurve';
import { VisuAlarmConsole } from './VisuAlarmConsole';
import { VisuTrendChart } from './VisuTrendChart';
import { VisuImage } from './VisuImage';
import { getThemeVars } from '../../utils/widgetThemes';
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
import {
  ModernSwitch,
  ModernButton,
  ModernGauge,
  ModernDisplay,
  ModernBar,
  ModernLed,
  ModernSlider,
  ModernMultistate
} from './ModernWidgets';
import {
  DashStat,
  DashProgress,
  DashValueCard,
  DashToggleCard,
  DashBattery,
  DashSignal,
  DashSparkline,
  DashMultivalue,
  DashHeatbar,
  DashCompass,
  DashClock,
  DashRating,
  DashLevel,
  DashWind,
  DashMultistate
} from './DashboardWidgets';

interface PumpParams {
  pumpName?: string;
  pumpStartDelayMs?: number;
  pumpStopDelayMs?: number;
  pumpFeedbackTimeoutMs?: number;
  pumpEnableFeedback?: boolean;
  pumpSpeedMin?: number;
  pumpSpeedMax?: number;
  pumpAntiSeizeIntervalMs?: number;
  pumpAntiSeizeRunMs?: number;
  pumpAntiSeizeSpeed?: number;
}

interface ValveParams {
  valveName?: string;
  valveMinOutput?: number;
  valveMaxOutput?: number;
  valveMonitoringEnable?: boolean;
  valveTolerance?: number;
  valveAlarmDelayMs?: number;
}

interface SensorParams {
  sensorName?: string;
  sensorMinLimit?: number;
  sensorMaxLimit?: number;
  sensorUnit?: string;
  sensorMonitoringEnable?: boolean;
  sensorAlarmDelayMs?: number;
  sensorRangeMin?: number;
  sensorRangeMax?: number;
}

interface PIDParams {
  pidName?: string;
  pidKp?: number;
  pidKi?: number;
  pidKd?: number;
  pidWindupLimit?: number;
  pidMinOutput?: number;
  pidMaxOutput?: number;
}

interface HeatingCurveParams {
  hcName?: string;
  hcMinInput?: number;
  hcMaxInput?: number;
  hcMinOutput?: number;
  hcMaxOutput?: number;
  hcReverseDirection?: boolean;
}

interface VisuWidgetProps {
  widget: VisuWidgetType;
  value: unknown;
  statusValue?: unknown;
  onValueChange: (value: unknown) => void;
  onUpdateConfig?: (config: Record<string, unknown>) => void;
  isEditMode: boolean;
  isSelected: boolean;
  isMultiSelected?: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onNavigateToPage?: (pageId: string) => void;
  onNavigateBack?: () => void;
  onNavigateHome?: () => void;
  visuPages?: { id: string; name: string }[];
  pumpParams?: PumpParams;
  valveParams?: ValveParams;
  sensorParams?: SensorParams;
  pidParams?: PIDParams;
  heatingCurveParams?: HeatingCurveParams;
  isHighlighted?: boolean;
  alarmClasses?: AlarmClass[];
  alarmConsoles?: AlarmConsole[];
  activeAlarms?: ActiveAlarm[];
  onAcknowledgeAlarm?: (alarmId: string) => void;
  onAcknowledgeAll?: () => void;
  onClearAlarm?: (alarmId: string) => void;
  onShelveAlarm?: (alarmId: string, durationMs: number, reason?: string) => void;
}

function makePolygonPoints(cx: number, cy: number, rx: number, ry: number, sides: number): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    pts.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

function makeStarPoints(cx: number, cy: number, rx: number, ry: number, points: number, innerRatio: number): string {
  const pts: string[] = [];
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
    const r = i % 2 === 0 ? 1 : innerRatio;
    pts.push(`${cx + rx * r * Math.cos(angle)},${cy + ry * r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

function makeDiamondPoints(w: number, h: number): string {
  return `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
}

function makeCrossPoints(w: number, h: number, armRatio: number): string {
  const a = armRatio;
  const x1 = w * (0.5 - a / 2), x2 = w * (0.5 + a / 2);
  const y1 = h * (0.5 - a / 2), y2 = h * (0.5 + a / 2);
  return `${x1},0 ${x2},0 ${x2},${y1} ${w},${y1} ${w},${y2} ${x2},${y2} ${x2},${h} ${x1},${h} ${x1},${y2} 0,${y2} 0,${y1} ${x1},${y1}`;
}

function resolveShapeColor(cfg: RectConfig | CircleConfig | PolygonConfig | StarConfig | DiamondConfig | CrossConfig, value: unknown): string {
  if (cfg.activeColor && cfg.inactiveColor) {
    return value ? cfg.activeColor : cfg.inactiveColor;
  }
  if (cfg.activeColor && value) return cfg.activeColor;
  return cfg.fillColor || 'transparent';
}

function resolveLineColor(cfg: LineConfig | ArrowConfig, value: unknown): string {
  if (cfg.activeColor && cfg.inactiveColor) {
    return value ? cfg.activeColor : cfg.inactiveColor;
  }
  if (cfg.activeColor && value) return cfg.activeColor;
  return cfg.strokeColor || 'transparent';
}

export const VisuWidgetRenderer: React.FC<VisuWidgetProps> = ({
  widget,
  value,
  statusValue,
  onValueChange,
  onUpdateConfig,
  isEditMode,
  isSelected,
  isMultiSelected = false,
  onSelect,
  onDoubleClick,
  onMouseDown,
  onContextMenu,
  onNavigateToPage,
  onNavigateBack,
  onNavigateHome,
  visuPages = [],
  pumpParams,
  valveParams,
  sensorParams,
  pidParams,
  heatingCurveParams,
  isHighlighted = false,
  alarmClasses = [],
  alarmConsoles = [],
  activeAlarms = [],
  onAcknowledgeAlarm,
  onAcknowledgeAll,
  onClearAlarm,
  onShelveAlarm
}) => {
  const [draggingVertex, setDraggingVertex] = useState<{ type: 'polyline' | 'polygon' | 'line'; index: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleVertexMouseDown = useCallback((e: React.MouseEvent, type: 'polyline' | 'polygon' | 'line', index: number, pt: { x: number; y: number }) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingVertex({ type, index, startX: e.clientX, startY: e.clientY, origX: pt.x, origY: pt.y });
  }, []);

  useEffect(() => {
    if (!draggingVertex) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - draggingVertex.startX;
      const dy = e.clientY - draggingVertex.startY;
      const nx = draggingVertex.origX + dx;
      const ny = draggingVertex.origY + dy;
      if (draggingVertex.type === 'polyline') {
        const plCfg = widget.config as PolylineConfig;
        const newPoints = plCfg.points.map((p, i) =>
          i === draggingVertex.index ? { x: nx, y: ny } : p
        );
        onUpdateConfig?.({ ...plCfg, points: newPoints });
      } else if (draggingVertex.type === 'polygon') {
        const pgCfg = widget.config as PolygonConfig;
        const pts = pgCfg.points || [];
        const newPoints = pts.map((p, i) =>
          i === draggingVertex.index ? { x: nx, y: ny } : p
        );
        onUpdateConfig?.({ ...pgCfg, points: newPoints });
      } else if (draggingVertex.type === 'line') {
        const lCfg = widget.config as LineConfig;
        if (draggingVertex.index === 0) {
          onUpdateConfig?.({ ...lCfg, x1: nx, y1: ny });
        } else {
          onUpdateConfig?.({ ...lCfg, x2: nx, y2: ny });
        }
      }
    };
    const handleUp = () => setDraggingVertex(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [draggingVertex, widget.config, onUpdateConfig]);

  const handleShapeClick = (cfg: { navigateToPageId?: string }) => {
    if (isEditMode) return;
    if (cfg.navigateToPageId) {
      onNavigateToPage?.(cfg.navigateToPageId);
    }
  };

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

      case 'visu-multistate': {
        const msDisplayVal = widget.statusBinding && statusValue !== undefined ? statusValue : value;
        return (
          <VisuMultistate
            value={msDisplayVal as number | string | null}
            onChange={onValueChange}
            config={widget.config as MultistateConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );
      }

      case 'visu-slider': {
        const sliderDisplayVal = widget.statusBinding && statusValue !== undefined ? statusValue : value;
        return (
          <VisuSlider
            value={typeof sliderDisplayVal === 'number' ? sliderDisplayVal : 0}
            onChange={(v) => onValueChange(v)}
            config={widget.config as SliderConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
            width={widget.size.width - 20}
          />
        );
      }

      case 'visu-incrementer': {
        const incDisplayVal = widget.statusBinding && statusValue !== undefined ? statusValue : value;
        return (
          <VisuIncrementer
            value={typeof incDisplayVal === 'number' ? incDisplayVal : 0}
            onChange={(v) => onValueChange(v)}
            config={widget.config as IncrementerConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );
      }

      case 'visu-input': {
        const inputDisplayVal = widget.statusBinding && statusValue !== undefined ? statusValue : value;
        return (
          <VisuInput
            value={inputDisplayVal as number | string}
            onChange={(v) => onValueChange(v)}
            config={widget.config as InputConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );
      }

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
        const isHidden = rCfg.visibilityBinding && value === false;
        if (isHidden) return null;
        const fillColor = resolveShapeColor(rCfg, value);
        const hasNav = !!rCfg.navigateToPageId && !isEditMode;
        return (
          <svg
            width="100%" height="100%"
            style={{ overflow: 'visible', opacity: rCfg.opacity ?? 1, cursor: hasNav ? 'pointer' : 'inherit' }}
            onClick={() => handleShapeClick(rCfg)}
          >
            <rect
              x="0" y="0"
              width="100%" height="100%"
              fill={fillColor}
              stroke={rCfg.strokeColor || 'none'}
              strokeWidth={rCfg.strokeWidth ?? 2}
              rx={widget.style.borderRadius ?? 4}
            />
          </svg>
        );
      }

      case 'visu-circle': {
        const cCfg = widget.config as CircleConfig;
        const isHidden = cCfg.visibilityBinding && value === false;
        if (isHidden) return null;
        const cx = widget.size.width / 2;
        const cy = widget.size.height / 2;
        const rx = Math.max(1, cx - (cCfg.strokeWidth ?? 2) / 2);
        const ry = Math.max(1, cy - (cCfg.strokeWidth ?? 2) / 2);
        const fillColor = resolveShapeColor(cCfg, value);
        const hasNav = !!cCfg.navigateToPageId && !isEditMode;
        return (
          <svg
            width="100%" height="100%"
            style={{ overflow: 'visible', opacity: cCfg.opacity ?? 1, cursor: hasNav ? 'pointer' : 'inherit' }}
            onClick={() => handleShapeClick(cCfg)}
          >
            <ellipse
              cx={cx} cy={cy} rx={rx} ry={ry}
              fill={fillColor}
              stroke={cCfg.strokeColor || 'none'}
              strokeWidth={cCfg.strokeWidth ?? 2}
            />
          </svg>
        );
      }

      case 'visu-line': {
        const lCfg = widget.config as LineConfig;
        const isHidden = lCfg.visibilityBinding && value === false;
        if (isHidden) return null;
        if (lCfg.x1 === undefined) return null;
        let x1: number, y1: number, x2: number, y2: number;
        if (lCfg.x1 !== undefined && lCfg.y1 !== undefined && lCfg.x2 !== undefined && lCfg.y2 !== undefined) {
          x1 = lCfg.x1; y1 = lCfg.y1; x2 = lCfg.x2; y2 = lCfg.y2;
        } else {
          const angle = lCfg.angle ?? 0;
          const w = widget.size.width;
          const h = widget.size.height;
          const cx = w / 2, cy = h / 2;
          const len = Math.sqrt(w * w + h * h) / 2;
          const rad = (angle * Math.PI) / 180;
          x1 = cx - len * Math.cos(rad); y1 = cy - len * Math.sin(rad);
          x2 = cx + len * Math.cos(rad); y2 = cy + len * Math.sin(rad);
        }
        const strokeColor = resolveLineColor(lCfg, value);
        const hasNav = !!lCfg.navigateToPageId && !isEditMode;
        const minX = Math.min(x1, x2) - 20;
        const minY = Math.min(y1, y2) - 20;
        const svgW = Math.abs(x2 - x1) + 40;
        const svgH = Math.abs(y2 - y1) + 40;
        return (
          <svg
            ref={svgRef}
            style={{ position: 'absolute', left: minX, top: minY, overflow: 'visible', opacity: lCfg.opacity ?? 1, cursor: hasNav ? 'pointer' : 'inherit' }}
            width={svgW} height={svgH}
            viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
            onClick={() => handleShapeClick(lCfg)}
          >
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={strokeColor}
              strokeWidth={lCfg.strokeWidth ?? 2}
              strokeLinecap="round"
            />
            {isEditMode && isSelected && (
              <>
                <circle cx={x1} cy={y1} r={6} fill="#3b82f6" stroke="white" strokeWidth={2} style={{ cursor: 'grab' }}
                  onMouseDown={(e) => handleVertexMouseDown(e, 'line', 0, { x: x1, y: y1 })} />
                <circle cx={x2} cy={y2} r={6} fill="#3b82f6" stroke="white" strokeWidth={2} style={{ cursor: 'grab' }}
                  onMouseDown={(e) => handleVertexMouseDown(e, 'line', 1, { x: x2, y: y2 })} />
              </>
            )}
          </svg>
        );
      }

      case 'visu-arrow': {
        const aCfg = widget.config as ArrowConfig;
        const isHidden = aCfg.visibilityBinding && value === false;
        if (isHidden) return null;
        const angle = aCfg.angle ?? 0;
        const w = widget.size.width;
        const h = widget.size.height;
        const cx = w / 2, cy = h / 2;
        const sw = aCfg.strokeWidth ?? 2;
        const arrowSize = Math.max(8, sw * 3);
        const len = Math.sqrt(w * w + h * h) / 2;
        const rad = (angle * Math.PI) / 180;
        const strokeColor = resolveLineColor(aCfg, value);
        const markerId = `arrowhead-${widget.id}`;
        const markerStartId = `arrowhead-start-${widget.id}`;
        const x1raw = cx - len * Math.cos(rad);
        const y1raw = cy - len * Math.sin(rad);
        const x2raw = cx + len * Math.cos(rad);
        const y2raw = cy + len * Math.sin(rad);
        const x1 = aCfg.arrowStart ? x1raw + arrowSize * Math.cos(rad) : x1raw;
        const y1 = aCfg.arrowStart ? y1raw + arrowSize * Math.sin(rad) : y1raw;
        const x2 = aCfg.arrowEnd ? x2raw - arrowSize * Math.cos(rad) : x2raw;
        const y2 = aCfg.arrowEnd ? y2raw - arrowSize * Math.sin(rad) : y2raw;
        const hasNav = !!aCfg.navigateToPageId && !isEditMode;
        return (
          <svg
            width="100%" height="100%"
            style={{ overflow: 'visible', opacity: aCfg.opacity ?? 1, cursor: hasNav ? 'pointer' : 'inherit' }}
            onClick={() => handleShapeClick(aCfg)}
          >
            <defs>
              <marker id={markerId} markerWidth={arrowSize} markerHeight={arrowSize} refX={arrowSize - 1} refY={arrowSize / 2} orient="auto">
                <polygon points={`0 0, ${arrowSize} ${arrowSize / 2}, 0 ${arrowSize}`} fill={strokeColor} />
              </marker>
              <marker id={markerStartId} markerWidth={arrowSize} markerHeight={arrowSize} refX="1" refY={arrowSize / 2} orient="auto-start-reverse">
                <polygon points={`0 0, ${arrowSize} ${arrowSize / 2}, 0 ${arrowSize}`} fill={strokeColor} />
              </marker>
            </defs>
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={strokeColor}
              strokeWidth={sw}
              strokeLinecap="round"
              markerEnd={aCfg.arrowEnd ? `url(#${markerId})` : undefined}
              markerStart={aCfg.arrowStart ? `url(#${markerStartId})` : undefined}
            />
          </svg>
        );
      }

      case 'visu-polygon': {
        const pCfg = widget.config as PolygonConfig;
        const isHidden = pCfg.visibilityBinding && value === false;
        if (isHidden) return null;
        if (!pCfg.points || pCfg.points.length === 0) return null;
        const fillColor = resolveShapeColor(pCfg, value);
        const hasNav = !!pCfg.navigateToPageId && !isEditMode;
        const freehandPts = pCfg.points;
        if (freehandPts && freehandPts.length >= 2) {
          const xs = freehandPts.map(p => p.x);
          const ys = freehandPts.map(p => p.y);
          const minPx = Math.min(...xs) - 20;
          const minPy = Math.min(...ys) - 20;
          const svgW = Math.max(...xs) - minPx + 20;
          const svgH = Math.max(...ys) - minPy + 20;
          const ptStr = freehandPts.map(p => `${p.x},${p.y}`).join(' ');
          return (
            <svg
              style={{ position: 'absolute', left: minPx, top: minPy, overflow: 'visible', opacity: pCfg.opacity ?? 1, cursor: hasNav ? 'pointer' : 'inherit' }}
              width={svgW} height={svgH}
              viewBox={`${minPx} ${minPy} ${svgW} ${svgH}`}
              onClick={() => handleShapeClick(pCfg)}
            >
              <polygon
                points={ptStr}
                fill={fillColor}
                stroke={pCfg.strokeColor || '#475569'}
                strokeWidth={pCfg.strokeWidth ?? 2}
                strokeLinejoin="round"
              />
              {isEditMode && isSelected && freehandPts.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={6} fill="#3b82f6" stroke="white" strokeWidth={2}
                  style={{ cursor: 'grab' }}
                  onMouseDown={(e) => handleVertexMouseDown(e, 'polygon', i, pt)} />
              ))}
            </svg>
          );
        }
        const sides = pCfg.sides ?? 6;
        const w = widget.size.width, h = widget.size.height;
        const cx = w / 2, cy = h / 2;
        const rx = Math.max(1, cx - (pCfg.strokeWidth ?? 2) / 2);
        const ry = Math.max(1, cy - (pCfg.strokeWidth ?? 2) / 2);
        const pts = makePolygonPoints(cx, cy, rx, ry, sides);
        return (
          <svg
            width="100%" height="100%"
            style={{ overflow: 'visible', opacity: pCfg.opacity ?? 1, cursor: hasNav ? 'pointer' : 'inherit' }}
            onClick={() => handleShapeClick(pCfg)}
          >
            <polygon
              points={pts}
              fill={fillColor}
              stroke={pCfg.strokeColor || '#475569'}
              strokeWidth={pCfg.strokeWidth ?? 2}
            />
          </svg>
        );
      }

      case 'visu-star': {
        const sCfg = widget.config as StarConfig;
        const isHidden = sCfg.visibilityBinding && value === false;
        if (isHidden) return null;
        const numPoints = sCfg.points ?? 5;
        const innerRatio = sCfg.innerRadiusRatio ?? 0.4;
        const w = widget.size.width, h = widget.size.height;
        const cx = w / 2, cy = h / 2;
        const rx = Math.max(1, cx - (sCfg.strokeWidth ?? 1));
        const ry = Math.max(1, cy - (sCfg.strokeWidth ?? 1));
        const pts = makeStarPoints(cx, cy, rx, ry, numPoints, innerRatio);
        const fillColor = resolveShapeColor(sCfg, value);
        const hasNav = !!sCfg.navigateToPageId && !isEditMode;
        return (
          <svg
            width="100%" height="100%"
            style={{ overflow: 'visible', opacity: sCfg.opacity ?? 1, cursor: hasNav ? 'pointer' : 'inherit' }}
            onClick={() => handleShapeClick(sCfg)}
          >
            <polygon
              points={pts}
              fill={fillColor}
              stroke={sCfg.strokeColor || '#ca8a04'}
              strokeWidth={sCfg.strokeWidth ?? 1}
            />
          </svg>
        );
      }

      case 'visu-diamond': {
        const dCfg = widget.config as DiamondConfig;
        const isHidden = dCfg.visibilityBinding && value === false;
        if (isHidden) return null;
        const w = widget.size.width, h = widget.size.height;
        const pts = makeDiamondPoints(w, h);
        const fillColor = resolveShapeColor(dCfg, value);
        const hasNav = !!dCfg.navigateToPageId && !isEditMode;
        return (
          <svg
            width="100%" height="100%"
            style={{ overflow: 'visible', opacity: dCfg.opacity ?? 1, cursor: hasNav ? 'pointer' : 'inherit' }}
            onClick={() => handleShapeClick(dCfg)}
          >
            <polygon
              points={pts}
              fill={fillColor}
              stroke={dCfg.strokeColor || '#475569'}
              strokeWidth={dCfg.strokeWidth ?? 2}
            />
          </svg>
        );
      }

      case 'visu-cross': {
        const xCfg = widget.config as CrossConfig;
        const isHidden = xCfg.visibilityBinding && value === false;
        if (isHidden) return null;
        const w = widget.size.width, h = widget.size.height;
        const armRatio = xCfg.armWidth ?? 0.3;
        const pts = makeCrossPoints(w, h, armRatio);
        const fillColor = resolveShapeColor(xCfg, value);
        const hasNav = !!xCfg.navigateToPageId && !isEditMode;
        return (
          <svg
            width="100%" height="100%"
            style={{ overflow: 'visible', opacity: xCfg.opacity ?? 1, cursor: hasNav ? 'pointer' : 'inherit' }}
            onClick={() => handleShapeClick(xCfg)}
          >
            <polygon
              points={pts}
              fill={fillColor}
              stroke={xCfg.strokeColor || 'transparent'}
              strokeWidth={xCfg.strokeWidth ?? 0}
            />
          </svg>
        );
      }

      case 'visu-polyline': {
        const plCfg = widget.config as PolylineConfig;
        const isHidden = plCfg.visibilityBinding && value === false;
        if (isHidden) return null;
        const pts = plCfg.points || [];
        const pathData = pts.length > 0
          ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (plCfg.closed ? ' Z' : '')
          : '';
        const strokeColor = plCfg.activeColor && plCfg.inactiveColor
          ? (value ? plCfg.activeColor : plCfg.inactiveColor)
          : (plCfg.activeColor && value ? plCfg.activeColor : (plCfg.strokeColor || '#64748b'));
        const hasNav = !!plCfg.navigateToPageId && !isEditMode;
        return (
          <svg
            width="100%" height="100%"
            style={{ overflow: 'visible', opacity: plCfg.opacity ?? 1, cursor: hasNav ? 'pointer' : 'inherit' }}
            onClick={() => handleShapeClick(plCfg)}
          >
            {pathData && (
              <path
                d={pathData}
                fill={plCfg.fillColor && plCfg.fillColor !== 'transparent' ? plCfg.fillColor : 'none'}
                stroke={strokeColor}
                strokeWidth={plCfg.strokeWidth ?? 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {isEditMode && isSelected && pts.map((pt, i) => (
              <circle
                key={i}
                cx={pt.x} cy={pt.y} r={6}
                fill="#3b82f6"
                stroke="white"
                strokeWidth={2}
                style={{ cursor: 'grab' }}
                onMouseDown={(e) => handleVertexMouseDown(e, 'polyline', i, pt)}
              />
            ))}
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

      case 'visu-frame': {
        const frCfg = widget.config as FrameConfig;
        return (
          <VisuFrame
            config={frCfg}
            isEditMode={isEditMode}
            onNavigateToPage={onNavigateToPage}
            visuPages={visuPages}
          />
        );
      }

      case 'visu-image': {
        const imgCfg = widget.config as ImageConfig;
        return (
          <VisuImage
            config={imgCfg}
            isEditMode={isEditMode}
            onUpdateConfig={(cfg) => onUpdateConfig?.(cfg as Record<string, unknown>)}
            width={widget.size.width}
            height={widget.size.height}
          />
        );
      }

      case 'modern-switch': {
        const mswCfg = widget.config as ModernSwitchConfig;
        const mswFeedback = widget.statusBinding && statusValue !== undefined ? statusValue : value;
        const mswVal = Boolean(mswFeedback ?? mswCfg.defaultValue ?? false);
        return (
          <ModernSwitch
            value={mswVal}
            onChange={onValueChange}
            config={mswCfg}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );
      }

      case 'modern-button':
        return (
          <ModernButton
            onValueChange={onValueChange}
            config={widget.config as ModernButtonConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );

      case 'modern-gauge':
        return (
          <ModernGauge
            value={typeof value === 'number' ? value : 0}
            config={widget.config as ModernGaugeConfig}
            style={widget.style}
            label={widget.label}
            size={widget.size}
          />
        );

      case 'modern-display':
        return (
          <ModernDisplay
            value={value as number | string | boolean | null}
            config={widget.config as ModernDisplayConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'modern-bar':
        return (
          <ModernBar
            value={typeof value === 'number' ? value : 0}
            config={widget.config as ModernBarConfig}
            style={widget.style}
            label={widget.label}
            size={widget.size}
          />
        );

      case 'modern-led':
        return (
          <ModernLed
            value={Boolean(value)}
            config={widget.config as ModernLedConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'modern-slider':
        return (
          <ModernSlider
            value={typeof value === 'number' ? value : 0}
            onChange={(v) => onValueChange(v)}
            config={widget.config as ModernSliderConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );

      case 'modern-multistate': {
        const mmsDisplayVal = widget.statusBinding && statusValue !== undefined ? statusValue : value;
        return (
          <ModernMultistate
            value={mmsDisplayVal as number | string | null}
            onChange={onValueChange}
            config={widget.config as ModernMultistateConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );
      }

      case 'dash-stat':
        return (
          <DashStat
            value={value as number | string | null}
            config={widget.config as DashStatConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'dash-progress':
        return (
          <DashProgress
            value={typeof value === 'number' ? value : 0}
            config={widget.config as DashProgressConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'dash-value-card':
        return (
          <DashValueCard
            value={value as number | string | null}
            config={widget.config as DashValueCardConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'dash-toggle-card': {
        const dtCfg = widget.config as DashToggleCardConfig;
        const dtWriteOnly = !!widget.binding && widget.binding.direction === 'write';
        const dtValue = dtWriteOnly
          ? Boolean(statusValue ?? false)
          : Boolean(value ?? false);
        return (
          <DashToggleCard
            value={dtValue}
            statusValue={widget.statusBinding ? Boolean(statusValue) : undefined}
            onChange={onValueChange}
            config={dtCfg}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );
      }

      case 'dash-battery':
        return (
          <DashBattery
            value={Number(value) || 0}
            config={widget.config as DashBatteryConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'dash-signal':
        return (
          <DashSignal
            value={Number(value) || 0}
            config={widget.config as DashSignalConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'dash-sparkline':
        return (
          <DashSparkline
            value={Number(value) || 0}
            config={widget.config as DashSparklineConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'dash-multivalue':
        return (
          <DashMultivalue
            value={Number(value) || 0}
            config={widget.config as DashMultivalueConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'dash-heatbar':
        return (
          <DashHeatbar
            value={Number(value) || 0}
            config={widget.config as DashHeatbarConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'dash-compass':
        return (
          <DashCompass
            value={Number(value) || 0}
            config={widget.config as DashCompassConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'dash-clock':
        return (
          <DashClock
            config={widget.config as DashClockConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'dash-rating':
        return (
          <DashRating
            value={Number(value) || 0}
            config={widget.config as DashRatingConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'dash-level':
        return (
          <DashLevel
            value={Number(value) || 0}
            config={widget.config as DashLevelConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'dash-wind':
        return (
          <DashWind
            value={Number(value) || 0}
            config={widget.config as DashWindConfig}
            style={widget.style}
            label={widget.label}
          />
        );

      case 'dash-multistate':
        return (
          <DashMultistate
            value={value as number | string | null}
            statusValue={widget.statusBinding ? statusValue as number | string | null : undefined}
            onChange={onValueChange}
            config={widget.config as DashMultistateConfig}
            style={widget.style}
            label={widget.label}
            disabled={isEditMode}
          />
        );

      case 'visu-pump': {
        const pumpCfg = widget.config as PumpWidgetConfig;
        const pumpValues = value as {
          pumpCmd?: boolean;
          speedOut?: number;
          running?: boolean;
          fault?: boolean;
          ready?: boolean;
          alarm?: boolean;
          opHours?: number;
          starts?: number;
          hoaMode?: number;
          revision?: boolean;
          handStart?: boolean;
        } | null;
        return (
          <VisuPump
            config={pumpCfg}
            value={pumpValues ? {
              pumpCmd: pumpValues.pumpCmd ?? false,
              speedOut: pumpValues.speedOut ?? 0,
              running: pumpValues.running ?? false,
              fault: pumpValues.fault ?? false,
              ready: pumpValues.ready ?? true,
              alarm: pumpValues.alarm ?? false,
              opHours: pumpValues.opHours ?? 0,
              starts: pumpValues.starts ?? 0,
              hoaMode: pumpValues.hoaMode ?? 2,
              revision: pumpValues.revision ?? false,
              handStart: pumpValues.handStart ?? false
            } : null}
            isEditMode={isEditMode}
            onValueChange={(updates) => onValueChange(updates)}
            params={pumpParams}
          />
        );
      }

      case 'visu-valve': {
        const valveCfg = widget.config as ValveWidgetConfig;
        const valveValues = value as {
          valveOutput?: number;
          setpoint?: number;
          feedback?: number;
          alarm?: boolean;
          hoaMode?: number;
        } | null;
        return (
          <VisuValve
            config={valveCfg}
            value={valveValues ? {
              valveOutput: valveValues.valveOutput ?? 0,
              setpoint: valveValues.setpoint ?? 0,
              feedback: valveValues.feedback ?? 0,
              alarm: valveValues.alarm ?? false,
              hoaMode: valveValues.hoaMode ?? 2
            } : null}
            isEditMode={isEditMode}
            onValueChange={(updates) => onValueChange(updates)}
            params={valveParams}
          />
        );
      }

      case 'visu-sensor': {
        const sensorCfg = widget.config as SensorWidgetConfig;
        const sensorValues = value as {
          sensorValue?: number;
          alarm?: boolean;
          hoaMode?: 'hand' | 'auto';
          manualValue?: number;
        } | null;
        return (
          <VisuSensor
            config={sensorCfg}
            value={sensorValues ? {
              sensorValue: sensorValues.sensorValue ?? 0,
              alarm: sensorValues.alarm ?? false,
              hoaMode: sensorValues.hoaMode ?? 'auto',
              manualValue: sensorValues.manualValue ?? 0
            } : null}
            isEditMode={isEditMode}
            onValueChange={(updates) => onValueChange(updates)}
            params={sensorParams}
          />
        );
      }

      case 'visu-pid': {
        const pidCfg = widget.config as PIDWidgetConfig;
        const pidValues = value as {
          controlOutput?: number;
          setpoint?: number;
          actualValue?: number;
          enable?: boolean;
          hoaMode?: 'hand' | 'auto';
          manualOutput?: number;
        } | null;
        return (
          <VisuPID
            config={pidCfg}
            value={pidValues ? {
              controlOutput: pidValues.controlOutput ?? 0,
              setpoint: pidValues.setpoint ?? 0,
              actualValue: pidValues.actualValue ?? 0,
              enable: pidValues.enable ?? false,
              hoaMode: pidValues.hoaMode ?? 'auto',
              manualOutput: pidValues.manualOutput ?? 0
            } : null}
            isEditMode={isEditMode}
            onValueChange={(updates) => onValueChange(updates)}
            params={pidParams}
          />
        );
      }

      case 'visu-heating-curve': {
        const hcCfg = widget.config as {
          hcName?: string;
          normalColor?: string;
          activeColor?: string;
          rotation?: 0 | 90 | 180 | 270;
          showInput?: boolean;
          showOutput?: boolean;
        };
        const hcValues = value as {
          outputValue?: number;
          inputValue?: number;
          enable?: boolean;
        } | null;
        return (
          <VisuHeatingCurve
            config={hcCfg}
            value={hcValues ? {
              outputValue: hcValues.outputValue ?? 0,
              inputValue: hcValues.inputValue ?? 0,
              enable: hcValues.enable ?? true
            } : null}
            isEditMode={isEditMode}
            onValueChange={(updates) => onValueChange(updates)}
            params={heatingCurveParams}
          />
        );
      }

      case 'visu-alarm-console': {
        const acCfg = widget.config as AlarmConsoleWidgetConfig;
        return (
          <VisuAlarmConsole
            config={acCfg}
            alarmClasses={alarmClasses}
            alarmConsoles={alarmConsoles}
            activeAlarms={activeAlarms}
            onAcknowledge={onAcknowledgeAlarm}
            onAcknowledgeAll={onAcknowledgeAll}
            onClear={onClearAlarm}
            onShelve={onShelveAlarm}
            isEditMode={isEditMode}
            width={widget.size.width}
            height={widget.size.height}
          />
        );
      }

      case 'visu-trend-chart': {
        const tcCfg = widget.config as TrendChartConfig;
        return (
          <VisuTrendChart
            config={tcCfg}
            isEditMode={isEditMode}
            width={widget.size.width}
            height={widget.size.height}
          />
        );
      }

      default:
        return <div className="text-red-400">Unbekannter Widget-Typ</div>;
    }
  };

  const isDrawingWidget = ['visu-rect', 'visu-circle', 'visu-line', 'visu-arrow', 'visu-polygon', 'visu-star', 'visu-diamond', 'visu-cross', 'visu-polyline'].includes(widget.type);
  const isNavWidget = ['visu-nav-button', 'visu-home-button', 'visu-back-button', 'visu-frame', 'visu-image'].includes(widget.type);
  const isModernWidget = widget.type.startsWith('modern-');
  const isDashWidget = widget.type.startsWith('dash-');
  const isVertexWidget = ['visu-line', 'visu-polyline', 'visu-polygon'].includes(widget.type);
  const showResizeHandles = isEditMode && isSelected && !isVertexWidget;
  const showSelectionBorder = isSelected && !isVertexWidget && !['visu-line', 'visu-polyline', 'visu-polygon'].includes(widget.type);

  const themeVars = getThemeVars(widget.style.theme);
  const resolvedBg = widget.style.backgroundColor !== undefined && widget.style.backgroundColor !== ''
    ? widget.style.backgroundColor
    : (widget.style.theme ? themeVars.bg : 'transparent');
  const resolvedBorderRadius = widget.style.borderRadius ?? themeVars.borderRadius;
  const resolvedBorderColor = widget.style.borderColor || themeVars.border;

  const isPumpWidget = widget.type === 'visu-pump';
  const isValveWidget = widget.type === 'visu-valve';
  const isSensorWidget = widget.type === 'visu-sensor';
  const isTrendWidget = widget.type === 'visu-trend-chart';
  const isPIDWidget = widget.type === 'visu-pid';
  const isHeatingCurveWidget = widget.type === 'visu-heating-curve';
  const isAlarmConsoleWidget = widget.type === 'visu-alarm-console';
  const isLineInDrawingMode = widget.type === 'visu-line' && (widget.config as { x1?: number }).x1 === undefined;
  const isPolygonInDrawingMode = widget.type === 'visu-polygon' && (!(widget.config as { points?: unknown[] }).points || (widget.config as { points?: unknown[] }).points!.length === 0);
  const isTransparentWidget = isDrawingWidget || isNavWidget || isModernWidget || isDashWidget || isPumpWidget || isValveWidget || isSensorWidget || isTrendWidget || isPIDWidget || isHeatingCurveWidget || isAlarmConsoleWidget;

  const highlightStyle = isHighlighted ? {
    boxShadow: '0 0 0 4px #ec4899, 0 0 20px 8px rgba(236, 72, 153, 0.5)',
    animation: 'highlight-pulse 0.5s ease-in-out 3'
  } : {};

  return (
    <div
      data-widget-id={widget.id}
      data-widget-locked={widget.locked ? 'true' : undefined}
      className={`absolute ${isEditMode && !widget.locked ? 'cursor-move' : ''} ${isDrawingWidget || isNavWidget || isModernWidget || isDashWidget || isPumpWidget || isValveWidget || isSensorWidget ? '' : 'flex items-center justify-center'} ${isHighlighted ? 'z-[9999]' : ''}`}
      style={{
        left: widget.position.x,
        top: widget.position.y,
        width: widget.size.width,
        height: widget.size.height,
        zIndex: isHighlighted ? 9999 : (widget.zIndex || 1),
        pointerEvents: (isEditMode && widget.locked) || isLineInDrawingMode || isPolygonInDrawingMode ? 'none' : undefined,
        visibility: (isLineInDrawingMode || isPolygonInDrawingMode) ? 'hidden' : undefined,
        backgroundColor: isTransparentWidget ? 'transparent' : resolvedBg,
        fontSize: widget.style.fontSize ? `${widget.style.fontSize}px` : undefined,
        fontFamily: widget.style.fontFamily && widget.style.fontFamily !== 'system'
          ? { sans: 'sans-serif', serif: 'serif', mono: 'monospace', system: undefined }[widget.style.fontFamily]
          : undefined,
        borderRadius: isDrawingWidget ? 0 : resolvedBorderRadius,
        border: isHighlighted
          ? '3px solid #ec4899'
          : (showSelectionBorder
            ? '2px solid #3b82f6'
            : (isMultiSelected && isEditMode ? '2px solid #3b82f6' : 'none')),
        outline: isMultiSelected && isEditMode && !showSelectionBorder ? '2px solid #3b82f6' : undefined,
        outlineOffset: isMultiSelected && isEditMode && !showSelectionBorder ? 2 : undefined,
        boxShadow: isHighlighted
          ? highlightStyle.boxShadow
          : ((!isTransparentWidget && !isNavWidget && widget.style.theme && widget.style.theme !== 'default') ? themeVars.boxShadow : undefined),
        backdropFilter: (!isTransparentWidget && !isNavWidget && themeVars.backdropFilter) ? themeVars.backdropFilter : undefined,
        WebkitBackdropFilter: (!isTransparentWidget && !isNavWidget && themeVars.backdropFilter) ? themeVars.backdropFilter : undefined,
        padding: isDrawingWidget || isNavWidget || isModernWidget || isDashWidget || isPumpWidget || isValveWidget ? 0 : 8,
        transition: isHighlighted ? 'box-shadow 0.3s ease-in-out, border 0.3s ease-in-out' : undefined
      } as React.CSSProperties}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      onClick={(e) => {
        if (isEditMode && !e.ctrlKey && !e.metaKey) {
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
      {isEditMode && !isVertexWidget && (
        <div
          className="absolute inset-0"
          style={{ zIndex: 10, cursor: 'move' }}
          onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
        />
      )}
      {showResizeHandles && (
        <>
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-nw-resize" style={{ zIndex: 11 }} />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-ne-resize" style={{ zIndex: 11 }} />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-sw-resize" style={{ zIndex: 11 }} />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-se-resize" style={{ zIndex: 11 }} />
        </>
      )}
    </div>
  );
};
