export interface Position {
  x: number;
  y: number;
}

export interface NodePort {
  id: string;
  label: string;
  type: 'input' | 'output';
  entityId?: string;
}

export interface EnumStage {
  value: number;
  label: string;
}

export interface PythonPort {
  id: string;
  label: string;
}

export interface CaseDefinition {
  id: string;
  label: string;
  nodeIds: string[];
  width?: number;
  height?: number;
}

export interface ModbusDatapoint {
  id: string;
  name: string;
  address: number;
  registerType: 'coil' | 'discrete' | 'holding' | 'input';
  dataType: 'bool' | 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32';
  scale?: number;
  offset?: number;
  unit?: string;
  writable: boolean;
}

export interface ModbusDevice {
  id: string;
  name: string;
  unitId: number;
  datapoints: ModbusDatapoint[];
}

export interface NodeConfig {
  delayMs?: number;
  thresholdValue?: number;
  compareOperator?: '>' | '>=' | '==' | '<=' | '<' | '!=';
  compareValue?: number | string;
  cronExpression?: string;
  triggerState?: string;
  customLabel?: string;
  dpUnit?: string;
  dpFacet?: string;
  dpEnumStages?: EnumStage[];
  pythonCode?: string;
  pythonInputs?: PythonPort[];
  pythonOutputs?: PythonPort[];
  cases?: CaseDefinition[];
  activeCase?: number;
  containerWidth?: number;
  containerHeight?: number;
  inputCount?: number;
  constValue?: number | string | boolean;
  timerMs?: number;
  counterMax?: number;
  counterMin?: number;
  modbusHost?: string;
  modbusPort?: number;
  modbusDevices?: ModbusDevice[];
  modbusPollInterval?: number;
  modbusTimeout?: number;
  [key: string]: unknown;
}

export type DatapointType = 'boolean' | 'numeric' | 'enum';

export interface DatapointOverride {
  manual: boolean;
  value: unknown;
}

export interface FlowNode {
  id: string;
  type: string;
  position: Position;
  data: {
    label: string;
    icon?: string;
    inputs: NodePort[];
    outputs: NodePort[];
    config?: NodeConfig;
    entityId?: string;
    entityLabel?: string;
    liveValue?: unknown;
    liveState?: 'ok' | 'error' | 'idle';
    dpType?: DatapointType;
    override?: DatapointOverride;
    parentContainerId?: string;
    caseIndex?: number;
  };
}

export interface Connection {
  id: string;
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
}

export interface WiresheetPage {
  id: string;
  name: string;
  cycleMs: number;
  running: boolean;
  nodes: FlowNode[];
  connections: Connection[];
}

export interface NodeTemplate {
  type: string;
  label: string;
  icon: string;
  category: 'input' | 'output' | 'logic' | 'trigger' | 'datapoint' | 'custom' | 'driver' | 'math' | 'special';
  color: string;
  inputs: Omit<NodePort, 'id'>[];
  outputs: Omit<NodePort, 'id'>[];
  description: string;
  defaultConfig?: NodeConfig;
  dpType?: DatapointType;
}

export interface CustomBlockPort {
  id: string;
  label: string;
  type: 'input' | 'output';
  mappedNodeId: string;
  mappedPortId: string;
}

export interface CustomBlockDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  inputs: CustomBlockPort[];
  outputs: CustomBlockPort[];
  nodes: FlowNode[];
  connections: Connection[];
  createdAt: number;
  updatedAt: number;
}

export interface CustomBlockInstance extends FlowNode {
  type: 'custom-block';
  data: FlowNode['data'] & {
    blockDefinitionId: string;
    instanceNodes?: FlowNode[];
    instanceConnections?: Connection[];
  };
}
