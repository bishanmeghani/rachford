import { assert, assertAlmostEquals } from "@std/assert"
import { Splitter, massToMolar } from "../../../src/unitops/unitops.ts"
import type { Stream } from "../../../src/types/types.ts"

function makeStream(massFlow: number, temperature: number, pressure: number, composition: Record<string, number>): Stream {
    const { molarComposition, molarFlow } = massToMolar(composition, massFlow);
    return { id: "test-stream", massFlow, molarFlow, temperature, pressure, composition, molarComposition, phase: "liquid" };
}

const inletStream = makeStream(10.0, 300, 101325, { water: 0.3, ethanol: 0.7 });


Deno.test("Splitter: mass balance", () => {
    const [s1, s2] = Splitter.split(inletStream, [0.6, 0.4]);
    assertAlmostEquals(s1.massFlow + s2.massFlow, inletStream.massFlow, 1e-6);
});

Deno.test("Splitter: molar balance", () => {
    const [s1, s2] = Splitter.split(inletStream, [0.6, 0.4]);
    assertAlmostEquals(s1.molarFlow + s2.molarFlow, inletStream.molarFlow, 1e-6);
});

Deno.test("Splitter: correct split fractions", () => {
    const [s1, s2] = Splitter.split(inletStream, [0.6, 0.4]);
    assertAlmostEquals(s1.massFlow, inletStream.massFlow * 0.6, 1e-6);
    assertAlmostEquals(s2.massFlow, inletStream.massFlow * 0.4, 1e-6);
});

Deno.test("Splitter: composition unchanged", () => {
    const [s1, s2] = Splitter.split(inletStream, [0.6, 0.4]);
    assertAlmostEquals(s1.molarComposition.water, inletStream.molarComposition.water, 1e-6);
    assertAlmostEquals(s2.molarComposition.water, inletStream.molarComposition.water, 1e-6);
});

Deno.test("Splitter: temperature unchanged", () => {
    const [s1, s2] = Splitter.split(inletStream, [0.6, 0.4]);
    assertAlmostEquals(s1.temperature, inletStream.temperature, 1e-6);
    assertAlmostEquals(s2.temperature, inletStream.temperature, 1e-6);
});

Deno.test("Splitter: fractions not summing to 1 throws", () => {
    try {
        Splitter.split(inletStream, [0.6, 0.5]);
        assert(false, "Should have thrown");
    } catch (e) {
        assert(e instanceof Error);
    }
});