import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { NodePalette } from './components/NodePalette';
import { FlowCanvas } from './components/FlowCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { CustomBlockLibrary } from './components/CustomBlockLibrary';
import { CustomBlockEditor } from './components/CustomBlockEditor';
import { VisualizationView } from './components/visualization/VisualizationView';
import { BackupModal } from './components/BackupModal';
import { DriversView } from './components/DriversView';
import { DriverPanel } from './components/DriverPanel';
import { AlarmManagementView } from './components/AlarmManagementView';
import { useWiresheetPages } from './hooks/useWiresheetPages';
import { useCustomBlocks } from './hooks/useCustomBlocks';
import { useVisualization } from './hooks/useVisualization';
import { useAlarmManagement } from './hooks/useAlarmManagement';
import { NodeTemplate, FlowNode, CustomBlockDefinition, Connection, ModbusDevice, WiresheetPage, DriverBinding, HaDevice, HaEntity, BindingStatus } from './types/flow';
import { VisuBindingInfo } from './components/FlowNode';
import { VisuPage } from './types/visualization';
import {
  Workflow, Plus, X, Play, Square, ChevronDown, ChevronUp,
  Clock, Save, Check, AlertCircle, Pencil, Blocks, LayoutGrid,
  Monitor, Cpu, DatabaseBackup, Network, Bell
} from 'lucide-react';

function App() {
  const {
    pages,
    activePage,
    activePageId,
    setActivePageId,
    addPage,
    deletePage,
    renamePage,
    setCycleTime,
    startPage,
    stopPage,
    liveValues,
    driverLiveValues,
    haEntities,
    haLoading,
    haError,
    loadHaEntities,
    saveStatus,
    loadError,
    loadPages,
    nodes,
    connections,
    selectedNodes,
    selectedConnection,
    connectingFrom,
    connectingFromRef,
    clipboard,
    addNode,
    updateNodePosition,
    updateMultipleNodePositions,
    updateNodeData,
    updateNodeOverride,
    deleteNode,
    deleteConnection,
    selectNode,
    selectNodes,
    clearSelection,
    selectConnection,
    copySelection,
    pasteClipboard,
    deleteSelected,
    startConnection,
    endConnection,
    cancelConnection,
    addConnection,
    updateContainerSize,
    updateCaseSize,
    moveNodeToContainer,
    duplicateSelected,
    addTextAnnotation,
    setLiveValue,
    executeAllPages,
    setAllPages
  } = useWiresheetPages();

  const {
    blocks: customBlocks,
    addBlock,
    deleteBlock,
    duplicateBlock,
    importBlocks,
    exportBlock,
    exportAllBlocks
  } = useCustomBlocks();

  const {
    visuPages,
    activeVisuPageId,
    setActiveVisuPageId,
    addVisuPage,
    deleteVisuPage,
    renameVisuPage,
    updateVisuPage,
    setAllVisuPages
  } = useVisualization();

  const {
    alarmClasses,
    alarmConsoles,
    activeAlarms,
    addAlarmClass,
    updateAlarmClass,
    deleteAlarmClass,
    addAlarmConsole,
    updateAlarmConsole,
    deleteAlarmConsole,
    acknowledgeAlarm,
    clearAlarm,
    setAllAlarmClasses,
    setAllAlarmConsoles
  } = useAlarmManagement();

  const [mainView, setMainView] = useState<'logic' | 'visu' | 'drivers' | 'alarms'>('logic');
  const [ghostNode, setGhostNode] = useState<{ label: string; x: number; y: number; template: NodeTemplate } | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState('');
  const [showCycleEditor, setShowCycleEditor] = useState(false);
  const [cycleInput, setCycleInput] = useState(String(activePage.cycleMs));
  const [sidebarTab, setSidebarTab] = useState<'nodes' | 'blocks'>('nodes');
  const [showBlockEditor, setShowBlockEditor] = useState(false);
  const [editingBlock, setEditingBlock] = useState<CustomBlockDefinition | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [modbusDeviceStatus, setModbusDeviceStatus] = useState<Record<string, { online: boolean; lastSeen?: number; pinging?: boolean }>>({});
  const [selectedModbusDatapointPath, setSelectedModbusDatapointPath] = useState<{ deviceId: string; datapointId: string } | null>(null);
  const [driverBindings, setDriverBindings] = useState<DriverBinding[]>([]);
  const [haDriverEnabled, setHaDriverEnabled] = useState(true);
  const [haDevices, setHaDevices] = useState<HaDevice[]>([]);
  const [highlightedBinding, setHighlightedBinding] = useState<DriverBinding | null>(null);
  const [highlightedWidgetId, setHighlightedWidgetId] = useState<string | null>(null);
  const [modbusDevicesState, setModbusDevicesState] = useState<ModbusDevice[]>([]);
  const [modbusDriverEnabledState, setModbusDriverEnabledState] = useState(true);
  const [driverConfigLoaded, setDriverConfigLoaded] = useState(false);
  const isDraggingFromPalette = useRef(false);
  const isDraggingModbusDatapoint = useRef(false);
  const modbusDatapointDragRef = useRef<{ device: ModbusDevice; datapoint: ModbusDevice['datapoints'][0]; isOutput: boolean } | null>(null);
  const ghostNodeRef = useRef<{ label: string; x: number; y: number; template: NodeTemplate } | null>(null);

  const modbusDevices = modbusDevicesState;
  const modbusDriverEnabled = modbusDriverEnabledState;

  const getApiBase = useCallback(() => {
    const path = window.location.pathname;
    const m = path.match(/^(\/api\/hassio_ingress\/[^/]+)/) || path.match(/^(\/app\/[^/]+)/);
    return m ? `${m[1]}/api` : '/api';
  }, []);

  useEffect(() => {
    const loadDriverConfig = async () => {
      try {
        const apiBase = getApiBase();
        const resp = await fetch(`${apiBase}/driver-config`);
        if (resp.ok) {
          const cfg = await resp.json();
          setModbusDevicesState(cfg.modbusDevices || []);
          setModbusDriverEnabledState(cfg.modbusDriverEnabled !== false);
          setDriverBindings(cfg.driverBindings || []);
          setHaDriverEnabled(cfg.haDriverEnabled !== false);
          console.log('Treiber-Konfiguration geladen');
        }
      } catch (err) {
        console.error('Fehler beim Laden der Treiber-Konfiguration:', err);
      }
      setDriverConfigLoaded(true);
    };
    loadDriverConfig();
  }, [getApiBase]);

  const saveDriverConfig = useCallback(async (devices: ModbusDevice[], enabled: boolean, bindings: DriverBinding[], haEnabled: boolean) => {
    if (!driverConfigLoaded) return;
    try {
      const apiBase = getApiBase();
      await fetch(`${apiBase}/driver-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modbusDevices: devices,
          modbusDriverEnabled: enabled,
          driverBindings: bindings,
          haDriverEnabled: haEnabled
        })
      });
    } catch (err) {
      console.error('Fehler beim Speichern der Treiber-Konfiguration:', err);
    }
  }, [getApiBase, driverConfigLoaded]);

  const setModbusDevices = useCallback((devices: ModbusDevice[]) => {
    setModbusDevicesState(devices);
    saveDriverConfig(devices, modbusDriverEnabledState, driverBindings, haDriverEnabled);
  }, [saveDriverConfig, modbusDriverEnabledState, driverBindings, haDriverEnabled]);

  const setModbusDriverEnabled = useCallback((enabled: boolean) => {
    setModbusDriverEnabledState(enabled);
    saveDriverConfig(modbusDevicesState, enabled, driverBindings, haDriverEnabled);
  }, [saveDriverConfig, modbusDevicesState, driverBindings, haDriverEnabled]);

  const updateDriverBindings = useCallback((updater: (prev: DriverBinding[]) => DriverBinding[]) => {
    setDriverBindings(prev => {
      const newBindings = updater(prev);
      saveDriverConfig(modbusDevicesState, modbusDriverEnabledState, newBindings, haDriverEnabled);
      return newBindings;
    });
  }, [saveDriverConfig, modbusDevicesState, modbusDriverEnabledState, haDriverEnabled]);

  const handleNodeDelete = useCallback((nodeId: string) => {
    deleteNode(nodeId);
    updateDriverBindings(prev => prev.filter(b => b.nodeId !== nodeId));
  }, [deleteNode, updateDriverBindings]);

  const bindingStatuses = useMemo((): BindingStatus[] => {
    return driverBindings.map(binding => {
      let isAvailable = true;
      let errorReason: string | undefined;

      if (binding.driverType === 'modbus') {
        const device = modbusDevices.find(d => d.id === binding.deviceId);
        const datapoint = device?.datapoints.find(dp => dp.id === binding.datapointId);

        if (!device) {
          isAvailable = false;
          errorReason = 'Geraet nicht gefunden';
        } else if (!device.enabled) {
          isAvailable = false;
          errorReason = 'Treiber deaktiviert';
        } else if (!modbusDriverEnabled) {
          isAvailable = false;
          errorReason = 'Modbus deaktiviert';
        } else if (!datapoint) {
          isAvailable = false;
          errorReason = 'Datenpunkt nicht gefunden';
        }
      } else if (binding.driverType === 'homeassistant') {
        const device = haDevices.find(d => d.id === binding.deviceId);
        const entity = device?.entities.find(e => e.entity_id === binding.haEntityId);

        if (!haDriverEnabled) {
          isAvailable = false;
          errorReason = 'HA deaktiviert';
        } else if (!device) {
          isAvailable = false;
          errorReason = 'Geraet nicht gefunden';
        } else if (!entity) {
          isAvailable = false;
          errorReason = 'Entity nicht gefunden';
        }
      }

      return { bindingId: binding.id, isAvailable, errorReason };
    });
  }, [driverBindings, modbusDevices, modbusDriverEnabled, haDevices, haDriverEnabled]);

  useEffect(() => {
    setCycleInput(String(activePage.cycleMs));
  }, [activePageId, activePage.cycleMs]);

  useEffect(() => {
    if (mainView !== 'visu') return;
    executeAllPages();
    const pollTimer = setInterval(() => {
      const anyRunning = pages.some(p => p.running);
      if (!anyRunning) executeAllPages();
    }, 2000);
    return () => clearInterval(pollTimer);
  }, [mainView]);

  useEffect(() => {
    console.log('[APP] selectedNodes changed:', selectedNodes.size, Array.from(selectedNodes));
  }, [selectedNodes]);

  useEffect(() => {
    if (haEntities.length === 0) {
      setHaDevices([]);
      return;
    }

    const extractDeviceName = (entity: HaEntity): string => {
      if (entity.attributes.device_name) {
        return entity.attributes.device_name as string;
      }

      const friendlyName = entity.attributes.friendly_name as string;
      if (friendlyName) {
        const parts = friendlyName.split(' ');
        if (parts.length >= 2) {
          return parts[0];
        }
        return friendlyName;
      }

      const entityName = entity.entity_id.split('.')[1] || '';
      const nameParts = entityName.split('_');
      if (nameParts.length >= 2) {
        return nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
      }
      return entityName.charAt(0).toUpperCase() + entityName.slice(1);
    };

    const deviceMap = new Map<string, HaDevice>();
    for (const entity of haEntities) {
      const deviceId = (entity.attributes.device_id as string) || '';
      const derivedDeviceName = extractDeviceName(entity);
      const effectiveDeviceId = deviceId || `derived_${derivedDeviceName.toLowerCase().replace(/\s+/g, '_')}`;

      if (!deviceMap.has(effectiveDeviceId)) {
        deviceMap.set(effectiveDeviceId, {
          id: effectiveDeviceId,
          name: (entity.attributes.device_name as string) || derivedDeviceName,
          manufacturer: entity.attributes.manufacturer as string,
          model: entity.attributes.model as string,
          entities: []
        });
      }
      deviceMap.get(effectiveDeviceId)!.entities.push(entity);
    }

    const devices = Array.from(deviceMap.values());
    devices.sort((a, b) => a.name.localeCompare(b.name));
    setHaDevices(devices);
  }, [haEntities]);

  useEffect(() => {
    if (selectedNodes.size === 1) {
      const selectedId = Array.from(selectedNodes)[0];
      const selectedNode = nodes.find(n => n.id === selectedId);
      if (selectedNode && (selectedNode.type === 'modbus-device-input' || selectedNode.type === 'modbus-device-output')) {
        const deviceId = selectedNode.data.config?.modbusDeviceId;
        const datapointId = selectedNode.data.config?.modbusDatapointId;
        if (deviceId && datapointId) {
          setSelectedModbusDatapointPath({ deviceId, datapointId });
        } else {
          setSelectedModbusDatapointPath(null);
        }
      } else if (selectedNode?.type !== 'modbus-driver') {
        setSelectedModbusDatapointPath(null);
      }
    } else {
      setSelectedModbusDatapointPath(null);
    }
  }, [selectedNodes, nodes]);

  const handleNodePointerDown = useCallback((template: NodeTemplate, clientX: number, clientY: number) => {
    isDraggingFromPalette.current = true;
    const ghost = { label: template.label, x: clientX, y: clientY, template };
    ghostNodeRef.current = ghost;
    setGhostNode(ghost);
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingFromPalette.current) return;
      const updated = { ...ghostNodeRef.current!, x: e.clientX, y: e.clientY };
      ghostNodeRef.current = updated;
      setGhostNode(updated);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDraggingFromPalette.current) return;
      isDraggingFromPalette.current = false;

      const canvas = document.getElementById('flow-canvas');
      if (canvas && ghostNodeRef.current) {
        const rect = canvas.getBoundingClientRect();
        const scrollLeft = canvas.scrollLeft;
        const scrollTop = canvas.scrollTop;
        const currentZoom = parseFloat(canvas.dataset.zoom || '1');
        const isOverCanvas = (
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom
        );

        if (isOverCanvas) {
          const template = ghostNodeRef.current.template;
          let x = (e.clientX - rect.left + scrollLeft) / currentZoom - 90;
          let y = (e.clientY - rect.top + scrollTop) / currentZoom - 30;

          const allDropZones = document.querySelectorAll('[data-case-drop-zone]');
          let dropZone: Element | null = null;

          for (const zone of allDropZones) {
            const zoneRect = zone.getBoundingClientRect();
            if (
              e.clientX >= zoneRect.left && e.clientX <= zoneRect.right &&
              e.clientY >= zoneRect.top && e.clientY <= zoneRect.bottom
            ) {
              dropZone = zone;
              break;
            }
          }

          let parentContainerId: string | undefined;
          let caseIndex: number | undefined;

          if (dropZone) {
            parentContainerId = dropZone.getAttribute('data-case-drop-zone') || undefined;
            const caseIndexAttr = dropZone.getAttribute('data-case-index');
            if (caseIndexAttr !== null) {
              caseIndex = parseInt(caseIndexAttr);
            }
            const containerNode = nodes.find(n => n.id === parentContainerId);
            if (containerNode && containerNode.type === 'case-container') {
              const dropZoneRect = dropZone.getBoundingClientRect();
              x = Math.max(4, e.clientX - dropZoneRect.left - 90);
              y = Math.max(4, e.clientY - dropZoneRect.top - 30);
              console.log('Drop in case container:', { parentContainerId, caseIndex, x, y });
            }
          }

          const newNodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newNode: FlowNode = {
            id: newNodeId,
            type: template.type,
            position: { x: Math.max(0, x), y: Math.max(0, y) },
            data: {
              label: template.label,
              icon: template.icon,
              config: template.defaultConfig ? { ...template.defaultConfig } : undefined,
              inputs: template.inputs.map((input, idx) => ({ ...input, id: `input-${idx}` })),
              outputs: template.outputs.map((output, idx) => ({ ...output, id: `output-${idx}` })),
              parentContainerId,
              caseIndex
            }
          };

          addNode(newNode);
          selectNode(newNode.id);

          if (parentContainerId && caseIndex !== undefined) {
            const containerNode = nodes.find(n => n.id === parentContainerId);
            if (containerNode && containerNode.type === 'case-container') {
              const cases = containerNode.data.config?.cases || [];
              if (cases[caseIndex]) {
                const updatedCases = cases.map((c: { id: string; label: string; nodeIds?: string[] }, idx: number) => {
                  if (idx === caseIndex) {
                    return { ...c, nodeIds: [...(c.nodeIds || []), newNodeId] };
                  }
                  return c;
                });
                updateNodeData(parentContainerId, {
                  config: { ...containerNode.data.config, cases: updatedCases }
                });
              }
            }
          }
        }
      }

      ghostNodeRef.current = null;
      setGhostNode(null);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [addNode, selectNode, nodes, updateNodeData]);

  const handleNodeSelectWithModbusRedirect = useCallback((nodeId: string, addToSelection?: boolean) => {
    selectNode(nodeId, addToSelection);
  }, [selectNode]);

  const selectedNodeData = selectedNodes.size === 1
    ? nodes.find(n => selectedNodes.has(n.id)) || null
    : null;

  const handleApplyCycleTime = () => {
    const ms = parseInt(cycleInput);
    if (!isNaN(ms) && ms >= 20) {
      setCycleTime(activePageId, ms);
      setShowCycleEditor(false);
    }
  };

  const handleStartRenaming = (page: typeof pages[0]) => {
    setEditingPageId(page.id);
    setEditingPageName(page.name);
  };

  const handleCommitRename = () => {
    if (editingPageId && editingPageName.trim()) {
      renamePage(editingPageId, editingPageName.trim());
    }
    setEditingPageId(null);
  };

  const cycleOptions = [20, 50, 100, 250, 500, 1000, 2000, 5000];

  const handleCreateBlockFromSelection = useCallback(() => {
    if (selectedNodes.size < 1) return;
    setEditingBlock(null);
    setShowBlockEditor(true);
  }, [selectedNodes]);

  const handleEditBlock = useCallback((block: CustomBlockDefinition) => {
    setEditingBlock(block);
    setShowBlockEditor(true);
  }, []);

  const handleSaveBlock = useCallback((block: CustomBlockDefinition) => {
    addBlock(block);
    setShowBlockEditor(false);
    setEditingBlock(null);
  }, [addBlock]);

  const handleAddBlockToCanvas = useCallback((block: CustomBlockDefinition) => {
    const now = Date.now();
    const idMap = new Map<string, string>();

    const baseX = 200;
    const baseY = 200;

    const newNodes: FlowNode[] = block.nodes.map(node => {
      const newId = `node-${now}-${Math.random().toString(36).substr(2, 9)}`;
      idMap.set(node.id, newId);
      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + baseX,
          y: node.position.y + baseY
        }
      };
    });

    const newConns: Connection[] = block.connections.map(conn => ({
      ...conn,
      id: `${idMap.get(conn.source)}-${conn.sourcePort}-${idMap.get(conn.target)}-${conn.targetPort}`,
      source: idMap.get(conn.source)!,
      target: idMap.get(conn.target)!
    }));

    newNodes.forEach(n => addNode(n));
    setTimeout(() => {
      newConns.forEach(c => addConnection(c));
      selectNodes(newNodes.map(n => n.id));
    }, 50);
  }, [addNode, addConnection, selectNodes]);

  const selectedNodesList = nodes.filter(n => selectedNodes.has(n.id));
  const selectedConnectionsList = connections.filter(c =>
    selectedNodes.has(c.source) && selectedNodes.has(c.target)
  );

  const handlePlaceModbusDatapoint = useCallback((
    device: ModbusDevice,
    datapoint: ModbusDevice['datapoints'][0],
    isOutput: boolean,
    x: number,
    y: number
  ) => {
    const nodeType = isOutput ? 'modbus-device-output' : 'modbus-device-input';

    const outputs = !isOutput ? [{
      id: 'output-0',
      label: datapoint.name,
      type: 'output' as const
    }] : [];

    const inputs = isOutput ? [{
      id: 'input-0',
      label: datapoint.name,
      type: 'input' as const
    }] : [];

    const newNode: FlowNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: nodeType,
      position: { x, y },
      data: {
        label: `${device.name} - ${datapoint.name}`,
        icon: isOutput ? 'ArrowUpFromLine' : 'ArrowDownToLine',
        config: {
          modbusDeviceId: device.id,
          modbusDeviceName: device.name,
          modbusDatapointId: datapoint.id,
          modbusDatapoints: [datapoint]
        },
        inputs,
        outputs
      }
    };

    addNode(newNode);
    selectNode(newNode.id);
  }, [addNode, selectNode]);

  const handleModbusDatapointDragStart = useCallback((
    device: ModbusDevice,
    datapoint: ModbusDevice['datapoints'][0],
    isOutput: boolean
  ) => {
    isDraggingModbusDatapoint.current = true;
    modbusDatapointDragRef.current = { device, datapoint, isOutput };
  }, []);

  const handleModbusDatapointDrop = useCallback((data: unknown, x: number, y: number) => {
    const dropData = data as { device: ModbusDevice; datapoint: ModbusDevice['datapoints'][0]; isOutput: boolean };
    if (dropData.device && dropData.datapoint) {
      handlePlaceModbusDatapoint(dropData.device, dropData.datapoint, dropData.isOutput, x, y);
    }
  }, [handlePlaceModbusDatapoint]);

  const handleDriverDatapointClick = useCallback((
    device: ModbusDevice,
    datapoint: ModbusDevice['datapoints'][0],
    isOutput: boolean
  ) => {
    if (connectingFrom) {
      const newBinding: DriverBinding = {
        id: `binding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        nodeId: connectingFrom.nodeId,
        portId: connectingFrom.portId,
        driverType: 'modbus',
        deviceId: device.id,
        deviceName: device.name,
        datapointId: datapoint.id,
        datapointName: datapoint.name,
        direction: isOutput ? 'output' : 'input'
      };
      updateDriverBindings(prev => {
        const filtered = prev.filter(b =>
          !(b.nodeId === connectingFrom.nodeId && b.portId === connectingFrom.portId)
        );
        return [...filtered, newBinding];
      });
      cancelConnection();
    }
  }, [connectingFrom, cancelConnection, updateDriverBindings]);

  const handleHaEntityClick = useCallback((
    device: HaDevice,
    entity: HaEntity,
    isOutput: boolean
  ) => {
    if (connectingFrom) {
      const friendlyName = (entity.attributes.friendly_name as string) || entity.entity_id;
      const newBinding: DriverBinding = {
        id: `binding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        nodeId: connectingFrom.nodeId,
        portId: connectingFrom.portId,
        driverType: 'homeassistant',
        deviceId: device.id,
        deviceName: device.name,
        datapointId: entity.entity_id,
        datapointName: friendlyName,
        direction: isOutput ? 'output' : 'input',
        haEntityId: entity.entity_id,
        haDomain: entity.entity_id.split('.')[0]
      };
      updateDriverBindings(prev => {
        const filtered = prev.filter(b =>
          !(b.nodeId === connectingFrom.nodeId && b.portId === connectingFrom.portId)
        );
        return [...filtered, newBinding];
      });
      cancelConnection();
    }
  }, [connectingFrom, cancelConnection, updateDriverBindings]);

  const handleDriverPanelDragStart = useCallback((
    device: ModbusDevice,
    datapoint: ModbusDevice['datapoints'][0],
    isOutput: boolean
  ) => {
    isDraggingModbusDatapoint.current = true;
    modbusDatapointDragRef.current = { device, datapoint, isOutput };
  }, []);

  const handleVisuBindingClick = useCallback((binding: VisuBindingInfo) => {
    setActiveVisuPageId(binding.pageId);
    setMainView('visu');
    setHighlightedWidgetId(binding.widgetId);
    setTimeout(() => setHighlightedWidgetId(null), 3000);
  }, [setActiveVisuPageId]);

  const handlePingModbusDevice = useCallback(async (deviceId: string) => {
    const device = modbusDevices.find(d => d.id === deviceId);
    if (!device) return;

    setModbusDeviceStatus(prev => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], pinging: true }
    }));

    try {
      const response = await fetch('/api/modbus/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: device.host, port: device.port, unitId: device.unitId })
      });
      const data = await response.json();
      setModbusDeviceStatus(prev => ({
        ...prev,
        [deviceId]: {
          online: data.success,
          lastSeen: data.success ? Date.now() : prev[deviceId]?.lastSeen,
          pinging: false
        }
      }));
    } catch {
      setModbusDeviceStatus(prev => ({
        ...prev,
        [deviceId]: { ...prev[deviceId], online: false, pinging: false }
      }));
    }
  }, [modbusDevices]);

  const handleReadConfigValue = useCallback(async (deviceId: string, datapointId: string) => {
    const device = modbusDevices.find(d => d.id === deviceId);
    if (!device) return;
    const datapoint = device.configDatapoints?.find(dp => dp.id === datapointId);
    if (!datapoint) return;

    try {
      const response = await fetch('/api/modbus/read-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: device.host,
          port: device.port,
          unitId: device.unitId,
          address: datapoint.address,
          registerType: datapoint.registerType,
          dataType: datapoint.dataType,
          scale: datapoint.scale || 1
        })
      });
      const data = await response.json();
      if (data.success) {
        setModbusDevicesState(prev => prev.map(d => {
          if (d.id !== deviceId) return d;
          return {
            ...d,
            configDatapoints: d.configDatapoints?.map(dp => {
              if (dp.id !== datapointId) return dp;
              return { ...dp, currentValue: data.value, lastReadAt: Date.now() };
            })
          };
        }));
      }
    } catch (err) {
      console.error('Config read error:', err);
    }
  }, [modbusDevices]);

  const handleWriteConfigValue = useCallback(async (deviceId: string, datapointId: string, value: number | string | boolean) => {
    const device = modbusDevices.find(d => d.id === deviceId);
    if (!device) return;
    const datapoint = device.configDatapoints?.find(dp => dp.id === datapointId);
    if (!datapoint) return;

    try {
      const response = await fetch('/api/modbus/write-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: device.host,
          port: device.port,
          unitId: device.unitId,
          address: datapoint.address,
          value: Number(value),
          registerType: datapoint.registerType,
          dataType: datapoint.dataType,
          scale: datapoint.scale || 1
        })
      });
      const data = await response.json();
      if (data.success) {
        setModbusDevicesState(prev => prev.map(d => {
          if (d.id !== deviceId) return d;
          return {
            ...d,
            configDatapoints: d.configDatapoints?.map(dp => {
              if (dp.id !== datapointId) return dp;
              return { ...dp, currentValue: Number(value), pendingValue: undefined, lastReadAt: Date.now() };
            })
          };
        }));
      }
    } catch (err) {
      console.error('Config write error:', err);
    }
  }, [modbusDevices]);

  const allLogicNodes = pages.flatMap(p => p.nodes);
  const allNodeIdsStr = allLogicNodes.map(n => n.id).sort().join(',');

  useEffect(() => {
    const nodeIdSet = new Set(allNodeIdsStr.split(',').filter(Boolean));
    const orphanedBindings = driverBindings.filter(b => !nodeIdSet.has(b.nodeId));
    if (orphanedBindings.length > 0) {
      console.log(`Entferne ${orphanedBindings.length} verwaiste Bindings`);
      const validBindings = driverBindings.filter(b => nodeIdSet.has(b.nodeId));
      setDriverBindings(validBindings);
    }
  }, [allNodeIdsStr, driverBindings, setDriverBindings]);

  const handleVisuWidgetValueChange = useCallback(async (
    _widgetId: string,
    binding: { nodeId: string; portId?: string; paramKey?: string },
    value: unknown
  ) => {
    console.log('[VISU FRONTEND DEBUG] handleVisuWidgetValueChange aufgerufen');
    console.log('[VISU FRONTEND DEBUG]   widgetId:', _widgetId);
    console.log('[VISU FRONTEND DEBUG]   binding:', JSON.stringify(binding));
    console.log('[VISU FRONTEND DEBUG]   value:', value, 'type:', typeof value);
    if (binding.paramKey) {
      const targetNode = pages.flatMap(p => p.nodes).find(n => n.id === binding.nodeId);
      if (targetNode) {
        updateNodeData(targetNode.id, {
          config: { ...targetNode.data.config, [binding.paramKey]: value }
        });
      }
    }
    try {
      const apiBase = (() => {
        const path = window.location.pathname;
        const m = path.match(/^(\/api\/hassio_ingress\/[^/]+)/) || path.match(/^(\/app\/[^/]+)/);
        return m ? `${m[1]}/api` : '/api';
      })();
      const payload = { nodeId: binding.nodeId, portId: binding.portId, paramKey: binding.paramKey, value };
      console.log('[VISU FRONTEND DEBUG] Sende an Server:', apiBase + '/visu/write-value');
      console.log('[VISU FRONTEND DEBUG] Payload:', JSON.stringify(payload));
      const resp = await fetch(`${apiBase}/visu/write-value`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('[VISU FRONTEND DEBUG] Server Response Status:', resp.status);
      const respData = await resp.json();
      console.log('[VISU FRONTEND DEBUG] Server Response Body:', JSON.stringify(respData));
    } catch (err) {
      console.error('[VISU FRONTEND DEBUG] Failed to write visu value:', err);
    }
  }, [pages, updateNodeData, setLiveValue]);

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Workflow className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">GA-Control</h1>
              <p className="text-xs text-slate-500 leading-tight">keep it simple - by Dr. Muff</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-0.5 flex-shrink-0">
            <button
              onClick={() => setMainView('logic')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mainView === 'logic'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Logik
            </button>
            <button
              onClick={() => setMainView('drivers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mainView === 'drivers'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              Treiber
            </button>
            <button
              onClick={() => { setMainView('visu'); executeAllPages(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mainView === 'visu'
                  ? 'bg-green-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Visu
            </button>
            <button
              onClick={() => setMainView('alarms')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mainView === 'alarms'
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              Alarme
              {activeAlarms.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                  {activeAlarms.length}
                </span>
              )}
            </button>
          </div>

          {mainView === 'logic' && (
            <div className="flex items-center gap-1 flex-1 overflow-x-auto min-w-0 py-0.5">
            {pages.map(page => (
              <div
                key={page.id}
                className="flex items-center gap-1 flex-shrink-0"
              >
                {editingPageId === page.id ? (
                  <input
                    autoFocus
                    value={editingPageName}
                    onChange={(e) => setEditingPageName(e.target.value)}
                    onBlur={handleCommitRename}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCommitRename(); if (e.key === 'Escape') setEditingPageId(null); }}
                    className="bg-slate-600 border border-blue-500 rounded px-2 py-1 text-xs text-white outline-none w-28"
                  />
                ) : (
                  <button
                    onClick={() => setActivePageId(page.id)}
                    onDoubleClick={() => handleStartRenaming(page)}
                    className={`group flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      activePageId === page.id
                        ? 'bg-slate-600 text-white'
                        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        page.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                      }`}
                    />
                    {page.name}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartRenaming(page); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-opacity ml-0.5"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                    {pages.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addPage}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          )}

          {mainView === 'logic' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => setShowCycleEditor(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-xs"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{activePage.cycleMs >= 1000 ? `${activePage.cycleMs / 1000}s` : `${activePage.cycleMs}ms`}</span>
                {showCycleEditor ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showCycleEditor && (
                <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl z-50 w-52">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">Zykluszeit</p>
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {cycleOptions.map(ms => (
                      <button
                        key={ms}
                        onClick={() => { setCycleInput(String(ms)); }}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          cycleInput === String(ms) ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={20}
                      step={10}
                      value={cycleInput}
                      onChange={(e) => setCycleInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyCycleTime()}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-slate-400 self-center">ms</span>
                    <button
                      onClick={handleApplyCycleTime}
                      className="bg-blue-600 hover:bg-blue-500 text-white rounded px-2 py-1 text-xs transition-colors"
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => activePage.running ? stopPage(activePageId) : startPage(activePageId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-medium ${
                activePage.running
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {activePage.running ? (
                <><Square className="w-3.5 h-3.5" /> Stopp</>
              ) : (
                <><Play className="w-3.5 h-3.5" /> Start</>
              )}
            </button>

            <div className="flex items-center gap-1 text-xs">
              {saveStatus === 'saving' && <span className="text-slate-400 flex items-center gap-1"><Save className="w-3 h-3 animate-pulse" /> Speichert...</span>}
              {saveStatus === 'saved' && <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Gespeichert</span>}
              {saveStatus === 'unsaved' && <span className="text-amber-400 flex items-center gap-1"><Save className="w-3 h-3" /> Ungespeichert</span>}
              {saveStatus === 'error' && <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Fehler</span>}
            </div>
          </div>
          )}

          {mainView === 'visu' && (
            <div className="flex-1" />
          )}

          <button
            onClick={() => setShowBackupModal(true)}
            title="Backup & Import"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700 hover:border-slate-600"
          >
            <DatabaseBackup className="w-3.5 h-3.5" />
            Backup
          </button>
        </div>
      </header>

      {loadError && (
        <div className="bg-red-950/80 border-b border-red-800/60 px-4 py-1.5 flex items-center gap-2 flex-shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">{loadError}</span>
          <button onClick={() => { loadPages(); loadHaEntities(); }} className="ml-auto text-xs text-blue-400 hover:text-blue-300 transition-colors">Erneut laden</button>
        </div>
      )}

      {mainView === 'logic' ? (
        <>
          <div className="flex flex-1 overflow-hidden">
            <DriverPanel
              side="left"
              modbusDevices={modbusDevices}
              modbusDeviceStatus={modbusDeviceStatus}
              driverBindings={driverBindings.filter(b => b.direction === 'input')}
              connectingFrom={connectingFrom}
              onDatapointClick={handleDriverDatapointClick}
              onDatapointDragStart={handleDriverPanelDragStart}
              haDevices={haDevices}
              haDriverEnabled={haDriverEnabled}
              modbusDriverEnabled={modbusDriverEnabled}
              onHaEntityClick={handleHaEntityClick}
              highlightedBinding={highlightedBinding}
            />

            <div className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col">
              <div className="flex border-b border-slate-700">
                <button
                  onClick={() => setSidebarTab('nodes')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                    sidebarTab === 'nodes'
                      ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Bausteine
                </button>
                <button
                  onClick={() => setSidebarTab('blocks')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                    sidebarTab === 'blocks'
                      ? 'bg-slate-800 text-white border-b-2 border-cyan-500'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Blocks className="w-3.5 h-3.5" />
                  Eigene
                  {customBlocks.length > 0 && (
                    <span className="bg-cyan-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {customBlocks.length}
                    </span>
                  )}
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {sidebarTab === 'nodes' ? (
                  <NodePalette onNodePointerDown={handleNodePointerDown} />
                ) : (
                  <CustomBlockLibrary
                    blocks={customBlocks}
                    onCreateBlock={handleCreateBlockFromSelection}
                    onEditBlock={handleEditBlock}
                    onDeleteBlock={deleteBlock}
                    onDuplicateBlock={duplicateBlock}
                    onExportBlock={exportBlock}
                    onExportAll={exportAllBlocks}
                    onImportBlocks={importBlocks}
                    onAddBlockToCanvas={handleAddBlockToCanvas}
                    canCreateFromSelection={selectedNodes.size >= 1}
                  />
                )}
              </div>
            </div>

            <FlowCanvas
              nodes={nodes}
              connections={connections}
              selectedNodes={selectedNodes}
              selectedConnection={selectedConnection}
              connectingFrom={connectingFrom}
              connectingFromRef={connectingFromRef}
              clipboard={clipboard}
              onNodePositionChange={updateNodePosition}
              onMultipleNodePositionsChange={updateMultipleNodePositions}
              onNodeSelect={handleNodeSelectWithModbusRedirect}
              onNodesSelect={selectNodes}
              onNodeDelete={handleNodeDelete}
              onConnectionStart={startConnection}
              onConnectionEnd={endConnection}
              onConnectionCancel={cancelConnection}
              onConnectionSelect={selectConnection}
              onConnectionDelete={deleteConnection}
              onClearSelection={clearSelection}
              onCopy={copySelection}
              onPaste={pasteClipboard}
              onDeleteSelected={deleteSelected}
              onContainerResize={updateContainerSize}
              onCaseResize={updateCaseSize}
              onMoveNodeToContainer={(nodeId, containerId, caseIndex) => moveNodeToContainer(nodeId, containerId, caseIndex)}
              onMoveNodeOutOfContainer={(nodeId) => moveNodeToContainer(nodeId, null)}
              onDuplicateSelected={duplicateSelected}
              onAddTextAnnotation={addTextAnnotation}
              zoom={zoom}
              onZoomChange={setZoom}
              ghostNode={ghostNode}
              liveValues={liveValues}
              driverLiveValues={driverLiveValues}
              onOverrideChange={updateNodeOverride}
              onModbusDatapointDrop={handleModbusDatapointDrop}
              visuPages={visuPages}
              onUpdateNodeData={updateNodeData}
              driverBindings={driverBindings}
              bindingStatuses={bindingStatuses}
              onDriverBindingClick={(binding) => {
                setHighlightedBinding(binding);
                setTimeout(() => setHighlightedBinding(null), 3000);
              }}
              onDriverBindingDelete={(binding) => {
                updateDriverBindings(prev => prev.filter(b => b.id !== binding.id));
              }}
              onVisuBindingClick={handleVisuBindingClick}
            />

            <DriverPanel
              side="right"
              modbusDevices={modbusDevices}
              modbusDeviceStatus={modbusDeviceStatus}
              driverBindings={driverBindings.filter(b => b.direction === 'output')}
              connectingFrom={connectingFrom}
              onDatapointClick={handleDriverDatapointClick}
              onDatapointDragStart={handleDriverPanelDragStart}
              haDevices={haDevices}
              haDriverEnabled={haDriverEnabled}
              modbusDriverEnabled={modbusDriverEnabled}
              onHaEntityClick={handleHaEntityClick}
              highlightedBinding={highlightedBinding}
            />

            {selectedNodeData && (
              <PropertiesPanel
                node={selectedNodeData}
                onClose={() => clearSelection()}
                onUpdateNode={updateNodeData}
                haEntities={haEntities}
                haLoading={haLoading}
                haError={haError}
                onReloadEntities={loadHaEntities}
                liveValues={liveValues}
                modbusDevices={modbusDevices}
                modbusDriverEnabled={modbusDriverEnabled}
                onModbusDriverEnabledChange={setModbusDriverEnabled}
                onModbusDevicesChange={setModbusDevices}
                onModbusDatapointDragStart={handleModbusDatapointDragStart}
                onPingModbusDevice={handlePingModbusDevice}
                modbusDeviceStatus={modbusDeviceStatus}
                selectedModbusDatapointPath={selectedModbusDatapointPath}
                allNodes={nodes}
                onReadConfigValue={handleReadConfigValue}
                onWriteConfigValue={handleWriteConfigValue}
                driverBindings={driverBindings}
                haDevices={haDevices}
                haDriverEnabled={haDriverEnabled}
              />
            )}
          </div>

          <div className="bg-slate-800 border-t border-slate-700 px-4 py-1 flex-shrink-0">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {nodes.length} Knoten &middot; {connections.length} Verbindungen
                {selectedNodes.size > 0 && (
                  <span className="ml-2 text-blue-400">
                    {selectedNodes.size} ausgewaehlt
                  </span>
                )}
                {selectedConnection && (
                  <span className="ml-2 text-amber-400">
                    Verbindung ausgewaehlt
                  </span>
                )}
                {activePage.running && (
                  <span className="ml-2 text-emerald-400 font-medium">
                    Laeuft ({activePage.cycleMs >= 1000 ? `${activePage.cycleMs / 1000}s` : `${activePage.cycleMs}ms`} Zyklus)
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${haEntities.length > 0 ? 'bg-emerald-400' : haError ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <span className={haEntities.length > 0 ? 'text-emerald-400' : haError ? 'text-red-400' : 'text-amber-400'}>
                    {haEntities.length > 0 ? `HA: ${haEntities.length}` : haError ? 'HA: Fehler' : 'HA: ...'}
                  </span>
                </span>
                <span>{activePage.name}</span>
              </span>
            </div>
          </div>

          {showBlockEditor && (
            <CustomBlockEditor
              block={editingBlock}
              selectedNodes={selectedNodesList}
              selectedConnections={selectedConnectionsList}
              allNodes={nodes}
              allConnections={connections}
              onSave={handleSaveBlock}
              onCancel={() => { setShowBlockEditor(false); setEditingBlock(null); }}
            />
          )}
        </>
      ) : mainView === 'drivers' ? (
        <DriversView
          modbusDevices={modbusDevices}
          modbusDriverEnabled={modbusDriverEnabled}
          onModbusDevicesChange={setModbusDevices}
          onModbusDriverEnabledChange={setModbusDriverEnabled}
          modbusDeviceStatus={modbusDeviceStatus}
          onPingDevice={handlePingModbusDevice}
          haEntities={haEntities}
          haDevices={haDevices}
          haLoading={haLoading}
          haError={haError}
          haDriverEnabled={haDriverEnabled}
          onHaDriverEnabledChange={setHaDriverEnabled}
          onRefreshHaEntities={loadHaEntities}
          driverLiveValues={driverLiveValues}
        />
      ) : mainView === 'alarms' ? (
        <AlarmManagementView
          alarmClasses={alarmClasses}
          alarmConsoles={alarmConsoles}
          activeAlarms={activeAlarms}
          onAddAlarmClass={addAlarmClass}
          onUpdateAlarmClass={updateAlarmClass}
          onDeleteAlarmClass={deleteAlarmClass}
          onAddAlarmConsole={addAlarmConsole}
          onUpdateAlarmConsole={updateAlarmConsole}
          onDeleteAlarmConsole={deleteAlarmConsole}
          onAcknowledgeAlarm={acknowledgeAlarm}
          onClearAlarm={clearAlarm}
        />
      ) : (
        <VisualizationView
          visuPages={visuPages}
          activeVisuPageId={activeVisuPageId}
          onSetActiveVisuPage={setActiveVisuPageId}
          onAddVisuPage={addVisuPage}
          onDeleteVisuPage={deleteVisuPage}
          onRenameVisuPage={renameVisuPage}
          onUpdateVisuPage={updateVisuPage}
          liveValues={liveValues}
          logicNodes={allLogicNodes}
          onWidgetValueChange={handleVisuWidgetValueChange}
          highlightedWidgetId={highlightedWidgetId}
          alarmClasses={alarmClasses}
          alarmConsoles={alarmConsoles}
          activeAlarms={activeAlarms}
          onAcknowledgeAlarm={acknowledgeAlarm}
          onClearAlarm={clearAlarm}
        />
      )}

      {showBackupModal && (
        <BackupModal
          wiresheets={pages}
          visuPages={visuPages}
          customBlocks={customBlocks}
          modbusDevices={modbusDevices}
          modbusDriverEnabled={modbusDriverEnabled}
          driverBindings={driverBindings}
          onImport={(newWiresheets, newVisuPages, newBlocks, importedDriverConfig) => {
            setAllPages(newWiresheets as WiresheetPage[]);
            setAllVisuPages(newVisuPages as VisuPage[]);
            importBlocks(newBlocks as CustomBlockDefinition[]);
            if (importedDriverConfig) {
              setModbusDevicesState(importedDriverConfig.modbusDevices);
              setModbusDriverEnabledState(importedDriverConfig.modbusDriverEnabled);
              setDriverBindings(importedDriverConfig.driverBindings);
              saveDriverConfig(importedDriverConfig.modbusDevices, importedDriverConfig.modbusDriverEnabled, importedDriverConfig.driverBindings, haDriverEnabled);
            }
          }}
          onClose={() => setShowBackupModal(false)}
        />
      )}
    </div>
  );
}

export default App;
