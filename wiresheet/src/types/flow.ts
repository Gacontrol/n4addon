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

export interface FlowNode {
  id: string;
  type: string;
  position: Position;
  data: {
    label: string;
    icon?: string;
    inputs: NodePort[];
    outputs: NodePort[];
    config?: Record<string, unknown>;
    entityId?: string;
    entityLabel?: string;
  };
}

export interface Connection {
  id: string;
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
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
}
