import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react';
import { DEFAULT_UNITS, type UnitSettings } from '../data/unitsDatabase';

export interface FlowsheetState {
  nodes: Node[];
  edges: Edge[];
  components: string[];
  result: string | null;
  loading: boolean;
  unitSettings: UnitSettings;

  setNodes: (update: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (update: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;

  setComponents: (update: string[] | ((components: string[]) => string[])) => void;
  setResult: (result: string | null) => void;
  setLoading: (loading: boolean) => void;
  setUnitSettings: (update: UnitSettings | ((s: UnitSettings) => UnitSettings)) => void;

  updateNodeData: (id: string, newData: Record<string, unknown>) => void;

  loadFlowsheet: (data: { nodes?: Node[]; edges?: Edge[]; components?: string[] }) => void;
  reset: () => void;
}

const initialUnitSettings: UnitSettings = (() => {
  try { return JSON.parse(localStorage.getItem('rachford_units') ?? 'null') ?? DEFAULT_UNITS; }
  catch { return DEFAULT_UNITS; }
})();

export const useFlowsheetStore = create<FlowsheetState>((set) => ({
  nodes: [],
  edges: [],
  components: ['water', 'ethanol'],
  result: null,
  loading: false,
  unitSettings: initialUnitSettings,

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
  setUnitSettings: (update) =>
    set((state) => {
      const next = typeof update === 'function' ? update(state.unitSettings) : update;
      localStorage.setItem('rachford_units', JSON.stringify(next));
      return { unitSettings: next };
    }),
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