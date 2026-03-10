import { useState, useCallback } from 'react';
import { FlowNode, Connection } from '../types/flow';

export const useFlowEditor = () => {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; portId: string } | null>(null);

  const addNode = useCallback((node: FlowNode) => {
    setNodes(prev => [...prev, node]);
  }, []);

  const updateNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    setNodes(prev =>
      prev.map(node =>
        node.id === nodeId ? { ...node, position: { x, y } } : node
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
    setConnections(prev => {
      const exists = prev.some(
        conn =>
          conn.source === connection.source &&
          conn.sourcePort === connection.sourcePort &&
          conn.target === connection.target &&
          conn.targetPort === connection.targetPort
      );
      if (exists) return prev;
      return [...prev, connection];
    });
  }, []);

  const deleteConnection = useCallback((connectionId: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
  }, []);

  const updateNodeData = useCallback((nodeId: string, updates: Partial<FlowNode['data']>) => {
    setNodes(prev =>
      prev.map(node =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...updates } } : node
      )
    );
  }, []);

  const startConnection = useCallback((nodeId: string, portId: string) => {
    setConnectingFrom({ nodeId, portId });
  }, []);

  const endConnection = useCallback((targetNodeId: string, targetPortId: string, sourceNodeId: string, sourcePortId: string) => {
    if (sourceNodeId !== targetNodeId) {
      const connection: Connection = {
        id: `${sourceNodeId}-${sourcePortId}-${targetNodeId}-${targetPortId}`,
        source: sourceNodeId,
        sourcePort: sourcePortId,
        target: targetNodeId,
        targetPort: targetPortId
      };
      addConnection(connection);
    }
    setConnectingFrom(null);
  }, [addConnection]);

  const cancelConnection = useCallback(() => {
    setConnectingFrom(null);
  }, []);

  const updateContainerSize = useCallback((nodeId: string, width: number, height: number) => {
    setNodes(prev =>
      prev.map(node =>
        node.id === nodeId ? {
          ...node,
          data: {
            ...node.data,
            config: {
              ...node.data.config,
              containerWidth: width,
              containerHeight: height
            }
          }
        } : node
      )
    );
  }, []);

  return {
    nodes,
    connections,
    selectedNode,
    connectingFrom,
    addNode,
    updateNodePosition,
    updateNodeData,
    deleteNode,
    addConnection,
    deleteConnection,
    startConnection,
    endConnection,
    cancelConnection,
    setSelectedNode,
    updateContainerSize
  };
};
