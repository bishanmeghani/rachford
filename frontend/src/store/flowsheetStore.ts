import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react';

export interface FlowsheetState {
  nodes: Node[];
  edges: Edge[];
  components: string[];
  result: string | null;
  loading: boolean;

  setNodes: (update: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (update: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;

  setComponents: (update: string[] | ((components: string[]) => string[])) => void;
  setResult: (result: string | null) => void;
  setLoading: (loading: boolean) => void;

  updateNodeData: (id: string, newData: Record<string, unknown>) => void;

  loadFlowsheet: (data: { nodes?: Node[]; edges?: Edge[]; components?: string[] }) => void;
  reset: () => void;
}

export const useFlowsheetStore = create<FlowsheetState>((set) => ({
  nodes: [],
  edges: [],
  components: ['water', 'ethanol'],
  result: null,
  loading: false,

  setNodes: (update) =>
    set((state) => ({
      nodes: typeof update === 'function' ? update(state.nodes) : update,
    })),
  setEdges: (update) =>
    set((state) => ({
      edges: typeof update === 'function' ? update(state.edges) : update,
    })),
  onNodesChange: (changes) =>
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),
  onEdgesChange: (changes) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  setComponents: (update) =>
    set((state) => ({
      components: typeof update === 'function' ? update(state.components) : update,
    })),
  setResult: (result) => set({ result }),
  setLoading: (loading) => set({ loading }),

  updateNodeData: (id, newData) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...newData } } : n
      ),
    })),

  loadFlowsheet: (data) =>
    set({
      nodes: data.nodes ?? [],
      edges: data.edges ?? [],
      components: data.components ?? ['water', 'ethanol'],
    }),

  reset: () =>
    set({
      nodes: [],
      edges: [],
      components: ['water', 'ethanol'],
      result: null,
    }),
}));