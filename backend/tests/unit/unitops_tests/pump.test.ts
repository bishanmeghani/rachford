import {assertAlmostEquals } from "@std/assert"
import { Pump, massToMolar } from "../../../src/unitops/unitops.ts";
import type { Stream } from "../../../src/types/types.ts";

function makeStream(massFlow: number, temperature: number, pressure: number, composition: Record<string, number>): Stream {
    const { molarComposition, molarFlow } = massToMolar(composition, massFlow);
    return { id: "test-stream", massFlow, molarFlow, temperature, pressure, composition, molarComposition, phase: "liquid" };
}

const inletStream = makeStream(10.0, 300, 101325, { water: 0.3, ethanol: 0.7 });

Deno.test("Pump: outlet pressure equals target", () => {
    const { outStream} = Pump.pressurised(inletStream, 300000);
    assertAlmostEquals(outStream.pressure, 300000, 1e-6);
});

Deno.test("Pump: mass flow conserved", () => {
    const { outStream } = Pump.pressurised(inletStream, 300000);
    assertAlmostEquals(outStream.massFlow, inletStream.massFlow, 1e-6);
});

Deno.test("Pump: molar flow conserved", () => {
    const { outStream } = Pump.pressurised(inletStream, 300000);
    assertAlmostEquals(outStream.molarFlow, inletStream.molarFlow, 1e-6);
});

Deno.test("Pump: temperature unchanged", () => {
    const { outStream } = Pump.pressurised(inletStream, 300000);
    assertAlmostEquals(outStream.temperature, inletStream.temperature, 1e-6);
});

Deno.test("Pump: composition unchanged", () => {
    const { outStream } = Pump.pressurised(inletStream, 300000);
    assertAlmostEquals(outStream.molarComposition.water, inletStream.molarComposition.water, 1e-6);
    assertAlmostEquals(outStream.molarComposition.ethanol, inletStream.molarComposition.ethanol, 1e-6);
});