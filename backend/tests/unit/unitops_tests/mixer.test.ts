import { assert, assertAlmostEquals } from "@std/assert"
import { Mixer, massToMolar } from "../../../src/unitops/unitops.ts"
import type { Stream } from "../../../src/types/types.ts"


function makeStream(id: string, massFlow: number, temperature: number, pressure: number, composition: Record<string, number>): Stream {
    const { molarComposition, molarFlow } = massToMolar(composition, massFlow);
    return { id, massFlow, molarFlow, temperature, pressure, composition, molarComposition, phase: "liquid" };
}

const stream1 = makeStream("s1", 10.0, 300, 101325, { water: 0.3, ethanol: 0.7 });
const stream2 = makeStream("s2", 5.0, 400, 101325, { water: 0.6, ethanol: 0.4 });

Deno.test("Mixer: mass balance", () => {
    const result = Mixer.mix([stream1, stream2]);
    assertAlmostEquals(result.massFlow, stream1.massFlow + stream2.massFlow, 1e-6);
});

Deno.test("Mixer: molar balance", () => {
    const result = Mixer.mix([stream1, stream2]);
    assertAlmostEquals(result.molarFlow, stream1.molarFlow + stream2.molarFlow, 1e-6);
});

Deno.test("Mixer: temperature between inlet temperatures", () => {
    const result = Mixer.mix([stream1, stream2]);
    assert(result.temperature >= stream1.temperature && result.temperature <= stream2.temperature);
});

Deno.test("Mixer: composition mass balance", () => {
    const result = Mixer.mix([stream1, stream2]);
    const expectedWater = (stream1.composition.water * stream1.massFlow + stream2.composition.water * stream2.massFlow) / (stream1.massFlow + stream2.massFlow);
    assertAlmostEquals(result.composition.water, expectedWater, 1e-6);
});

Deno.test("Mixer: mole fractions sum to 1", () => {
    const result = Mixer.mix([stream1, stream2]);
    const sum = Object.values(result.molarComposition).reduce((s, v) => s + v, 0);
    assertAlmostEquals(sum, 1, 1e-6);
});

Deno.test("Mixer: pressure is minimum of inlets", () => {
    const result = Mixer.mix([stream1, stream2]);
    assertAlmostEquals(result.pressure, Math.min(stream1.pressure, stream2.pressure), 1e-6);
});

Deno.test("Mixer: single stream returns same flow", () => {
    const result = Mixer.mix([stream1]);
    assertAlmostEquals(result.massFlow, stream1.massFlow, 1e-6);
    assertAlmostEquals(result.molarFlow, stream1.molarFlow, 1e-6);
});