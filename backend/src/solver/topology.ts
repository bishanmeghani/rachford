import { Mixer, HeatExchanger, FlashDrum, Splitter, Pump, massToMolar, computeKValues } from "../unitops/unitops.ts";
import type { Stream, FlowsheetNode, FlowsheetEdge, NodeResultMap } from "../types/types.ts";

export type StreamMap = Record<string, Stream>;

function topoSort(nodes: FlowsheetNode[], edges: FlowsheetEdge[]): FlowsheetNode[] {
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};

    for (const n of nodes) {
        inDegree[n.id] = 0;
        adj[n.id] = [];
    }
    for (const e of edges) {
        adj[e.source].push(e.target);
        inDegree[e.target] = (inDegree[e.target] || 0) + 1;
    }

    const queue = nodes.filter(n => inDegree[n.id] === 0);
    const sorted: FlowsheetNode[] = [];

    while (queue.length > 0) {
        const node = queue.shift()!;
        sorted.push(node);
        for (const neighbour of adj[node.id]) {
            inDegree[neighbour]--;
            if (inDegree[neighbour] === 0) queue.push(nodes.find(n => n.id === neighbour)!);
        }
    }
    if (sorted.length !== nodes.length) throw new Error("Cycle detected in flowsheet");
    return sorted;
}

export function executeFlowsheet(
    nodes: FlowsheetNode[], 
    edges: FlowsheetEdge[], 
    _components: string[], 
    injectedStreams: StreamMap = {},
    sortEdges?: FlowsheetEdge[]
): { streams: StreamMap; log: string[]; nodeResults: NodeResultMap } {
    const streams: StreamMap = { ...injectedStreams };
    const sorted = topoSort(nodes, sortEdges ?? edges);
    const log: string[] = [];
    const nodeResults: NodeResultMap = {};

    const getInlets = (nodeId: string) => {
        return edges
        .filter(e => e.target === nodeId)
        .map(e => ({ handle: e.targetHandle, stream: streams[e.id] }))
        .filter(x => x.stream !== undefined);
    };

    const getOutlets = (nodeId: string): FlowsheetEdge[] => {
        return edges.filter(e => e.source === nodeId);
    };

    for (const node of sorted) {
        const inlets = getInlets(node.id);
        const outlets = getOutlets(node.id);
        const data = node.data;
        log.push(`Executing ${node.label} (${node.nodeType})`);
        if (node.nodeType === 'feed') {
            const composition = data.composition as Record<string, number> ?? { water: 0.3, ethanol: 0.7 };
            const massFlow = data.massFlow as number ?? 10;
            const { molarComposition, molarFlow } = massToMolar(composition, massFlow);
            const feedStream: Stream = {
                id: node.id,
                massFlow: data.massFlow as number ?? 10,
                molarFlow,
                temperature: data.temperature as number ?? 300,
                pressure: data.pressure as number ?? 101325,
                composition,
                molarComposition,
                phase: "liquid"
            };
            for (const outlet of outlets) {
                streams[outlet.id] = { ...feedStream, id: outlet.id };
            }
            nodeResults[node.id] = { status: 'converged' };
        }

        else if (node.nodeType === 'pump') {
            if (inlets.length === 0) throw new Error(`Pump ${node.label} has no inlet`);
            const targetP = data.targetP as number ?? 183000;
            const inletP = inlets[0].stream.pressure;
            const { outStream, work } = Pump.pressurised(inlets[0].stream, targetP);
            for (const outlet of outlets) {
                streams[outlet.id] = { ...outStream, id: outlet.id };
            }
            nodeResults[node.id] = {
                status: 'converged',
                power: work, // W
                deltaP: targetP - inletP, // Pa
                outletP: targetP,
            };
            log.push(` Pump: P=${targetP} Pa`);
        }

        else if (node.nodeType === 'mixer') {
            if (inlets.length === 0) throw new Error(`Mixer ${node.label} has no inlet`);
            const inletPressures = inlets.map(i => i.stream.pressure);
            const mixOut = Mixer.mix(inlets.map(i => i.stream));
            for (const outlet of outlets) {
                streams[outlet.id] = { ...mixOut, id: outlet.id };
            }
            const pressuresConsistent = Math.max(...inletPressures) - Math.min(...inletPressures) < 1; // Pa
            nodeResults[node.id] = {
                status: pressuresConsistent ? 'converged' : 'warning',
                warning: pressuresConsistent ? undefined : 'Inlet pressures differ — outlet takes the lowest inlet pressure',
                combinedMolarFlow: mixOut.molarFlow,
                combinedMassFlow: mixOut.massFlow,
                outletT: mixOut.temperature,
                outletP: mixOut.pressure,
            };
            log.push(` Mixer: ${inlets.length} inlets, massFlow = ${mixOut.massFlow.toFixed(3)} kg/s`);
        }

        else if (node.nodeType === 'heater') {
            if (inlets.length === 0) throw new Error(`Heater ${node.label} has no inlet`);
            const targetT = data.targetT as number ?? 380;
            const inletT = inlets[0].stream.temperature;
            const { outStream, duty } = HeatExchanger.fromOutletTemp(inlets[0].stream, targetT);
            for (const outlet of outlets) {
                streams[outlet.id] = { ...outStream, id: outlet.id };
            }
            nodeResults[node.id] = {
                status: 'converged',
                duty, // W
                outletT: targetT,
                deltaT: targetT - inletT,
                vaporFractionChange: outStream.phase !== inlets[0].stream.phase,
            };
            log.push(` Heater: T = ${targetT} K, Q = ${duty.toFixed(0)} W`);
        }

        else if (node.nodeType === 'flash') {
            if (inlets.length === 0) throw new Error(`Flash ${node.label} has no inlet`);
            const targetT = data.targetT as number ?? 380;
            const targetP = data.targetP as number ?? 183000;
            const { vaporStream, liquidStream, vaporFraction } = FlashDrum.flashTP(inlets[0].stream, targetT, targetP);
            log.push(` Flash: ψ = ${vaporFraction.toFixed(4)}`);

            for (const outlet of outlets) {
                if (outlet.sourceHandle === 'vapor' || outlet.sourceHandle === 'top') {
                    streams[outlet.id] = { ...vaporStream, id: outlet.id };
                } else {
                    streams[outlet.id] = { ...liquidStream, id: outlet.id };
                }
            }
            nodeResults[node.id] = {
                status: 'converged',
                vaporFraction,
                kValues: computeKValues(Object.keys(inlets[0].stream.molarComposition), targetT, targetP),
            };
        }

        else if (node.nodeType === 'splitter') {
            if (inlets.length === 0) throw new Error(`Splitter ${node.label} has no inlet`);
            const splitFraction = data.splitFraction as number ?? 0.6;
            const [s1, s2] = Splitter.split(inlets[0].stream, [splitFraction, 1 - splitFraction]);
            const outletSorted = [...outlets].sort((a, b) => (a.id > b.id ? 1 : -1));
            if (outletSorted[0]) streams[outletSorted[0].id] = { ...s1, id: outletSorted[0].id };
            if (outletSorted[1]) streams[outletSorted[1].id] = { ...s2, id: outletSorted[1].id };
            const balanceOk = Math.abs((s1.molarFlow + s2.molarFlow) - inlets[0].stream.molarFlow) < 1e-6;
            nodeResults[node.id] = {
                status: balanceOk ? 'converged' : 'warning',
                splitFractions: [splitFraction, 1 - splitFraction],
                massBalanceOk: balanceOk,
            };
            log.push(` Splitter: fractions [${splitFraction}, ${(1 - splitFraction).toFixed(2)}]`);
        }

        else if (node.nodeType === 'outlet') {
            if (inlets.length > 0) log.push(` Outlet ${node.label}: massFlow = ${inlets[0].stream.massFlow.toFixed(3)} kg/s`);
            nodeResults[node.id] = { status: inlets.length > 0 ? 'converged' : 'error', error: inlets.length > 0 ? undefined : 'Outlet has no inlet stream' };
        }
    }
    
    return { streams, log, nodeResults };
}