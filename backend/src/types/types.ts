export type Composition = Record<string, number>; // e.g. { water: 0.6, ethanol: 0.4 }

export interface Stream {
    id: string;
    molarFlow: number; //mol/s
    massFlow: number; //kg/s
    temperature: number; //K
    pressure: number; //Pa
    molarComposition: Composition; //molar fractions
    composition: Composition; // mass fractions
    phase: "liquid" | "vapor" | "two-phase";
}

export interface FlowsheetNode {
    id: string;
    nodeType: string;
    label: string;
    data: Record<string, unknown>;
}

export interface FlowsheetEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle: string | null;
    targetHandle: string | null;
}

export interface Flowsheet {
    nodes: FlowsheetNode[];
    edges: FlowsheetEdge[];
    components: string[];
}

export type NodeResult = Record<string, unknown>;

export type NodeResultMap = Record<string, NodeResult>;