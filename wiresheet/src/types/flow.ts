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

export interface NodeConfig {
  delayMs?: number;
  thresholdValue?: number;
  compareOperator?: '>' | '>=' | '==' | '<=' | '<' | '!=';
  compareValue?: number | string;
  cronExpression?: string;
  triggerState?: string;
  customLabel?: string;
  [key: string]: unknown;
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
  category: 'input' | 'output' | 'logic' | 'trigger';
  color: string;
  inputs: Omit<NodePort, 'id'>[];
  outputs: Omit<NodePort, 'id'>[];
  description: string;
  defaultConfig?: NodeConfig;
}
