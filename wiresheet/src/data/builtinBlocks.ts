import { CustomBlockDefinition } from '../types/flow';

export const BUILTIN_BLOCK_ID_TIMEPROGRAM = 'builtin-block-time-program-v1';

const TP_NODE_ID = 'builtin-tp-node-1';
const TP_ENABLE_NODE_ID = 'builtin-tp-enable-1';

export const builtinTimeProgramBlock: CustomBlockDefinition = {
  id: BUILTIN_BLOCK_ID_TIMEPROGRAM,
  name: 'Zeitprogramm',
  description: 'Wochenbasiertes Zeitprogramm mit Schaltzeiten und Ausnahmetagen. Konfigurierbar ueber Visu-Popup.',
  icon: 'CalendarRange',
  color: '#0d9488',
  category: 'Zeitsteuerung',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  inputs: [
    {
      id: 'in-enable',
      label: 'Enable',
      type: 'input',
      mappedNodeId: TP_NODE_ID,
      mappedPortId: 'input-0'
    }
  ],
  outputs: [
    {
      id: 'out-value',
      label: 'Ausgang',
      type: 'output',
      mappedNodeId: TP_NODE_ID,
      mappedPortId: 'output-0'
    },
    {
      id: 'out-active',
      label: 'Aktiv',
      type: 'output',
      mappedNodeId: TP_NODE_ID,
      mappedPortId: 'output-1'
    }
  ],
  nodes: [
    {
      id: TP_NODE_ID,
      type: 'time-program',
      position: { x: 0, y: 0 },
      data: {
        label: 'Zeitprogramm',
        icon: 'CalendarRange',
        inputs: [
          { id: 'input-0', label: 'Enable', type: 'input' }
        ],
        outputs: [
          { id: 'output-0', label: 'Ausgang', type: 'output' },
          { id: 'output-1', label: 'Aktiv', type: 'output' }
        ],
        config: {
          timeProgramName: 'Zeitprogramm',
          timeProgramOutputType: 'boolean',
          timeProgramDefaultValue: false,
          timeProgramEntries: [
            {
              id: 'tp-entry-1',
              days: [1, 2, 3, 4, 5],
              startTime: '06:00',
              endTime: '22:00',
              value: true,
              label: 'Wochentage',
              enabled: true,
              priority: 1
            },
            {
              id: 'tp-entry-2',
              days: [0, 6],
              startTime: '08:00',
              endTime: '22:00',
              value: true,
              label: 'Wochenende',
              enabled: true,
              priority: 1
            }
          ],
          timeProgramExceptions: []
        }
      }
    }
  ],
  connections: [],
  visuPageData: {
    id: 'visu-page-timeprogram-builtin',
    name: 'Zeitprogramm',
    backgroundColor: '#0f172a',
    gridSize: 8,
    showGrid: false,
    canvasWidth: 480,
    canvasHeight: 340,
    widgets: [
      {
        id: 'tp-widget-title',
        type: 'visu-label',
        position: { x: 16, y: 16 },
        size: { width: 448, height: 32 },
        label: 'Zeitprogramm',
        config: {
          text: 'Zeitprogramm',
          fontSize: 18,
          fontWeight: 'bold',
          textAlign: 'left'
        },
        style: {
          textColor: '#f1f5f9',
          backgroundColor: 'transparent',
          showLabel: false,
          fontSize: 18
        },
        zIndex: 1
      },
      {
        id: 'tp-widget-status-led',
        type: 'visu-led',
        position: { x: 16, y: 60 },
        size: { width: 200, height: 72 },
        label: 'Aktiv',
        binding: {
          dpKey: `${TP_NODE_ID}:output-1`,
          direction: 'read'
        },
        config: {
          onColor: '#10b981',
          offColor: '#334155',
          onLabel: 'Aktiv',
          offLabel: 'Inaktiv',
          size: 'large'
        },
        style: {
          textColor: '#94a3b8',
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          borderRadius: 12,
          showLabel: true,
          labelPosition: 'right',
          fontSize: 13
        },
        zIndex: 1
      },
      {
        id: 'tp-widget-output',
        type: 'visu-display',
        position: { x: 232, y: 60 },
        size: { width: 232, height: 72 },
        label: 'Ausgang',
        binding: {
          dpKey: `${TP_NODE_ID}:output-0`,
          direction: 'read'
        },
        config: {
          unit: '',
          decimals: 0,
          prefix: '',
          showUnit: false
        },
        style: {
          textColor: '#f1f5f9',
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          borderRadius: 12,
          showLabel: true,
          labelPosition: 'top',
          fontSize: 22,
          accentColor: '#0d9488'
        },
        zIndex: 1
      },
      {
        id: 'tp-widget-divider',
        type: 'visu-label',
        position: { x: 16, y: 148 },
        size: { width: 448, height: 1 },
        label: '',
        config: { text: '' },
        style: {
          backgroundColor: '#1e293b',
          textColor: 'transparent',
          showLabel: false
        },
        zIndex: 1
      },
      {
        id: 'tp-widget-next-title',
        type: 'visu-label',
        position: { x: 16, y: 160 },
        size: { width: 200, height: 20 },
        label: 'Programm',
        config: {
          text: 'Schaltzeiten',
          fontSize: 12
        },
        style: {
          textColor: '#64748b',
          backgroundColor: 'transparent',
          showLabel: false,
          fontSize: 12
        },
        zIndex: 1
      },
      {
        id: 'tp-widget-mon',
        type: 'visu-display',
        position: { x: 16, y: 188 },
        size: { width: 56, height: 40 },
        label: 'Mo',
        binding: {
          dpKey: `${TP_NODE_ID}:output-0`,
          direction: 'read'
        },
        config: { unit: '', decimals: 0, showUnit: false },
        style: {
          textColor: '#94a3b8',
          backgroundColor: '#1e293b',
          borderColor: '#1e293b',
          borderRadius: 8,
          showLabel: true,
          labelPosition: 'bottom',
          fontSize: 10,
          accentColor: '#0d9488'
        },
        zIndex: 1
      },
      {
        id: 'tp-widget-enable-title',
        type: 'visu-label',
        position: { x: 240, y: 160 },
        size: { width: 224, height: 20 },
        label: 'Enable',
        config: {
          text: 'Freigabe',
          fontSize: 12
        },
        style: {
          textColor: '#64748b',
          backgroundColor: 'transparent',
          showLabel: false,
          fontSize: 12
        },
        zIndex: 1
      },
      {
        id: 'tp-widget-enable-switch',
        type: 'visu-switch',
        position: { x: 240, y: 188 },
        size: { width: 224, height: 40 },
        label: 'Freigabe',
        binding: {
          dpKey: `${TP_NODE_ID}:input-0`,
          direction: 'write'
        },
        config: {
          onLabel: 'Freigegeben',
          offLabel: 'Gesperrt',
          onColor: '#0d9488',
          offColor: '#475569',
          defaultValue: true
        },
        style: {
          textColor: '#f1f5f9',
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          borderRadius: 8,
          showLabel: false,
          fontSize: 12,
          accentColor: '#0d9488'
        },
        zIndex: 1
      },
      {
        id: 'tp-widget-info',
        type: 'visu-label',
        position: { x: 16, y: 252 },
        size: { width: 448, height: 72 },
        label: '',
        config: {
          text: 'Konfiguration im Logikprogramm unter Eigenschaften des Zeitprogramm-Bausteins',
          fontSize: 11,
          textAlign: 'center'
        },
        style: {
          textColor: '#475569',
          backgroundColor: '#0f172a',
          borderColor: '#1e293b',
          borderRadius: 10,
          showLabel: false,
          fontSize: 11
        },
        zIndex: 1
      }
    ]
  }
};

export const allBuiltinBlocks: CustomBlockDefinition[] = [
  builtinTimeProgramBlock
];
