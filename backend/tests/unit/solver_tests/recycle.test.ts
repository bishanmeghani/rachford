import { assert, assertAlmostEquals } from "@std/assert";
import { executeWithRecycle } from "../../../src/solver/recycle.ts";
import { massToMolar } from "../../../src/unitops/unitops.ts";
import type { FlowsheetNode, FlowsheetEdge } from "../../../src/types/types.ts";

function makeFeedNode(id: string, label: string, massFlow: number, temperature: number, pressure: number, composition: Record<string, number>): FlowsheetNode {
    const { molarComposition, molarFlow } = massToMolar(composition, massFlow);
    return { id, nodeType: 'feed', label, data: { label, nodeType: 'feed', massFlow, molarFlow, temperature, pressure, composition, molarComposition } };
}

//Linear flowsheet: Feed → Heater → Flash → 2 Outlet
Deno.test("Linear flowsheet: no recycle detected", () => {
    const nodes: FlowsheetNode[] = [
        makeFeedNode('F1', 'F1', 10, 300, 101325, { water: 0.3, ethanol: 0.7 }),
        { id: 'H1', nodeType: 'heater', label: 'H1', data: { label: 'H1', nodeType: 'heater', targetT: 380 } },
        { id: 'V1', nodeType: 'flash', label: 'V1', data: { label: 'V1', nodeType: 'flash', targetT: 361.15, targetP: 101325 } },
        { id: 'O1', nodeType: 'outlet', label: 'O1', data: { label: 'O1', nodeType: 'outlet' } },
        { id: 'O2', nodeType: 'outlet', label: 'O2', data: { label: 'O2', nodeType: 'outlet' } },
    ];
    const edges: FlowsheetEdge[] = [
        { id: 'S1', source: 'F1', target: 'H1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'S2', source: 'H1', target: 'V1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'S3', source: 'V1', target: 'O1', sourceHandle: 'vapor', targetHandle: 'in' },
        { id: 'S4', source: 'V1', target: 'O2', sourceHandle: 'liquid', targetHandle: 'in' },
    ];
    const { converged, iterations, streams } = executeWithRecycle(nodes, edges, ['water', 'ethanol']);
    assert(converged);
    assert(iterations === 1);
    assert(streams['S3'] !== undefined);
    assert(streams['S4'] !== undefined);
    const feedFlow = streams['S1'].massFlow;
    assertAlmostEquals(streams['S3'].massFlow + streams['S4'].massFlow, feedFlow, 1e-4);
});

// Recycle flowsheet: Feed → Mixer → Heater → Flash → Splitter → Outlet + recycle to Mixer
Deno.test("Recycle flowsheet: converges", () => {
    const nodes: FlowsheetNode[] = [
        makeFeedNode('F1', 'F1', 10, 300, 101325, { water: 0.3, ethanol: 0.7 }),
        { id: 'M1', nodeType: 'mixer', label: 'M1', data: { label: 'M1', nodeType: 'mixer' } },
        { id: 'H1', nodeType: 'heater', label: 'H1', data: { label: 'H1', nodeType: 'heater', targetT: 380 } },
        { id: 'V1', nodeType: 'flash', label: 'V1', data: { label: 'V1', nodeType: 'flash', targetT: 361.15, targetP: 101325 } },
        { id: 'SP1', nodeType: 'splitter', label: 'SP1', data: { label: 'SP1', nodeType: 'splitter', splitFraction: 0.6 } },
        { id: 'O1', nodeType: 'outlet', label: 'O1', data: { label: 'O1', nodeType: 'outlet' } },
        { id: 'O2', nodeType: 'outlet', label: 'O2', data: { label: 'O2', nodeType: 'outlet' } },
    ];
    const edges: FlowsheetEdge[] = [
        { id: 'S1', source: 'F1', target: 'M1', sourceHandle: 'out', targetHandle: 'in-1' },
        { id: 'S2', source: 'M1', target: 'H1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'S3', source: 'H1', target: 'V1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'S4', source: 'V1', target: 'O1', sourceHandle: 'vapor', targetHandle: 'in' },
        { id: 'S5', source: 'V1', target: 'SP1', sourceHandle: 'liquid', targetHandle: 'in' },
        { id: 'S6', source: 'SP1', target: 'M1', sourceHandle: 'out-2', targetHandle: 'in-2' },
        { id: 'S7', source: 'SP1', target: 'O2', sourceHandle: 'out-1', targetHandle: 'in' },
    ];
    const { converged, streams } = executeWithRecycle(nodes, edges, ['water', 'ethanol']);
    console.log('S1 (feed):', streams['S1']?.massFlow);
    console.log('S2 (mixer out):', streams['S2']?.massFlow);
    console.log('S3 (heater out):', streams['S3']?.massFlow);
    console.log('S4 (vapor):', streams['S4']?.massFlow);
    console.log('S5 (liquid):', streams['S5']?.massFlow);
    console.log('S6 (recycle):', streams['S6']?.massFlow);
    console.log('S7 (product):', streams['S7']?.massFlow);
    assert(converged);
    assert(streams['S4'].molarComposition.ethanol > 0.5);
    assertAlmostEquals(
        streams['S5'].massFlow,
        streams['S6'].massFlow + streams['S7'].massFlow,
        1e-3
    );
    assertAlmostEquals(
        streams['S2'].massFlow,
        streams['S1'].massFlow + streams['S6'].massFlow,
        1e-3
    );
});

Deno.test("Recycle flowsheet: vapor enriched in ethanol vs feed", () => {
    const nodes: FlowsheetNode[] = [
        makeFeedNode('F1', 'F1', 10, 300, 101325, { water: 0.3, ethanol: 0.7 }),
        { id: 'M1', nodeType: 'mixer', label: 'M1', data: { label: 'M1', nodeType: 'mixer' } },
        { id: 'H1', nodeType: 'heater', label: 'H1', data: { label: 'H1', nodeType: 'heater', targetT: 380 } },
        { id: 'V1', nodeType: 'flash', label: 'V1', data: { label: 'V1', nodeType: 'flash', targetT: 361.15, targetP: 101325 } },
        { id: 'SP1', nodeType: 'splitter', label: 'SP1', data: { label: 'SP1', nodeType: 'splitter', splitFraction: 0.6 } },
        { id: 'O1', nodeType: 'outlet', label: 'O1', data: { label: 'O1', nodeType: 'outlet' } },
        { id: 'O2', nodeType: 'outlet', label: 'O2', data: { label: 'O2', nodeType: 'outlet' } },
    ];
    const edges: FlowsheetEdge[] = [
        { id: 'S1', source: 'F1', target: 'M1', sourceHandle: 'out', targetHandle: 'in-1' },
        { id: 'S2', source: 'M1', target: 'H1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'S3', source: 'H1', target: 'V1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'S4', source: 'V1', target: 'O1', sourceHandle: 'vapor', targetHandle: 'in' },
        { id: 'S5', source: 'V1', target: 'SP1', sourceHandle: 'liquid', targetHandle: 'in' },
        { id: 'S6', source: 'SP1', target: 'M1', sourceHandle: 'out-2', targetHandle: 'in-2' },
        { id: 'S7', source: 'SP1', target: 'O2', sourceHandle: 'out-1', targetHandle: 'in' },
    ];
    const { streams } = executeWithRecycle(nodes, edges, ['water', 'ethanol']);
    const feedEthanolMoleFrac = streams['S1'].molarComposition.ethanol;
    const vaporEthanolMoleFrac = streams['S4'].molarComposition.ethanol;
    assert(vaporEthanolMoleFrac > feedEthanolMoleFrac);
});

Deno.test("Double recycle flowsheet: converges", () => {
    const nodes: FlowsheetNode[] = [
        makeFeedNode('F1', 'F1', 10, 300, 101325, { water: 0.3, ethanol: 0.7 }),
        { id: 'M1', nodeType: 'mixer', label: 'M1', data: { label: 'M1', nodeType: 'mixer' } },
        { id: 'H1', nodeType: 'heater', label: 'H1', data: { label: 'H1', nodeType: 'heater', targetT: 380 } },
        { id: 'V1', nodeType: 'flash', label: 'V1', data: { label: 'V1', nodeType: 'flash', targetT: 361.15, targetP: 101325 } },
        { id: 'SP1', nodeType: 'splitter', label: 'SP1', data: { label: 'SP1', nodeType: 'splitter', splitFraction: 0.6 } },
        { id: 'V2', nodeType: 'flash', label: 'V2', data: { label: 'V2', nodeType: 'flash', targetT: 363, targetP: 101325 } },
        { id: 'SP2', nodeType: 'splitter', label: 'SP2', data: { label: 'SP2', nodeType: 'splitter', splitFraction: 0.5 } },
        { id: 'H2', nodeType: 'heater', label: 'H2', data: { label: 'H2', nodeType: 'heater', targetT: 368 } },
        { id: 'M2', nodeType: 'mixer', label: 'M2', data: { label: 'M2', nodeType: 'mixer' } },
        { id: 'O1', nodeType: 'outlet', label: 'O1', data: { label: 'O1', nodeType: 'outlet' } },
        { id: 'O2', nodeType: 'outlet', label: 'O2', data: { label: 'O2', nodeType: 'outlet' } },
        { id: 'O3', nodeType: 'outlet', label: 'O3', data: { label: 'O3', nodeType: 'outlet' } },
    ];
    const edges: FlowsheetEdge[] = [
        { id: 'S1',  source: 'F1',  target: 'M1',  sourceHandle: 'out',   targetHandle: 'in-1' },
        { id: 'S2',  source: 'M1',  target: 'H1',  sourceHandle: 'out',   targetHandle: 'in' },
        { id: 'S3',  source: 'H1',  target: 'V1',  sourceHandle: 'out',   targetHandle: 'in' },
        { id: 'S4',  source: 'V1',  target: 'O1',  sourceHandle: 'vapor', targetHandle: 'in' },
        { id: 'S5',  source: 'V1',  target: 'SP1', sourceHandle: 'liquid', targetHandle: 'in' },
        { id: 'S6b', source: 'H2', target: 'V2', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'S6',  source: 'SP1', target: 'H2',  sourceHandle: 'out-1', targetHandle: 'in' },
        { id: 'S7',  source: 'SP1', target: 'M2',  sourceHandle: 'out-2', targetHandle: 'in-1' }, // recycle path 1
        { id: 'S8',  source: 'V2',  target: 'O2',  sourceHandle: 'vapor', targetHandle: 'in' },
        { id: 'S9',  source: 'V2',  target: 'SP2', sourceHandle: 'liquid', targetHandle: 'in' },
        { id: 'S10', source: 'SP2', target: 'O3',  sourceHandle: 'out-1', targetHandle: 'in' },
        { id: 'S11', source: 'SP2', target: 'M2',  sourceHandle: 'out-2', targetHandle: 'in-2' }, // recycle path 2
        { id: 'S12', source: 'M2',  target: 'M1',  sourceHandle: 'out',   targetHandle: 'in-2' }, // combined recycle to M1
    ];

    const { converged, streams } = executeWithRecycle(nodes, edges, ['water', 'ethanol']);
    assert(converged, 'Double recycle should converge');

    // Vapor streams should be ethanol enriched vs feed
    assert(streams['S4'].molarComposition.ethanol > streams['S1'].molarComposition.ethanol);
    // Second flash should produce some vapor
    assert(streams['S8'].molarFlow > 0, 'V2 should produce vapor');
    assert(streams['S8'].molarComposition.ethanol > streams['S1'].molarComposition.ethanol);
    // Splitter balances
    assertAlmostEquals(streams['S5'].massFlow, streams['S6'].massFlow + streams['S7'].massFlow, 1e-3);
    assertAlmostEquals(streams['S9'].massFlow, streams['S10'].massFlow + streams['S11'].massFlow, 1e-3);
    // Mixer M2 balance
    assertAlmostEquals(streams['S12'].massFlow, streams['S7'].massFlow + streams['S11'].massFlow, 1e-2);
});