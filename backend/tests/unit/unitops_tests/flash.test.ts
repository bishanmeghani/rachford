import { assert, assertAlmostEquals } from "@std/assert"
import { FlashDrum, massToMolar } from "../../../src/unitops/unitops.ts"
import type { Stream } from "../../../src/types/types.ts"

function makeStream(massFlow: number, temperature: number, pressure: number, composition: Record<string, number>): Stream {
    const { molarComposition, molarFlow } = massToMolar(composition, massFlow);
    return { id: "test-stream", massFlow, molarFlow, temperature, pressure, composition, molarComposition, phase: "liquid" };
}

const partialFlashStream = makeStream(10.0, 380, 183000, { water: 0.3, ethanol: 0.7 });
const allLiquidStream = makeStream(10.0, 360, 101325, { water: 0.5, ethanol: 0.5 });
const aboveBubbleStream = makeStream(10.0, 361.15, 101325, { water: 0.3, ethanol: 0.7 });

Deno.test("FlashDrum: partial flash enriches vapor in ethanol", () => {
    const { vaporStream, liquidStream } = FlashDrum.flashTP(partialFlashStream, 380, 183000);
    assert(vaporStream.molarComposition.ethanol > partialFlashStream.molarComposition.ethanol);
    assert(liquidStream.molarComposition.water > partialFlashStream.molarComposition.water);
});

Deno.test("FlashDrum: partial flash molar balance", () => {
    const { vaporStream, liquidStream } = FlashDrum.flashTP(partialFlashStream, 380, 183000);
    assertAlmostEquals(vaporStream.molarFlow + liquidStream.molarFlow, partialFlashStream.molarFlow, 1e-6);
});

Deno.test("FlashDrum: partial flash mass balance", () => {
    const { vaporStream, liquidStream } = FlashDrum.flashTP(partialFlashStream, 380, 183000);
    assert(vaporStream.composition.ethanol > partialFlashStream.composition.ethanol);
    assertAlmostEquals(vaporStream.massFlow + liquidStream.massFlow, partialFlashStream.massFlow, 1e-6);
});

Deno.test("FlashDrum: below bubble point returns all liquid", () => {
    const { vaporStream, liquidStream, vaporFraction } = FlashDrum.flashTP(allLiquidStream, 360, 101325);
    assertAlmostEquals(vaporFraction, 0, 1e-6);
    assertAlmostEquals(liquidStream.molarFlow, allLiquidStream.molarFlow, 1e-6);
    assertAlmostEquals(vaporStream.molarFlow, 0, 1e-6);
});

Deno.test("FlashDrum: above dew point returns all vapor", () => {
    const { vaporFraction } = FlashDrum.flashTP(partialFlashStream, 450, 101325);
    assertAlmostEquals(vaporFraction, 1, 1e-6);
});

Deno.test("FlashDrum: vapor fraction between 0 and 1 for partial flash", () => {
    const { vaporFraction } = FlashDrum.flashTP(aboveBubbleStream, 361.15, 101325);
    assert(vaporFraction > 0 && vaporFraction < 1);
});

Deno.test("FlashDrum: mole fractions sum to 1 in vapor", () => {
    const { vaporStream } = FlashDrum.flashTP(aboveBubbleStream, 361.15, 101325);
    const sum = Object.values(vaporStream.molarComposition).reduce((s, v) => s + v, 0);
    assertAlmostEquals(sum, 1, 1e-6);
});

Deno.test("FlashDrum: mole fractions sum to 1 in liquid", () => {
    const { liquidStream } = FlashDrum.flashTP(aboveBubbleStream, 361.15, 101325);
    const sum = Object.values(liquidStream.molarComposition).reduce((s, v) => s + v, 0);
    assertAlmostEquals(sum, 1, 1e-6);
});

Deno.test("FlashDrum: flashPQ molar balance", () => {
    const { vaporStream, liquidStream } = FlashDrum.flashPQ(partialFlashStream, 183000, 35555);
    assertAlmostEquals(vaporStream.molarFlow + liquidStream.molarFlow, partialFlashStream.molarFlow, 1e-6);
});