import { useState, useCallback } from 'react';
import { FlowNode, Connection, Position } from '../types/flow';

export const useFlowEditor = () => {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; portId: string } | null>(null);

  const addNode = useCallback((node: FlowNode) => {
    setNodes(prev => [...prev, node]);
  }, []);

  const updateNodePosition = useCallback((nodeId: string, position: Position) => {
    setNodes(prev =>
      prev.map(node =>
        node.id === nodeId ? { ...node, position } : node
      )
    );
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(node => node.id !== nodeId));
    setConnections(prev =>
      prev.filter(conn => conn.source !== nodeId && conn.target !== nodeId)
    );
    if (selectedNode === nodeId) {
      setSelectedNode(null);
    }
  }, [selectedNode]);

  const addConnection = useCallback((connection: Connection) => {
    const exists = connections.some(
      conn =>
        conn.source === connection.source &&
        conn.sourcePort === connection.sourcePort &&
        conn.target === connection.target &&
        conn.targetPort === connection.targetPort
    );

    if (!exists) {
      setConnections(prev => [...prev, connection]);
    }
  }, [connections]);

  const deleteConnection = useCallback((connectionId: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
  }, []);

  const startConnection = useCallback((nodeId: string, portId: string) => {
    setConnectingFrom({ nodeId, portId });
  }, []);

  const endConnection = useCallback((nodeId: string, portId: string) => {
    if (connectingFrom && connectingFrom.nodeId !== nodeId) {
      const connection: Connection = {
        id: `${connectingFrom.nodeId}-${connectingFrom.portId}-${nodeId}-${portId}`,
        source: connectingFrom.nodeId,
        sourcePort: connectingFrom.portId,
        target: nodeId,
        targetPort: portId
      };
      addConnection(connection);
    }
    setConnectingFrom(null);
  }, [connectingFrom, addConnection]);

  const cancelConnection = useCallback(() => {
    setConnectingFrom(null);
  }, []);

  return {
    nodes,
    connections,
    selectedNode,
    connectingFrom,
    addNode,
    updateNodePosition,
    deleteNode,
    addConnection,
    deleteConnection,
    startConnection,
    endConnection,
    cancelConnection,
    setSelectedNode
  };
};
