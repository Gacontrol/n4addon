import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { VisuWidget, VisuPage, PolygonConfig, LineConfig, parseDpKey } from '../../types/visualization';
import { FlowNode } from '../../types/flow';
import { AlarmClass, AlarmConsole, ActiveAlarm } from '../../types/alarm';
import { VisuWidgetRenderer } from './VisuWidget';

interface ContextMenuState {
  x: number;
  y: number;
  widgetId: string | null;
}

interface DrawingState {
  widgetId: string;
  type: 'polygon' | 'line';
  points: { x: number; y: number }[];
  cursorPos: { x: number; y: number } | null;
  linePhase?: 0 | 1;
}

interface VisuCanvasProps {
  page: VisuPage;
  liveValues: Record<string, unknown>;
  logicNodes: FlowNode[];
  logicSheets?: { id: string; name: string; nodeIds: string[] }[];
  isEditMode: boolean;
  zoom?: number;
  selectedWidgetId: string | null;
  selectedWidgetIds?: string[];
  clipboard: VisuWidget | null;
  onSelectWidget: (widgetId: string | null) => void;
  onSelectWidgets?: (widgetIds: string[]) => void;
  onUpdateWidget: (widgetId: string, updates: Partial<VisuWidget>) => void;
  onUpdateWidgets?: (updates: { widgetId: string; updates: Partial<VisuWidget> }[]) => void;
  onDeleteWidget: (widgetId: string) => void;
  onDeleteWidgets?: (widgetIds: string[]) => void;
  onDuplicateWidget: (widgetId: string) => void;
  onCopyWidget: (widgetId: string) => void;
  onCopyWidgets?: (widgetIds: string[]) => void;
  onPasteWidget: () => void;
  onWidgetValueChange: (dpKey: string, value: unknown) => void;
  onEditWidgetProperties: (widgetId: string) => void;
  onNavigateToPage?: (pageId: string) => void;
  onNavigateBack?: () => void;
  onNavigateHome?: () => void;
  onBringToFront: (widgetId: string) => void;
  onSendToBack: (widgetId: string) => void;
  onBringForward: (widgetId: string) => void;
  onSendBackward: (widgetId: string) => void;
  highlightedWidgetId?: string | null;
  alarmClasses?: AlarmClass[];
  alarmConsoles?: AlarmConsole[];
  activeAlarms?: ActiveAlarm[];
  onAcknowledgeAlarm?: (alarmId: string) => void;
  onAcknowledgeAll?: () => void;
  onClearAlarm?: (alarmId: string) => void;
  onShelveAlarm?: (alarmId: string, durationMs: number, reason?: string) => void;
}

export const VisuCanvas: React.FC<VisuCanvasProps> = ({
  page,
  liveValues,
  logicNodes,
  logicSheets = [],
  isEditMode,
  zoom = 1,
  selectedWidgetId,
  selectedWidgetIds = [],
  clipboard,
  onSelectWidget,
  onSelectWidgets,
  onUpdateWidget,
  onUpdateWidgets,
  onDeleteWidget,
  onDeleteWidgets,
  onDuplicateWidget,
  onCopyWidget,
  onCopyWidgets,
  onPasteWidget,
  onWidgetValueChange,
  onEditWidgetProperties,
  onNavigateToPage,
  onNavigateBack,
  onNavigateHome,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  highlightedWidgetId,
  alarmClasses = [],
  alarmConsoles = [],
  activeAlarms = [],
  onAcknowledgeAlarm,
  onAcknowledgeAll,
  onClearAlarm,
  onShelveAlarm
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const lassoJustCompletedRef = useRef(0);
  const dragActivatedRef = useRef(false);
  const multiDragActivatedRef = useRef(false);

  const nodeIdToSheetId = useMemo(() => {
    const map = new Map<string, string>();
    for (const sheet of logicSheets) {
      for (const nodeId of sheet.nodeIds) {
        map.set(nodeId, sheet.id);
      }
    }
    return map;
  }, [logicSheets]);

  const isCrossPageBinding = useCallback((widget: VisuWidget): boolean => {
    if (logicSheets.length <= 1) return false;
    const dpKey = widget.binding?.dpKey;
    if (!dpKey) return false;
    const nodeId = parseDpKey(dpKey).nodeId;
    return nodeIdToSheetId.has(nodeId);
  }, [logicSheets.length, nodeIdToSheetId]);

  const [dragState, setDragState] = useState<{
    widgetId: string;
    startX: number;
    startY: number;
    widgetStartX: number;
    widgetStartY: number;
    isVertex?: boolean;
    initialConfig?: Record<string, unknown>;
  } | null>(null);

  const [multiDragState, setMultiDragState] = useState<{
    widgetIds: string[];
    startX: number;
    startY: number;
    initialPositions: Record<string, { x: number; y: number }>;
    initialConfigs: Record<string, Record<string, unknown>>;
  } | null>(null);

  const [resizeState, setResizeState] = useState<{
    widgetId: string;
    corner: string;
    startX: number;
    startY: number;
    widgetStartWidth: number;
    widgetStartHeight: number;
    widgetStartX: number;
    widgetStartY: number;
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);
  const [lassoState, setLassoState] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const getCanvasPos = useCallback((e: React.MouseEvent | MouseEvent | React.PointerEvent | PointerEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom
    };
  }, [zoom]);

  const snapPos = useCallback((pos: { x: number; y: number }) => {
    if (!page.showGrid) return pos;
    const g = page.gridSize || 10;
    return { x: Math.round(pos.x / g) * g, y: Math.round(pos.y / g) * g };
  }, [page.showGrid, page.gridSize]);

  const isInDrawingMode = useCallback((widget: VisuWidget) => {
    if (!isEditMode) return false;
    if (widget.type === 'visu-polygon') {
      const cfg = widget.config as PolygonConfig;
      return !cfg.points || cfg.points.length === 0;
    }
    if (widget.type === 'visu-line') {
      const cfg = widget.config as LineConfig;
      return cfg.x1 === undefined;
    }
    return false;
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode) {
      setDrawingState(null);
      return;
    }
    if (selectedWidgetId) {
      const widget = page.widgets.find(w => w.id === selectedWidgetId);
      if (widget && isInDrawingMode(widget)) {
        if (!drawingState || drawingState.widgetId !== selectedWidgetId) {
          setDrawingState({
            widgetId: selectedWidgetId,
            type: widget.type === 'visu-polygon' ? 'polygon' : 'line',
            points: [],
            cursorPos: null,
            linePhase: 0
          });
        }
      } else if (drawingState && drawingState.widgetId !== selectedWidgetId) {
        setDrawingState(null);
      }
    } else {
      setDrawingState(null);
    }
  }, [selectedWidgetId, page.widgets, isEditMode, isInDrawingMode]);


  const getWidgetValue = useCallback((widget: VisuWidget): unknown => {
    if (!widget.binding) return null;
    const legacyNodeId = (widget.binding as unknown as { nodeId?: string }).nodeId;
    const dpKey = widget.binding.dpKey || legacyNodeId || '';
    const { nodeId, segment, paramKey: cfgParamKey } = parseDpKey(dpKey);

    if (widget.type === 'visu-pump') {
      const node = logicNodes.find(n => n.id === nodeId);
      if (!node || (node.type !== 'pump-control' && node.type !== 'aggregate-control')) return null;
      const prefix = node.type === 'aggregate-control' ? 'aggregate' : 'pump';
      return {
        pumpCmd: liveValues[`${nodeId}:output-0`] ?? false,
        speedOut: liveValues[`${nodeId}:output-1`] ?? 0,
        running: liveValues[`${nodeId}:output-2`] ?? false,
        fault: liveValues[`${nodeId}:output-3`] ?? false,
        ready: liveValues[`${nodeId}:output-4`] ?? true,
        alarm: liveValues[`${nodeId}:output-5`] ?? false,
        opHours: liveValues[`${nodeId}:output-6`] ?? 0,
        starts: liveValues[`${nodeId}:output-7`] ?? 0,
        hoaMode: (liveValues[`${nodeId}:cfg:${prefix}VisuHOA`] ?? node.data.config?.[`${prefix}VisuHOA`]) ?? 2,
        revision: liveValues[`${nodeId}:input-3`] ?? false,
        handStart: (liveValues[`${nodeId}:cfg:${prefix}VisuHandStart`] ?? node.data.config?.[`${prefix}VisuHandStart`]) ?? false
      };
    }

    if (widget.type === 'visu-valve') {
      const node = logicNodes.find(n => n.id === nodeId);
      if (!node || node.type !== 'valve-control') return null;
      const setpointFromVisu = liveValues[`${nodeId}:cfg:valveVisuSetpoint`] ?? node.data.config?.valveVisuSetpoint;
      const setpointFromWire = liveValues[`${nodeId}:input-0`] ?? 0;
      return {
        valveOutput: liveValues[`${nodeId}:output-0`] ?? 0,
        setpoint: setpointFromVisu ?? setpointFromWire ?? 0,
        feedback: liveValues[`${nodeId}:input-1`] ?? 0,
        alarm: liveValues[`${nodeId}:output-1`] ?? false,
        hoaMode: (liveValues[`${nodeId}:cfg:valveVisuHOA`] ?? node.data.config?.valveVisuHOA) ?? 2
      };
    }

    if (widget.type === 'visu-sensor') {
      const node = logicNodes.find(n => n.id === nodeId);
      if (!node || node.type !== 'sensor-control') return null;
      return {
        sensorValue: liveValues[`${nodeId}:output-0`] ?? 0,
        alarm: liveValues[`${nodeId}:output-1`] ?? false,
        hoaMode: (liveValues[`${nodeId}:cfg:sensorVisuHOA`] ?? node.data.config?.sensorVisuHOA) ?? 'auto',
        manualValue: (liveValues[`${nodeId}:cfg:sensorManualValue`] ?? node.data.config?.sensorManualValue) ?? 0
      };
    }

    if (widget.type === 'visu-bool-sensor') {
      const node = logicNodes.find(n => n.id === nodeId);
      if (!node || node.type !== 'bool-sensor-control') return null;
      return {
        signalValue: liveValues[`${nodeId}:output-0`] ?? false,
        alarm: liveValues[`${nodeId}:output-1`] ?? false,
      };
    }

    if (widget.type === 'visu-pid') {
      const node = logicNodes.find(n => n.id === nodeId);
      if (!node || node.type !== 'pid-controller') return null;
      return {
        controlOutput: liveValues[`${nodeId}:output-0`] ?? 0,
        setpoint: liveValues[`${nodeId}:input-0`] ?? 0,
        actualValue: liveValues[`${nodeId}:input-1`] ?? 0,
        enable: liveValues[`${nodeId}:input-2`] ?? false,
        hoaMode: (liveValues[`${nodeId}:cfg:pidVisuHOA`] ?? node.data.config?.pidVisuHOA) ?? 'auto',
        manualOutput: (liveValues[`${nodeId}:cfg:pidManualOutput`] ?? node.data.config?.pidManualOutput) ?? 0
      };
    }

    if (widget.type === 'visu-heating-curve') {
      const node = logicNodes.find(n => n.id === nodeId);
      if (!node || node.type !== 'heating-curve') return null;
      return {
        outputValue: liveValues[`${nodeId}:output-0`] ?? 0,
        inputValue: liveValues[`${nodeId}:input-0`] ?? 0,
        enable: liveValues[`${nodeId}:input-1`] ?? true
      };
    }

    if (widget.type === 'visu-time-program') {
      const node = logicNodes.find(n => n.id === nodeId);
      if (!node || node.type !== 'time-program') return null;
      return {
        output: liveValues[`${nodeId}:output-0`] ?? false,
        active: liveValues[`${nodeId}:output-1`] ?? false
      };
    }

    if (widget.type === 'visu-sequence') {
      const node = logicNodes.find(n => n.id === nodeId);
      if (!node || node.type !== 'sequence-control') return null;
      return {
        input: liveValues[`${nodeId}:input-0`] ?? 0,
        outputs: [0, 1, 2, 3, 4, 5].map(i => Number(liveValues[`${nodeId}:output-${i}`] ?? 0)),
        seqStatus: liveValues[`${nodeId}:seqStatus`] as unknown[] ?? undefined,
        error: liveValues[`${nodeId}:output-6`] ?? false
      };
    }

    if (segment === 'cfg' && cfgParamKey) {
      const cfgLiveVal = liveValues[dpKey];
      if (cfgLiveVal !== undefined) return cfgLiveVal;
      const node = logicNodes.find(n => n.id === nodeId);
      return node?.data.config?.[cfgParamKey] ?? null;
    }

    if (dpKey in liveValues) return liveValues[dpKey];
    return liveValues[nodeId] ?? null;
  }, [liveValues, logicNodes]);

  const getWidgetStatusValue = useCallback((widget: VisuWidget): unknown => {
    if (!widget.statusBinding) return undefined;
    const legacyNodeId = (widget.statusBinding as unknown as { nodeId?: string }).nodeId;
    const dpKey = widget.statusBinding.dpKey || legacyNodeId || '';
    if (dpKey && dpKey in liveValues) return liveValues[dpKey];
    const { nodeId } = parseDpKey(dpKey);
    return liveValues[nodeId];
  }, [liveValues]);

  const getWidgetDpKey = useCallback((widget: VisuWidget): string => {
    if (!widget.binding) return '';
    const legacyNodeId = (widget.binding as unknown as { nodeId?: string }).nodeId;
    return widget.binding.dpKey || legacyNodeId || '';
  }, []);

  const getPumpWidgetParams = useCallback((widget: VisuWidget) => {
    if (widget.type !== 'visu-pump' || !widget.binding) return undefined;
    const node = logicNodes.find(n => n.id === parseDpKey(widget.binding?.dpKey).nodeId);
    if (!node || (node.type !== 'pump-control' && node.type !== 'aggregate-control')) return undefined;
    const cfg = node.data.config || {};
    const isAggregate = node.type === 'aggregate-control';
    const customLabel = cfg.customLabel as string | undefined;
    const configName = (cfg.pumpName || cfg.aggregateName) as string | undefined;
    const nodeName = configName || customLabel || node.data.label || 'Aggregat';
    return {
      pumpName: nodeName,
      pumpStartDelayMs: isAggregate ? (cfg.aggregateStartDelayMs ?? cfg.pumpStartDelayMs) : cfg.pumpStartDelayMs,
      pumpStopDelayMs: isAggregate ? (cfg.aggregateStopDelayMs ?? cfg.pumpStopDelayMs) : cfg.pumpStopDelayMs,
      pumpFeedbackTimeoutMs: isAggregate ? (cfg.aggregateFeedbackTimeoutMs ?? cfg.pumpFeedbackTimeoutMs) : cfg.pumpFeedbackTimeoutMs,
      pumpEnableFeedback: isAggregate ? (cfg.aggregateEnableFeedback ?? cfg.pumpEnableFeedback) : cfg.pumpEnableFeedback,
      pumpSpeedMin: isAggregate ? (cfg.aggregateSpeedMin ?? cfg.pumpSpeedMin) : cfg.pumpSpeedMin,
      pumpSpeedMax: isAggregate ? (cfg.aggregateSpeedMax ?? cfg.pumpSpeedMax) : cfg.pumpSpeedMax,
      pumpAntiSeizeIntervalMs: isAggregate ? (cfg.aggregateAntiSeizeIntervalMs ?? cfg.pumpAntiSeizeIntervalMs) : cfg.pumpAntiSeizeIntervalMs,
      pumpAntiSeizeRunMs: isAggregate ? (cfg.aggregateAntiSeizeRunMs ?? cfg.pumpAntiSeizeRunMs) : cfg.pumpAntiSeizeRunMs,
      pumpAntiSeizeSpeed: isAggregate ? (cfg.aggregateAntiSeizeSpeed ?? cfg.pumpAntiSeizeSpeed) : cfg.pumpAntiSeizeSpeed
    };
  }, [logicNodes]);

  const getValveWidgetParams = useCallback((widget: VisuWidget) => {
    if (widget.type !== 'visu-valve' || !widget.binding) return undefined;
    const node = logicNodes.find(n => n.id === parseDpKey(widget.binding?.dpKey).nodeId);
    if (!node || node.type !== 'valve-control') return undefined;
    const cfg = node.data.config || {};
    const customLabel = cfg.customLabel as string | undefined;
    const configName = cfg.valveName as string | undefined;
    const nodeName = configName || customLabel || node.data.label || 'Ventil';
    return {
      valveName: nodeName,
      valveMinOutput: cfg.valveMinOutput,
      valveMaxOutput: cfg.valveMaxOutput,
      valveMonitoringEnable: cfg.valveMonitoringEnable,
      valveTolerance: cfg.valveTolerance,
      valveAlarmDelayMs: cfg.valveAlarmDelayMs
    };
  }, [logicNodes]);

  const getSensorWidgetParams = useCallback((widget: VisuWidget) => {
    if (widget.type !== 'visu-sensor' || !widget.binding) return undefined;
    const node = logicNodes.find(n => n.id === parseDpKey(widget.binding?.dpKey).nodeId);
    if (!node || node.type !== 'sensor-control') return undefined;
    const cfg = node.data.config || {};
    const customLabel = cfg.customLabel as string | undefined;
    const configName = cfg.sensorName as string | undefined;
    const nodeName = configName || customLabel || node.data.label || 'Sensor';
    return {
      sensorName: nodeName,
      sensorMinLimit: cfg.sensorMinLimit,
      sensorMaxLimit: cfg.sensorMaxLimit,
      sensorUnit: cfg.sensorUnit,
      sensorMonitoringEnable: cfg.sensorMonitoringEnable,
      sensorAlarmDelayMs: cfg.sensorAlarmDelayMs,
      sensorRangeMin: cfg.sensorRangeMin,
      sensorRangeMax: cfg.sensorRangeMax
    };
  }, [logicNodes]);

  const getBoolSensorWidgetParams = useCallback((widget: VisuWidget) => {
    if (widget.type !== 'visu-bool-sensor' || !widget.binding) return undefined;
    const node = logicNodes.find(n => n.id === parseDpKey(widget.binding?.dpKey).nodeId);
    if (!node || node.type !== 'bool-sensor-control') return undefined;
    const cfg = node.data.config || {};
    const customLabel = cfg.customLabel as string | undefined;
    const configName = cfg.boolSensorName as string | undefined;
    const nodeName = configName || customLabel || node.data.label || 'Bool-Sensor';
    return {
      boolSensorName: nodeName,
      boolSensorAlarmOnTrue: cfg.boolSensorAlarmOnTrue as boolean | undefined,
      boolSensorMonitoringEnable: cfg.boolSensorMonitoringEnable as boolean | undefined,
      boolSensorAlarmDelayMs: cfg.boolSensorAlarmDelayMs as number | undefined,
      boolSensorNormalLabel: cfg.boolSensorNormalLabel as string | undefined,
      boolSensorAlarmLabel: cfg.boolSensorAlarmLabel as string | undefined,
      boolSensorSymbolType: cfg.boolSensorSymbolType as import('./VisuBoolSensor').BoolSensorSymbolType | undefined,
    };
  }, [logicNodes]);

  const getPIDWidgetParams = useCallback((widget: VisuWidget) => {
    if (widget.type !== 'visu-pid' || !widget.binding) return undefined;
    const node = logicNodes.find(n => n.id === parseDpKey(widget.binding?.dpKey).nodeId);
    if (!node || node.type !== 'pid-controller') return undefined;
    const cfg = node.data.config || {};
    const customLabel = cfg.customLabel as string | undefined;
    const configName = cfg.pidName as string | undefined;
    const nodeName = configName || customLabel || node.data.label || 'PID Regler';
    return {
      pidName: nodeName,
      pidKp: cfg.pidKp,
      pidKi: cfg.pidKi,
      pidKd: cfg.pidKd,
      pidWindupLimit: cfg.pidWindupLimit,
      pidMinOutput: cfg.pidMinOutput,
      pidMaxOutput: cfg.pidMaxOutput
    };
  }, [logicNodes]);

  const getHeatingCurveWidgetParams = useCallback((widget: VisuWidget) => {
    if (widget.type !== 'visu-heating-curve' || !widget.binding) return undefined;
    const nodeId = parseDpKey(widget.binding?.dpKey).nodeId;
    const node = logicNodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'heating-curve') return undefined;
    const cfg = node.data.config || {};
    const customLabel = cfg.customLabel as string | undefined;
    const configName = cfg.hcName as string | undefined;
    const nodeName = configName || customLabel || node.data.label || 'Heizkurve';
    const nightReductionActive = Boolean(liveValues[`${nodeId}:input-2`]);
    return {
      hcName: nodeName,
      hcMinInput: cfg.hcMinInput,
      hcMaxInput: cfg.hcMaxInput,
      hcMinOutput: cfg.hcMinOutput,
      hcMaxOutput: cfg.hcMaxOutput,
      hcReverseDirection: cfg.hcReverseDirection,
      hcNightSetback: cfg.hcNightSetback,
      nightReductionActive
    };
  }, [logicNodes, liveValues]);

  const getTimeProgramWidgetParams = useCallback((widget: VisuWidget) => {
    if (widget.type !== 'visu-time-program' || !widget.binding) return undefined;
    const node = logicNodes.find(n => n.id === parseDpKey(widget.binding?.dpKey).nodeId);
    if (!node || node.type !== 'time-program') return undefined;
    const cfg = node.data.config || {};
    const nodeName = (cfg.timeProgramName as string) || node.data.label || 'Zeitprogramm';
    return {
      tpName: nodeName,
      timeProgramOutputType: cfg.timeProgramOutputType,
      timeProgramDefaultValue: cfg.timeProgramDefaultValue,
      timeProgramEntries: cfg.timeProgramEntries,
      timeProgramExceptions: cfg.timeProgramExceptions
    };
  }, [logicNodes]);

  const getSequenceWidgetParams = useCallback((widget: VisuWidget) => {
    if (widget.type !== 'visu-sequence' || !widget.binding) return undefined;
    const node = logicNodes.find(n => n.id === parseDpKey(widget.binding?.dpKey).nodeId);
    if (!node || node.type !== 'sequence-control') return undefined;
    const cfg = node.data.config || {};
    const customLabel = cfg.customLabel as string | undefined;
    const configName = cfg.seqName as string | undefined;
    const nodeName = configName || customLabel || node.data.label || 'Sequenz';
    return {
      seqName: nodeName,
      seqCount: cfg.seqCount,
      seq1Name: cfg.seq1Name, seq1MinIn: cfg.seq1MinIn, seq1MaxIn: cfg.seq1MaxIn, seq1MinOut: cfg.seq1MinOut, seq1MaxOut: cfg.seq1MaxOut, seq1Enable: cfg.seq1Enable, seq1Reverse: cfg.seq1Reverse,
      seq2Name: cfg.seq2Name, seq2MinIn: cfg.seq2MinIn, seq2MaxIn: cfg.seq2MaxIn, seq2MinOut: cfg.seq2MinOut, seq2MaxOut: cfg.seq2MaxOut, seq2Enable: cfg.seq2Enable, seq2Reverse: cfg.seq2Reverse,
      seq3Name: cfg.seq3Name, seq3MinIn: cfg.seq3MinIn, seq3MaxIn: cfg.seq3MaxIn, seq3MinOut: cfg.seq3MinOut, seq3MaxOut: cfg.seq3MaxOut, seq3Enable: cfg.seq3Enable, seq3Reverse: cfg.seq3Reverse,
      seq4Name: cfg.seq4Name, seq4MinIn: cfg.seq4MinIn, seq4MaxIn: cfg.seq4MaxIn, seq4MinOut: cfg.seq4MinOut, seq4MaxOut: cfg.seq4MaxOut, seq4Enable: cfg.seq4Enable, seq4Reverse: cfg.seq4Reverse,
      seq5Name: cfg.seq5Name, seq5MinIn: cfg.seq5MinIn, seq5MaxIn: cfg.seq5MaxIn, seq5MinOut: cfg.seq5MinOut, seq5MaxOut: cfg.seq5MaxOut, seq5Enable: cfg.seq5Enable, seq5Reverse: cfg.seq5Reverse,
      seq6Name: cfg.seq6Name, seq6MinIn: cfg.seq6MinIn, seq6MaxIn: cfg.seq6MaxIn, seq6MinOut: cfg.seq6MinOut, seq6MaxOut: cfg.seq6MaxOut, seq6Enable: cfg.seq6Enable, seq6Reverse: cfg.seq6Reverse,
    };
  }, [logicNodes]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (drawingState) {
      const pos = snapPos(getCanvasPos(e));
      setDrawingState(prev => prev ? { ...prev, cursorPos: pos } : null);
    }
  }, [drawingState, getCanvasPos, snapPos]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (contextMenu) {
      setContextMenu(null);
      return;
    }
    if (drawingState) return;
    if (Date.now() - lassoJustCompletedRef.current < 200) return;
    if (e.target === canvasRef.current) {
      onSelectWidget(null);
      onSelectWidgets?.([]);
    }
  }, [onSelectWidget, onSelectWidgets, contextMenu, drawingState]);

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isEditMode) return;
    if (e.target !== canvasRef.current) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, widgetId: null });
  }, [isEditMode]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (contextMenu) {
      setContextMenu(null);
      return;
    }
    if (drawingState) {
      const isOnOwnWidget = (e.target as HTMLElement).closest(`[data-widget-id="${drawingState.widgetId}"]`) !== null;
      const isOnCanvas = e.target === canvasRef.current || (e.target as HTMLElement).closest('[data-visu-canvas]') !== null;
      if (!isOnCanvas && !isOnOwnWidget && drawingState.type === 'line' && drawingState.linePhase === 0) return;
      e.stopPropagation();
      e.preventDefault();

      const pos = snapPos(getCanvasPos(e));

      if (drawingState.type === 'line') {
        if (drawingState.linePhase === 0) {
          setDrawingState(prev => prev ? { ...prev, points: [pos], linePhase: 1 } : null);
        } else {
          const pts = drawingState.points;
          if (pts.length >= 1) {
            const startPt = pts[0];
            const endPt = pos;
            const lCfg = page.widgets.find(w => w.id === drawingState.widgetId)?.config as LineConfig;
            const bx = Math.min(startPt.x, endPt.x);
            const by = Math.min(startPt.y, endPt.y);
            const bw = Math.max(Math.abs(endPt.x - startPt.x), 1);
            const bh = Math.max(Math.abs(endPt.y - startPt.y), 1);
            onUpdateWidget(drawingState.widgetId, {
              config: { ...lCfg, x1: startPt.x, y1: startPt.y, x2: endPt.x, y2: endPt.y },
              position: { x: bx, y: by },
              size: { width: bw, height: bh }
            });
            setDrawingState(null);
          }
        }
      } else if (drawingState.type === 'polygon') {
        const pts = drawingState.points;
        if (pts.length >= 3) {
          const firstPt = pts[0];
          const dist = Math.sqrt((pos.x - firstPt.x) ** 2 + (pos.y - firstPt.y) ** 2);
          if (dist < 15) {
            const pCfg = page.widgets.find(w => w.id === drawingState.widgetId)?.config as PolygonConfig;
            onUpdateWidget(drawingState.widgetId, {
              config: { ...pCfg, points: pts },
              position: { x: 0, y: 0 },
              size: { width: 1, height: 1 }
            });
            setDrawingState(null);
            return;
          }
        }
        setDrawingState(prev => prev ? { ...prev, points: [...prev.points, pos] } : null);
      }
      return;
    }

    if (isEditMode && e.button === 0) {
      const target = e.target as HTMLElement;
      const isOnWidget = target.closest('[data-widget-id]') !== null;
      if (!isOnWidget || e.shiftKey) {
        const pos = getCanvasPos(e);
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          onSelectWidget(null);
          onSelectWidgets?.([]);
        }
        setLassoState({
          startX: pos.x,
          startY: pos.y,
          currentX: pos.x,
          currentY: pos.y
        });
        e.preventDefault();
      }
    }

  }, [drawingState, contextMenu, isEditMode, getCanvasPos, snapPos, page.widgets, onUpdateWidget, onSelectWidget, onSelectWidgets]);

  const handleWidgetContextMenu = useCallback((e: React.MouseEvent, widgetId: string) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    const isInSelection = selectedWidgetIds.includes(widgetId);
    if (!isInSelection) {
      onSelectWidget(widgetId);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, widgetId });
  }, [isEditMode, onSelectWidget, selectedWidgetIds]);

  const handleWidgetMouseDown = useCallback((e: React.MouseEvent, widgetId: string) => {
    if (!isEditMode) return;
    if (contextMenu) {
      setContextMenu(null);
      return;
    }

    if (e.shiftKey) return;

    if (drawingState) return;

    const widget = page.widgets.find(w => w.id === widgetId);
    if (!widget || widget.locked) return;

    const target = e.target as HTMLElement;
    const isResizeHandle = target.classList.contains('cursor-nw-resize') ||
      target.classList.contains('cursor-ne-resize') ||
      target.classList.contains('cursor-sw-resize') ||
      target.classList.contains('cursor-se-resize');

    if (isResizeHandle) {
      let corner = '';
      if (target.classList.contains('cursor-nw-resize')) corner = 'nw';
      else if (target.classList.contains('cursor-ne-resize')) corner = 'ne';
      else if (target.classList.contains('cursor-sw-resize')) corner = 'sw';
      else if (target.classList.contains('cursor-se-resize')) corner = 'se';

      setResizeState({
        widgetId,
        corner,
        startX: e.clientX,
        startY: e.clientY,
        widgetStartWidth: widget.size.width,
        widgetStartHeight: widget.size.height,
        widgetStartX: widget.position.x,
        widgetStartY: widget.position.y
      });
    } else {
      const currentSelection = selectedWidgetIds.length > 0
        ? selectedWidgetIds
        : (selectedWidgetId ? [selectedWidgetId] : []);
      const isInSelection = currentSelection.includes(widgetId);

      if (e.ctrlKey || e.metaKey) {
        if (isInSelection) {
          const newSelection = currentSelection.filter(id => id !== widgetId);
          onSelectWidgets?.(newSelection);
        } else {
          const newSelection = [...currentSelection, widgetId];
          onSelectWidgets?.(newSelection);
        }
        e.preventDefault();
        return;
      }

      if (isInSelection && selectedWidgetIds.length > 1) {
        const initialPositions: Record<string, { x: number; y: number }> = {};
        const initialConfigs: Record<string, Record<string, unknown>> = {};
        for (const id of selectedWidgetIds) {
          const w = page.widgets.find(ww => ww.id === id);
          if (w) {
            initialPositions[id] = { x: w.position.x, y: w.position.y };
            if (['visu-line', 'visu-polyline', 'visu-polygon'].includes(w.type)) {
              initialConfigs[id] = JSON.parse(JSON.stringify(w.config));
            }
          }
        }
        multiDragActivatedRef.current = false;
        setMultiDragState({
          widgetIds: selectedWidgetIds,
          startX: e.clientX,
          startY: e.clientY,
          initialPositions,
          initialConfigs
        });
      } else {
        const isVertex = ['visu-line', 'visu-polyline', 'visu-polygon'].includes(widget.type);
        dragActivatedRef.current = false;
        setDragState({
          widgetId,
          startX: e.clientX,
          startY: e.clientY,
          widgetStartX: widget.position.x,
          widgetStartY: widget.position.y,
          isVertex,
          initialConfig: isVertex ? JSON.parse(JSON.stringify(widget.config)) : undefined
        });
        onSelectWidgets?.([widgetId]);
      }
    }

    const isInMultiSelection = selectedWidgetIds.includes(widgetId) && selectedWidgetIds.length > 1;
    if (!isInMultiSelection) {
      onSelectWidget(widgetId);
    }
    e.preventDefault();
  }, [isEditMode, page.widgets, onSelectWidget, onSelectWidgets, selectedWidgetIds, contextMenu, drawingState]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (lassoState) {
      const pos = getCanvasPos(e);
      setLassoState(prev => prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null);
      return;
    }

    if (multiDragState) {
      const rawDeltaX = (e.clientX - multiDragState.startX) / zoom;
      const rawDeltaY = (e.clientY - multiDragState.startY) / zoom;
      if (!multiDragActivatedRef.current) {
        if (Math.abs(rawDeltaX) < 4 && Math.abs(rawDeltaY) < 4) return;
        multiDragActivatedRef.current = true;
      }
      const gridSize = page.gridSize || 10;
      let dx = rawDeltaX;
      let dy = rawDeltaY;
      if (page.showGrid) {
        dx = Math.round(dx / gridSize) * gridSize;
        dy = Math.round(dy / gridSize) * gridSize;
      }
      if (onUpdateWidgets) {
        const updates = multiDragState.widgetIds.map(id => {
          const initial = multiDragState.initialPositions[id];
          const cfg = multiDragState.initialConfigs[id];
          const newPos = { x: Math.max(0, initial.x + dx), y: Math.max(0, initial.y + dy) };
          const w = page.widgets.find(ww => ww.id === id);
          if (cfg && w) {
            if (w.type === 'visu-line' || w.type === 'visu-arrow') {
              const lc = cfg as { x1?: number; y1?: number; x2?: number; y2?: number };
              const nx1 = (lc.x1 ?? 0) + dx, ny1 = (lc.y1 ?? 0) + dy;
              const nx2 = (lc.x2 ?? 0) + dx, ny2 = (lc.y2 ?? 0) + dy;
              return { widgetId: id, updates: { config: { ...cfg, x1: nx1, y1: ny1, x2: nx2, y2: ny2 } as VisuWidget['config'], position: newPos } };
            } else if (w.type === 'visu-polyline' || w.type === 'visu-polygon') {
              const pts = (cfg.points as { x: number; y: number }[]) || [];
              return { widgetId: id, updates: { config: { ...cfg, points: pts.map(p => ({ x: p.x + dx, y: p.y + dy })) } as VisuWidget['config'], position: newPos } };
            }
          }
          return { widgetId: id, updates: { position: newPos } };
        });
        onUpdateWidgets(updates);
      } else {
        for (const id of multiDragState.widgetIds) {
          const initial = multiDragState.initialPositions[id];
          const cfg = multiDragState.initialConfigs[id];
          const newPos = { x: Math.max(0, initial.x + dx), y: Math.max(0, initial.y + dy) };
          const w = page.widgets.find(ww => ww.id === id);
          if (cfg && w) {
            if (w.type === 'visu-line' || w.type === 'visu-arrow') {
              const lc = cfg as { x1?: number; y1?: number; x2?: number; y2?: number };
              const nx1 = (lc.x1 ?? 0) + dx, ny1 = (lc.y1 ?? 0) + dy;
              const nx2 = (lc.x2 ?? 0) + dx, ny2 = (lc.y2 ?? 0) + dy;
              onUpdateWidget(id, { config: { ...cfg, x1: nx1, y1: ny1, x2: nx2, y2: ny2 } as VisuWidget['config'], position: newPos });
            } else if (w.type === 'visu-polyline' || w.type === 'visu-polygon') {
              const pts = (cfg.points as { x: number; y: number }[]) || [];
              onUpdateWidget(id, { config: { ...cfg, points: pts.map(p => ({ x: p.x + dx, y: p.y + dy })) } as VisuWidget['config'], position: newPos });
            } else {
              onUpdateWidget(id, { position: newPos });
            }
          } else {
            onUpdateWidget(id, { position: newPos });
          }
        }
      }
    }

    if (dragState) {
      const rawDeltaX = (e.clientX - dragState.startX) / zoom;
      const rawDeltaY = (e.clientY - dragState.startY) / zoom;
      if (!dragActivatedRef.current) {
        if (Math.abs(rawDeltaX) < 4 && Math.abs(rawDeltaY) < 4) return;
        dragActivatedRef.current = true;
      }
      const gridSize = page.gridSize || 10;

      if (dragState.isVertex && dragState.initialConfig) {
        let dx = rawDeltaX;
        let dy = rawDeltaY;
        if (page.showGrid) {
          dx = Math.round(dx / gridSize) * gridSize;
          dy = Math.round(dy / gridSize) * gridSize;
        }
        const cfg = dragState.initialConfig as Record<string, unknown>;
        const widget = page.widgets.find(w => w.id === dragState.widgetId);
        if (!widget) return;

        if (widget.type === 'visu-line') {
          const lCfg = cfg as { x1?: number; y1?: number; x2?: number; y2?: number };
          if (lCfg.x1 !== undefined) {
            const nx1 = (lCfg.x1 ?? 0) + dx;
            const ny1 = (lCfg.y1 ?? 0) + dy;
            const nx2 = (lCfg.x2 ?? 0) + dx;
            const ny2 = (lCfg.y2 ?? 0) + dy;
            onUpdateWidget(dragState.widgetId, {
              config: { ...cfg, x1: nx1, y1: ny1, x2: nx2, y2: ny2 },
              position: { x: Math.min(nx1, nx2), y: Math.min(ny1, ny2) },
              size: { width: Math.max(Math.abs(nx2 - nx1), 1), height: Math.max(Math.abs(ny2 - ny1), 1) }
            });
          }
        } else if (widget.type === 'visu-polyline' || widget.type === 'visu-polygon') {
          const pts = (cfg.points as { x: number; y: number }[]) || [];
          onUpdateWidget(dragState.widgetId, {
            config: {
              ...cfg,
              points: pts.map(p => ({ x: p.x + dx, y: p.y + dy }))
            }
          });
        }
      } else {
        let newX = dragState.widgetStartX + rawDeltaX;
        let newY = dragState.widgetStartY + rawDeltaY;

        if (page.showGrid) {
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        }

        newX = Math.max(0, newX);
        newY = Math.max(0, newY);

        onUpdateWidget(dragState.widgetId, {
          position: { x: newX, y: newY }
        });
      }
    }

    if (resizeState) {
      const deltaX = (e.clientX - resizeState.startX) / zoom;
      const deltaY = (e.clientY - resizeState.startY) / zoom;
      const gridSize = page.gridSize || 10;
      const minSize = 40;

      let newWidth = resizeState.widgetStartWidth;
      let newHeight = resizeState.widgetStartHeight;
      let newX = resizeState.widgetStartX;
      let newY = resizeState.widgetStartY;

      switch (resizeState.corner) {
        case 'se':
          newWidth = Math.max(minSize, resizeState.widgetStartWidth + deltaX);
          newHeight = Math.max(minSize, resizeState.widgetStartHeight + deltaY);
          break;
        case 'sw':
          newWidth = Math.max(minSize, resizeState.widgetStartWidth - deltaX);
          newHeight = Math.max(minSize, resizeState.widgetStartHeight + deltaY);
          newX = resizeState.widgetStartX + (resizeState.widgetStartWidth - newWidth);
          break;
        case 'ne':
          newWidth = Math.max(minSize, resizeState.widgetStartWidth + deltaX);
          newHeight = Math.max(minSize, resizeState.widgetStartHeight - deltaY);
          newY = resizeState.widgetStartY + (resizeState.widgetStartHeight - newHeight);
          break;
        case 'nw':
          newWidth = Math.max(minSize, resizeState.widgetStartWidth - deltaX);
          newHeight = Math.max(minSize, resizeState.widgetStartHeight - deltaY);
          newX = resizeState.widgetStartX + (resizeState.widgetStartWidth - newWidth);
          newY = resizeState.widgetStartY + (resizeState.widgetStartHeight - newHeight);
          break;
      }

      if (page.showGrid) {
        newWidth = Math.round(newWidth / gridSize) * gridSize;
        newHeight = Math.round(newHeight / gridSize) * gridSize;
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }

      onUpdateWidget(resizeState.widgetId, {
        position: { x: newX, y: newY },
        size: { width: newWidth, height: newHeight }
      });
    }
  }, [dragState, multiDragState, resizeState, lassoState, getCanvasPos, page.gridSize, page.showGrid, page.widgets, onUpdateWidget, onUpdateWidgets]);

  const handleMouseUp = useCallback(() => {
    if (lassoState) {
      const minX = Math.min(lassoState.startX, lassoState.currentX);
      const maxX = Math.max(lassoState.startX, lassoState.currentX);
      const minY = Math.min(lassoState.startY, lassoState.currentY);
      const maxY = Math.max(lassoState.startY, lassoState.currentY);

      const lassoRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

      if (lassoRect.width > 5 || lassoRect.height > 5) {
        const intersectingWidgets = page.widgets.filter(widget => {
          let wx: number, wy: number, ww: number, wh: number;
          if (widget.type === 'visu-line' || widget.type === 'visu-arrow') {
            const cfg = widget.config as { x1?: number; y1?: number; x2?: number; y2?: number };
            if (cfg.x1 !== undefined && cfg.y1 !== undefined && cfg.x2 !== undefined && cfg.y2 !== undefined) {
              wx = Math.min(cfg.x1, cfg.x2);
              wy = Math.min(cfg.y1, cfg.y2);
              ww = Math.abs(cfg.x2 - cfg.x1);
              wh = Math.abs(cfg.y2 - cfg.y1);
              const pad = 8;
              wx -= pad; wy -= pad; ww += pad * 2; wh += pad * 2;
            } else {
              wx = widget.position.x; wy = widget.position.y;
              ww = widget.size.width; wh = widget.size.height;
            }
          } else if (widget.type === 'visu-polyline' || widget.type === 'visu-polygon') {
            const cfg = widget.config as { points?: { x: number; y: number }[] };
            if (cfg.points && cfg.points.length > 0) {
              const xs = cfg.points.map(p => p.x);
              const ys = cfg.points.map(p => p.y);
              wx = Math.min(...xs); wy = Math.min(...ys);
              ww = Math.max(...xs) - wx; wh = Math.max(...ys) - wy;
            } else {
              wx = widget.position.x; wy = widget.position.y;
              ww = widget.size.width; wh = widget.size.height;
            }
          } else {
            wx = widget.position.x; wy = widget.position.y;
            ww = widget.size.width; wh = widget.size.height;
          }

          return !(wx + ww < lassoRect.x || wx > lassoRect.x + lassoRect.width ||
                   wy + wh < lassoRect.y || wy > lassoRect.y + lassoRect.height);
        });

        const newIds = intersectingWidgets.map(w => w.id);
        if (newIds.length > 0) {
          onSelectWidgets?.(newIds);
          if (newIds.length === 1) {
            onSelectWidget(newIds[0]);
          }
        }
      }

      lassoJustCompletedRef.current = Date.now();
      setLassoState(null);
      return;
    }

    dragActivatedRef.current = false;
    multiDragActivatedRef.current = false;
    setDragState(null);
    setMultiDragState(null);
    setResizeState(null);
  }, [lassoState, page.widgets, onSelectWidget, onSelectWidgets]);

  useEffect(() => {
    if (dragState || resizeState || multiDragState || lassoState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, resizeState, multiDragState, lassoState, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (!isEditMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape' && drawingState) {
        const widget = page.widgets.find(w => w.id === drawingState.widgetId);
        if (widget) onDeleteWidget(drawingState.widgetId);
        setDrawingState(null);
        return;
      }

      if (e.key === 'Escape') {
        onSelectWidget(null);
        onSelectWidgets?.([]);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        onPasteWidget();
        return;
      }

      const hasMultiSelection = selectedWidgetIds.length > 1;

      if (hasMultiSelection) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          if (onDeleteWidgets) {
            onDeleteWidgets(selectedWidgetIds);
          } else {
            for (const id of selectedWidgetIds) onDeleteWidget(id);
          }
          onSelectWidgets?.([]);
          onSelectWidget(null);
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          e.preventDefault();
          onCopyWidgets?.(selectedWidgetIds);
        }
        return;
      }

      const isArrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
      if (isArrow) {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;

        if (hasMultiSelection) {
          e.preventDefault();
          for (const id of selectedWidgetIds) {
            const w = page.widgets.find(ww => ww.id === id);
            if (!w || w.locked) continue;
            if (w.type === 'visu-line' || w.type === 'visu-arrow') {
              const lc = w.config as { x1?: number; y1?: number; x2?: number; y2?: number };
              onUpdateWidget(id, {
                config: { ...w.config, x1: (lc.x1 ?? 0) + dx, y1: (lc.y1 ?? 0) + dy, x2: (lc.x2 ?? 0) + dx, y2: (lc.y2 ?? 0) + dy },
                position: { x: w.position.x + dx, y: w.position.y + dy }
              });
            } else if (w.type === 'visu-polyline' || w.type === 'visu-polygon') {
              const pts = (w.config as { points?: { x: number; y: number }[] }).points || [];
              onUpdateWidget(id, {
                config: { ...w.config, points: pts.map(p => ({ x: p.x + dx, y: p.y + dy })) },
                position: { x: w.position.x + dx, y: w.position.y + dy }
              });
            } else {
              onUpdateWidget(id, { position: { x: Math.max(0, w.position.x + dx), y: Math.max(0, w.position.y + dy) } });
            }
          }
          return;
        }

        if (selectedWidgetId) {
          e.preventDefault();
          const w = page.widgets.find(ww => ww.id === selectedWidgetId);
          if (w && !w.locked) {
            if (w.type === 'visu-line' || w.type === 'visu-arrow') {
              const lc = w.config as { x1?: number; y1?: number; x2?: number; y2?: number };
              onUpdateWidget(selectedWidgetId, {
                config: { ...w.config, x1: (lc.x1 ?? 0) + dx, y1: (lc.y1 ?? 0) + dy, x2: (lc.x2 ?? 0) + dx, y2: (lc.y2 ?? 0) + dy },
                position: { x: w.position.x + dx, y: w.position.y + dy }
              });
            } else if (w.type === 'visu-polyline' || w.type === 'visu-polygon') {
              const pts = (w.config as { points?: { x: number; y: number }[] }).points || [];
              onUpdateWidget(selectedWidgetId, {
                config: { ...w.config, points: pts.map(p => ({ x: p.x + dx, y: p.y + dy })) },
                position: { x: w.position.x + dx, y: w.position.y + dy }
              });
            } else {
              onUpdateWidget(selectedWidgetId, { position: { x: Math.max(0, w.position.x + dx), y: Math.max(0, w.position.y + dy) } });
            }
          }
          return;
        }
      }

      if (!selectedWidgetId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteWidget(selectedWidgetId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        onCopyWidget(selectedWidgetId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        onDuplicateWidget(selectedWidgetId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, selectedWidgetId, selectedWidgetIds, drawingState, onDeleteWidget, onDeleteWidgets, onCopyWidget, onCopyWidgets, onDuplicateWidget, onPasteWidget, page.widgets, onSelectWidget, onSelectWidgets, onUpdateWidget]);

  const gridPattern = page.showGrid && page.gridSize ? (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.1 }}>
      <defs>
        <pattern id="grid" width={page.gridSize} height={page.gridSize} patternUnits="userSpaceOnUse">
          <path d={`M ${page.gridSize} 0 L 0 0 0 ${page.gridSize}`} fill="none" stroke="#94a3b8" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  ) : null;

  const drawingOverlay = drawingState ? (() => {
    const pts = drawingState.points;
    const cur = drawingState.cursorPos;
    const allPts = cur ? [...pts, cur] : pts;

    if (drawingState.type === 'line') {
      return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 9999 }}>
          {allPts.length >= 2 && (
            <line
              x1={allPts[0].x} y1={allPts[0].y}
              x2={allPts[1].x} y2={allPts[1].y}
              stroke="#3b82f6" strokeWidth={2} strokeDasharray="6,3"
            />
          )}
          {allPts.length === 1 && cur && (
            <line
              x1={allPts[0].x} y1={allPts[0].y}
              x2={cur.x} y2={cur.y}
              stroke="#3b82f6" strokeWidth={2} strokeDasharray="6,3"
            />
          )}
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={5} fill="#3b82f6" stroke="white" strokeWidth={2} />
          ))}
          {cur && pts.length === 0 && (
            <circle cx={cur.x} cy={cur.y} r={5} fill="#3b82f6" opacity={0.5} stroke="white" strokeWidth={2} />
          )}
        </svg>
      );
    }

    if (drawingState.type === 'polygon') {
      const pathPts = allPts.length > 0 ? allPts : [];
      const pathD = pathPts.length > 1
        ? pathPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
        : '';
      const firstPt = pts[0];
      const nearClose = firstPt && cur && pts.length >= 3 && Math.sqrt((cur.x - firstPt.x) ** 2 + (cur.y - firstPt.y) ** 2) < 15;

      return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 9999 }}>
          {pathD && (
            <path d={pathD} fill="rgba(59,130,246,0.1)" stroke="#3b82f6" strokeWidth={2} strokeDasharray={cur ? "6,3" : "none"} strokeLinejoin="round" />
          )}
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 7 : 5}
              fill={i === 0 ? (pts.length >= 3 ? '#22c55e' : '#3b82f6') : '#3b82f6'}
              stroke="white" strokeWidth={2} />
          ))}
          {nearClose && firstPt && (
            <circle cx={firstPt.x} cy={firstPt.y} r={12} fill="none" stroke="#22c55e" strokeWidth={2} opacity={0.8} />
          )}
        </svg>
      );
    }
    return null;
  })() : null;

  const drawingCursor = drawingState ? 'crosshair' : undefined;

  const hasFixedSize = page.canvasWidth && page.canvasHeight;

  const isMultiSelected = (widgetId: string) => selectedWidgetIds.includes(widgetId);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>(
    () => ({ width: window.innerWidth, height: window.innerHeight })
  );

  useEffect(() => {
    if (isEditMode) return;

    const updateSize = () => {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      } else {
        setContainerSize({ width: window.innerWidth, height: window.innerHeight });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [isEditMode]);

  const widgetsBounds = useMemo(() => {
    if (page.widgets.length === 0) return { maxX: 800, maxY: 600 };
    let maxX = 0;
    let maxY = 0;
    for (const widget of page.widgets) {
      const right = widget.position.x + widget.size.width;
      const bottom = widget.position.y + widget.size.height;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }
    return { maxX: maxX + 20, maxY: maxY + 20 };
  }, [page.widgets]);

  const responsiveScale = useMemo(() => {
    if (isEditMode) return 1;

    const canvasW = hasFixedSize ? page.canvasWidth! : widgetsBounds.maxX;
    const canvasH = hasFixedSize ? page.canvasHeight! : widgetsBounds.maxY;

    if (!canvasW || !canvasH) return 1;

    const scaleX = containerSize.width / canvasW;
    const scaleY = containerSize.height / canvasH;
    return Math.min(scaleX, scaleY);
  }, [isEditMode, hasFixedSize, containerSize, page.canvasWidth, page.canvasHeight, widgetsBounds]);

  const shouldScale = !isEditMode && responsiveScale !== 1;

  if (!isEditMode) {
    const canvasW = hasFixedSize ? page.canvasWidth! : widgetsBounds.maxX;
    const canvasH = hasFixedSize ? page.canvasHeight! : widgetsBounds.maxY;

    const scaledWidth = canvasW * responsiveScale;
    const scaledHeight = canvasH * responsiveScale;

    return (
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: page.backgroundColor || '#0f172a' }}
      >
        <div
          style={{
            width: scaledWidth,
            height: scaledHeight,
            position: 'relative',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
        <div
          ref={canvasRef}
          className="relative"
          style={{
            width: canvasW,
            height: canvasH,
            transform: `scale(${responsiveScale})`,
            transformOrigin: 'top left',
            backgroundColor: page.backgroundColor || '#0f172a',
          }}
          onClick={handleCanvasClick}
        >
          {page.widgets.map((widget) => (
            <VisuWidgetRenderer
              key={widget.id}
              widget={widget}
              value={getWidgetValue(widget)}
              statusValue={getWidgetStatusValue(widget)}
              onValueChange={(value) => { const dpKey = getWidgetDpKey(widget); if (dpKey) onWidgetValueChange(dpKey, value); }}
              onUpdateConfig={(config) => onUpdateWidget(widget.id, { config: config as VisuWidget['config'] })}
              isEditMode={false}
              isSelected={false}
              isMultiSelected={false}
              onSelect={() => {}}
              onDoubleClick={() => {}}
              onMouseDown={() => {}}
              onContextMenu={() => {}}
              onNavigateToPage={onNavigateToPage}
              onNavigateBack={onNavigateBack}
              onNavigateHome={onNavigateHome}
              pumpParams={getPumpWidgetParams(widget)}
              valveParams={getValveWidgetParams(widget)}
              sensorParams={getSensorWidgetParams(widget)}
              boolSensorParams={getBoolSensorWidgetParams(widget)}
              pidParams={getPIDWidgetParams(widget)}
              heatingCurveParams={getHeatingCurveWidgetParams(widget)}
              timeProgramParams={getTimeProgramWidgetParams(widget)}
              sequenceParams={getSequenceWidgetParams(widget)}
              isHighlighted={highlightedWidgetId === widget.id}
              alarmClasses={alarmClasses}
              alarmConsoles={alarmConsoles}
              activeAlarms={activeAlarms}
              onAcknowledgeAlarm={onAcknowledgeAlarm}
              onAcknowledgeAll={onAcknowledgeAll}
              onClearAlarm={onClearAlarm}
              onShelveAlarm={onShelveAlarm}
              liveValues={liveValues}
            />
          ))}
        </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      data-visu-canvas="true"
      className="relative"
      style={{
        backgroundColor: page.backgroundColor || '#0f172a',
        cursor: drawingCursor,
        width: hasFixedSize ? page.canvasWidth : Math.max(widgetsBounds.maxX + 200, 1200),
        height: hasFixedSize ? page.canvasHeight : Math.max(widgetsBounds.maxY + 200, 800),
        minWidth: hasFixedSize ? page.canvasWidth : Math.max(widgetsBounds.maxX + 200, 1200),
        minHeight: hasFixedSize ? page.canvasHeight : Math.max(widgetsBounds.maxY + 200, 800),
      }}
      onClick={handleCanvasClick}
      onMouseMove={handleCanvasMouseMove}
      onMouseDown={handleCanvasMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => {
        if (e.target === canvasRef.current) {
          handleCanvasContextMenu(e);
        }
      }}
    >
      {gridPattern}
      {drawingState && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-800/90 text-slate-200 text-xs px-3 py-1.5 rounded-full border border-slate-600 pointer-events-none z-50">
          {drawingState.type === 'line' && drawingState.linePhase === 0 && 'Startpunkt klicken'}
          {drawingState.type === 'line' && drawingState.linePhase === 1 && 'Endpunkt klicken'}
          {drawingState.type === 'polygon' && drawingState.points.length === 0 && 'Ersten Punkt klicken'}
          {drawingState.type === 'polygon' && drawingState.points.length === 1 && 'Weiteren Punkt klicken'}
          {drawingState.type === 'polygon' && drawingState.points.length === 2 && 'Weiteren Punkt klicken'}
          {drawingState.type === 'polygon' && drawingState.points.length >= 3 && 'Weitere Punkte oder auf Startpunkt klicken zum Schliessen — ESC abbrechen'}
        </div>
      )}
      {page.widgets.map((widget) => (
        <VisuWidgetRenderer
          key={widget.id}
          widget={widget}
          value={getWidgetValue(widget)}
          statusValue={getWidgetStatusValue(widget)}
          onValueChange={(value) => { const dpKey = getWidgetDpKey(widget); if (dpKey) onWidgetValueChange(dpKey, value); }}
          onUpdateConfig={(config) => {
            const cfg = config as Record<string, unknown>;
            if ((widget.type === 'visu-line' || widget.type === 'visu-arrow') &&
                cfg.x1 !== undefined && cfg.y1 !== undefined && cfg.x2 !== undefined && cfg.y2 !== undefined) {
              const x1 = cfg.x1 as number, y1 = cfg.y1 as number, x2 = cfg.x2 as number, y2 = cfg.y2 as number;
              onUpdateWidget(widget.id, {
                config: cfg as VisuWidget['config'],
                position: { x: Math.min(x1, x2), y: Math.min(y1, y2) },
                size: { width: Math.max(Math.abs(x2 - x1), 1), height: Math.max(Math.abs(y2 - y1), 1) }
              });
            } else {
              onUpdateWidget(widget.id, { config: cfg as VisuWidget['config'] });
            }
          }}
          isEditMode={isEditMode}
          isSelected={selectedWidgetId === widget.id || isMultiSelected(widget.id)}
          isMultiSelected={isMultiSelected(widget.id)}
          onSelect={() => onSelectWidget(widget.id)}
          onDoubleClick={() => onEditWidgetProperties(widget.id)}
          onMouseDown={(e) => handleWidgetMouseDown(e, widget.id)}
          onContextMenu={(e) => handleWidgetContextMenu(e, widget.id)}
          onNavigateToPage={onNavigateToPage}
          onNavigateBack={onNavigateBack}
          onNavigateHome={onNavigateHome}
          pumpParams={getPumpWidgetParams(widget)}
          valveParams={getValveWidgetParams(widget)}
          sensorParams={getSensorWidgetParams(widget)}
          pidParams={getPIDWidgetParams(widget)}
          heatingCurveParams={getHeatingCurveWidgetParams(widget)}
          timeProgramParams={getTimeProgramWidgetParams(widget)}
          sequenceParams={getSequenceWidgetParams(widget)}
          isHighlighted={highlightedWidgetId === widget.id}
          isCrossPageBinding={isCrossPageBinding(widget)}
          alarmClasses={alarmClasses}
          alarmConsoles={alarmConsoles}
          activeAlarms={activeAlarms}
          onAcknowledgeAlarm={onAcknowledgeAlarm}
          onAcknowledgeAll={onAcknowledgeAll}
          onClearAlarm={onClearAlarm}
          onShelveAlarm={onShelveAlarm}
          liveValues={liveValues}
          zoom={zoom}
        />
      ))}

      {drawingOverlay}

      {lassoState && (
        <div
          className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/10"
          style={{
            left: Math.min(lassoState.startX, lassoState.currentX),
            top: Math.min(lassoState.startY, lassoState.currentY),
            width: Math.abs(lassoState.currentX - lassoState.startX),
            height: Math.abs(lassoState.currentY - lassoState.startY),
            zIndex: 9998
          }}
        />
      )}

      {contextMenu && (
        <div
          className="fixed bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 py-1 min-w-48"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.widgetId && (
            <>
              <button className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                onClick={() => { onBringToFront(contextMenu.widgetId!); setContextMenu(null); }}>
                Ganz nach vorne
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                onClick={() => { onBringForward(contextMenu.widgetId!); setContextMenu(null); }}>
                Eine Ebene nach vorne
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                onClick={() => { onSendBackward(contextMenu.widgetId!); setContextMenu(null); }}>
                Eine Ebene nach hinten
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                onClick={() => { onSendToBack(contextMenu.widgetId!); setContextMenu(null); }}>
                Ganz nach hinten
              </button>
              <div className="border-t border-slate-700 my-1" />
              {selectedWidgetIds.length > 1 ? (
                <>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                    onClick={() => { onCopyWidgets?.(selectedWidgetIds); setContextMenu(null); }}
                  >
                    <span>{selectedWidgetIds.length} Widgets kopieren</span>
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/30"
                    onClick={() => {
                      if (onDeleteWidgets) {
                        onDeleteWidgets(selectedWidgetIds);
                      } else {
                        for (const id of selectedWidgetIds) onDeleteWidget(id);
                      }
                      onSelectWidgets?.([]);
                      onSelectWidget(null);
                      setContextMenu(null);
                    }}
                  >
                    {selectedWidgetIds.length} Widgets loschen
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                    onClick={() => { onDuplicateWidget(contextMenu.widgetId!); setContextMenu(null); }}
                  >
                    <span>Duplizieren</span>
                    <span className="text-slate-500 text-xs">Strg+D</span>
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                    onClick={() => { onCopyWidget(contextMenu.widgetId!); setContextMenu(null); }}
                  >
                    <span>Kopieren</span>
                    <span className="text-slate-500 text-xs">Strg+C</span>
                  </button>
                  {clipboard && (
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                      onClick={() => { onPasteWidget(); setContextMenu(null); }}
                    >
                      <span>Einfuegen</span>
                      <span className="text-slate-500 text-xs">Strg+V</span>
                    </button>
                  )}
                  <div className="border-t border-slate-700 my-1" />
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/30 flex items-center justify-between"
                    onClick={() => { onDeleteWidget(contextMenu.widgetId!); setContextMenu(null); }}
                  >
                    <span>Loschen</span>
                    <span className="text-slate-500 text-xs">Entf</span>
                  </button>
                </>
              )}
            </>
          )}
          {!contextMenu.widgetId && (
            <>
              {clipboard && (
                <button
                  className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                  onClick={() => { onPasteWidget(); setContextMenu(null); }}
                >
                  <span>Einfuegen</span>
                  <span className="text-slate-500 text-xs">Strg+V</span>
                </button>
              )}
              {!clipboard && (
                <div className="px-4 py-2 text-sm text-slate-500">Kein Widget in Zwischenablage</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
