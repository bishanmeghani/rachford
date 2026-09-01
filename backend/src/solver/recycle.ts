import { Stream, FlowsheetNode, FlowsheetEdge, NodeResultMap } from '../types/types.ts';
import { executeFlowsheet } from './topology.ts';

export type StreamMap = Record<string, Stream>;

function findTearStreams(nodes: FlowsheetNode[], edges: FlowsheetEdge[]): Set<string> {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const tearEdges = new Set<string>();

    const adj: Record<string, { nodeId: string, edgeId: string }[]> = {};
    for (const n of nodes) adj[n.id] = [];
    for (const e of edges) adj[e.source]?.push({ nodeId: e.target, edgeId: e.id });

    const dfs = (nodeId: string) => {
        visited.add(nodeId);
        inStack.add(nodeId);
        for (const { nodeId: neighbour, edgeId } of adj[nodeId] ?? []) {
            if (!visited.has(neighbour)) {
                dfs(neighbour);
            } else if (inStack.has(neighbour)) {
                tearEdges.add(edgeId);
            }
        }
        inStack.delete(nodeId);
    };

    for (const n of nodes) if (!visited.has(n.id)) dfs(n.id);

    return tearEdges;
}

function wegstein(prevIn: number, prevOut: number, currIn: number, currOut: number) : number {
    const dIn = currIn - prevIn;
    if (Math.abs(dIn) < 1e-12) return currOut;
    const slope = (currOut - prevOut) / dIn;
    const q = Math.max(-5, Math.min(0, slope / (slope - 1)));
    return (1 - q) * currOut + q * currIn;
}

export function executeWithRecycle(
    nodes: FlowsheetNode[], 
    edges: FlowsheetEdge[], 
    components: string[]
): { streams: StreamMap; log: string[]; converged: boolean; iterations: number; nodeResults: NodeResultMap } {
    const log: string[] = [];
    const tearEdgeIds = findTearStreams(nodes, edges);

    if (tearEdgeIds.size === 0) {
        log.push('No recycle loops detected — running linear solver');
        const { streams, log: linLog, nodeResults } = executeFlowsheet(nodes, edges, components);
        return { streams, log: [...log, ...linLog ], converged: true, iterations: 1, nodeResults}
    }

    log.push(`Deteched ${tearEdgeIds.size} tear stream(s): ${[...tearEdgeIds].join(', ')}`);
    const dagEdges = edges.filter(e => !tearEdgeIds.has(e.id));
    const tearEdges = edges.filter(e => tearEdgeIds.has(e.id));

    const feedNode = nodes.find(n => n.nodeType === 'feed');
    const feedMolarComp = (feedNode?.data?.molarComposition as Record<string, number>) ?? Object.fromEntries(components.map(c => [c, 1 / components.length]));
    const feedMolarFlow = (feedNode?.data?.molarFlow as number) ?? 100;
    const feedT = (feedNode?.data?.temperature as number) ?? 300;
    const feedP = (feedNode?.data?.pressure as number) ?? 101325;

    const tearGuesses: StreamMap = {};
    for (const te of tearEdges) {
        tearGuesses[te.id] = {
            id: te.id,
            molarFlow: feedMolarFlow * 0.5,
            massFlow: 0,
            temperature: feedT,
            pressure: feedP,
            molarComposition: { ...feedMolarComp },
            composition: {},
            phase: 'liquid'
        };
    }
    
    const maxIterations = 100;
    const tolerance = 1e-6;

    const prevInputs: Record<string, { molarFlow: number; comp: Record<string, number> }> = {};
    const prevOutputs: Record<string, { molarFlow: number; comp: Record<string, number> }> = {};

    let allStreams: StreamMap = {};
    let allNodeResults: NodeResultMap = {};
    let converged = false;
    let iter = 0;

    for (iter = 1; iter <= maxIterations; iter++) {
        const { streams, log: iterLog, nodeResults } = executeFlowsheet(nodes, edges, components, { ...tearGuesses }, dagEdges);
        log.push(...iterLog);
        allStreams = streams;
        allNodeResults = nodeResults;

        const tearOutputs: StreamMap = {};
        for (const te of tearEdges) {
            // Find the source node's inlet stream
            const sourceNodeInletEdge = dagEdges.find(e => e.target === te.source);
            const sourceNodeInlet = sourceNodeInletEdge ? streams[sourceNodeInletEdge.id] : undefined;
            
            // Find the DAG outlet edge from same source
            const dagOutlet = dagEdges.find(e => e.source === te.source);
            const dagOutletStream = dagOutlet ? streams[dagOutlet.id] : undefined;
            
            if (dagOutletStream && sourceNodeInlet) {
                // The tear stream has the same composition/T/P but different flow
                // Total flow = dagOutlet + tearStream (they split the inlet)
                const totalFlow = sourceNodeInlet.molarFlow;
                const dagFlow = dagOutletStream.molarFlow;
                const tearFlow = totalFlow - dagFlow;
                tearOutputs[te.id] = {
                    ...dagOutletStream,
                    id: te.id,
                    molarFlow: tearFlow,
                    massFlow: sourceNodeInlet.massFlow - dagOutletStream.massFlow,
                };
            } else {
                tearOutputs[te.id] = tearGuesses[te.id];
            }
        }

        let maxError = 0;
        const newGuesses: StreamMap = {};

        for (const te of tearEdges) {
            const guess = tearGuesses[te.id];
            const output = tearOutputs[te.id];

            if (!output) { newGuesses[te.id] = guess; continue; }

            const flowError = Math.abs(output.molarFlow - guess.molarFlow) / Math.max(1, Math.abs(guess.molarFlow));
            maxError = Math.max(maxError, flowError);

            for (const c of components) {
                const xOut = output.molarComposition[c] ?? 0;
                const xGuess = guess.molarComposition[c] ?? 0;
                maxError = Math.max(maxError, Math.abs(xOut - xGuess));
            }

            let nextFlow: number;
            if (prevInputs[te.id]) {
                nextFlow = wegstein(prevInputs[te.id].molarFlow, prevOutputs[te.id].molarFlow, guess.molarFlow, output.molarFlow);
                if (nextFlow < 0 || nextFlow > feedMolarFlow * 20 || isNaN(nextFlow)) nextFlow = 0.5 * (output.molarFlow + guess.molarFlow);
            } else {
                nextFlow = 0.5 * (output.molarFlow + guess.molarFlow);
            }

            const nextComp : Record<string, number> = {};
            for (const c of components) {
                const xOut = output.molarComposition[c] ?? 0;
                const xGuess = guess.molarComposition[c] ?? 0;
                if (prevInputs[te.id]) {
                    let xNext = wegstein(prevInputs[te.id].comp[c] ?? 0, prevOutputs[te.id].comp[c] ?? 0, xGuess, xOut);
                    if (xNext < 0 || xNext > 1 || isNaN(xNext)) xNext = 0.5 * (xOut + xGuess);
                    nextComp[c] = xNext;
                } else {
                    nextComp[c] = 0.5 * (xOut + xGuess);
                }
            }

            const total = Object.values(nextComp).reduce((s, v) => s + v, 0);
            if (total > 0) for (const c of components) nextComp[c] /= total;

            prevInputs[te.id] = { molarFlow: guess.molarFlow, comp: { ...guess.molarComposition } };
            prevOutputs[te.id] = { molarFlow: output.molarFlow, comp: { ...output.molarComposition } };

            newGuesses[te.id] = {
                ...output,
                id: te.id,
                molarFlow: nextFlow,
                molarComposition: nextComp,
            };
        }

        Object.assign(tearGuesses, newGuesses);
        log.push(`Iteration ${iter}: max error = ${maxError.toExponential(3)}`);

        if (maxError < tolerance) {
            converged = true;
            log.push(`✅ Converged in ${iter} iterations`);
            break;
        }
        
    }

    if (!converged) log.push(`⚠️ Did not converge in ${maxIterations} iterations — returning best estimate`);

    for (const te of tearEdges) {
        if (!allStreams[te.id]) 
            allStreams[te.id] = tearGuesses[te.id];
    }
    
    if (converged) {
        const { streams: finalStreams, nodeResults: finalNodeResults } = executeFlowsheet(nodes, edges, components, { ...tearGuesses }, dagEdges);
        allStreams = finalStreams;
        allNodeResults = finalNodeResults;
        for (const te of tearEdges) {
            if (!allStreams[te.id]) allStreams[te.id] = tearGuesses[te.id];
        }
    }

    return { streams: allStreams, log, converged, iterations: iter, nodeResults: allNodeResults };
}