import { assert, assertAlmostEquals } from "@std/assert"
import { HeatExchanger, massToMolar } from "../../../src/unitops/unitops.ts";
import type { Stream } from "../../../src/types/types.ts";

function makeStream(massFlow: number, temperature: number, pressure: number, composition: Record<string, number>): Stream {
    const { molarComposition, molarFlow } = massToMolar(composition, massFlow);
    return { id: "test-stream", massFlow, molarFlow, temperature, pressure, composition, molarComposition, phase: "liquid" };
}

const inletStream = makeStream(10.0, 300, 101325, { water: 0.3, ethanol: 0.7 });

Deno.test("HeatExchanger: outlet temperature equals target", () => {
    const { outStream } = HeatExchanger.fromOutletTemp(inletStream, 380);
    assertAlmostEquals(outStream.temperature, 380, 1e-6);
});
   
Deno.test("HeatExchanger: mass flow conserved", () => {
    const { outStream } = HeatExchanger.fromOutletTemp(inletStream, 380);
    assertAlmostEquals(outStream.massFlow, inletStream.massFlow, 1e-6);
});

Deno.test("HeatExchanger: molar flow conserved", () => {
    const { outStream } = HeatExchanger.fromOutletTemp(inletStream, 380);
    assertAlmostEquals(outStream.molarFlow, inletStream.molarFlow, 1e-6);
});

Deno.test("HeatExchanger: positive duty when heating", () => {
    const { duty } = HeatExchanger.fromOutletTemp(inletStream, 380);
    assert(duty > 0);
});

Deno.test("HeatExchanger: negative duty when cooling", () => {
    const hotStream = makeStream(10.0, 380, 101325, { water: 0.3, ethanol: 0.7 });
    const { duty } = HeatExchanger.fromOutletTemp(hotStream, 300);
    assert(duty < 0);
});

Deno.test("HeatExchanger: composition unchanged", () => {
    const { outStream } = HeatExchanger.fromOutletTemp(inletStream, 380);
    assertAlmostEquals(outStream.molarComposition.water, inletStream.molarComposition.water, 1e-6);
    assertAlmostEquals(outStream.molarComposition.ethanol, inletStream.molarComposition.ethanol, 1e-6);
});

Deno.test("HeatExchanger: pressure unchanged", () => {
    const { outStream } = HeatExchanger.fromOutletTemp(inletStream, 380);
    assertAlmostEquals(outStream.pressure, inletStream.pressure, 1e-6);
});