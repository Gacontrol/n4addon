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
      const withoutExisting = prev.filter(
        conn => !(conn.target === connection.target && conn.targetPort === connection.targetPort)
      );
      return [...withoutExisting, connection];
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
    const connection: Connection = {
      id: `${sourceNodeId}-${sourcePortId}-${targetNodeId}-${targetPortId}`,
      source: sourceNodeId,
      sourcePort: sourcePortId,
      target: targetNodeId,
      targetPort: targetPortId
    };
    addConnection(connection);
    setConnectingFrom(null);
  }, [addConnection]);

  const cancelConnection = useCallback(() => {
    setConnectingFrom(null);
  }, []);

  const insertNodeIntoConnection = useCallback((nodeId: string, connectionId: string) => {
    setNodes(nodesSnap => {
      const node = nodesSnap.find(n => n.id === nodeId);
      if (!node) return nodesSnap;
      const firstInput = node.data.inputs[0];
      const firstOutput = node.data.outputs[0];
      if (!firstInput || !firstOutput) return nodesSnap;
      setConnections(prev => {
        const conn = prev.find(c => c.id === connectionId);
        if (!conn) return prev;
        const newConn1: Connection = {
          id: `${conn.source}-${conn.sourcePort}-${nodeId}-${firstInput.id}`,
          source: conn.source,
          sourcePort: conn.sourcePort,
          target: nodeId,
          targetPort: firstInput.id
        };
        const newConn2: Connection = {
          id: `${nodeId}-${firstOutput.id}-${conn.target}-${conn.targetPort}`,
          source: nodeId,
          sourcePort: firstOutput.id,
          target: conn.target,
          targetPort: conn.targetPort
        };
        return [...prev.filter(x => x.id !== connectionId), newConn1, newConn2];
      });
      return nodesSnap;
    });
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
    updateContainerSize,
    insertNodeIntoConnection
  };
};
