import { Stream, Composition } from '../types/types.ts';
import { COMPONENTS_DB } from '../data/componentsDatabase.ts';

export function massToMolar(composition: Composition, massFlow: number) : { molarComposition: Composition; molarFlow: number } {
    const totalMolesPerKg = Object.entries(composition).reduce((s, [id, massFrac]) => {
        const mw = COMPONENTS_DB[id]?.molarMass ?? 0.030;
        return s + massFrac / mw;
    }, 0);

    const molarComposition: Composition = {};
    for (const [id, massFrac] of Object.entries(composition)) {
        const mw = COMPONENTS_DB[id]?.molarMass ?? 0.030;
        molarComposition[id] = (massFrac / mw) / totalMolesPerKg;
    }

    const avgMW = 1 / totalMolesPerKg;
    const molarFlow = massFlow / avgMW;
    return { molarComposition, molarFlow };
}

export function molarToMass(molarComposition: Composition, molarFlow: number) : { composition: Composition; massFlow: number } {
    const totalMassPerMol = Object.entries(molarComposition).reduce((s, [id, moleFrac]) => {
        const mw = COMPONENTS_DB[id]?.molarMass ?? 0.030;
        return s + moleFrac * mw;
    }, 0);

    const composition: Composition = {};
    for (const [id, moleFrac] of Object.entries(molarComposition)) {
        const mw = COMPONENTS_DB[id]?.molarMass ?? 0.030;
        composition[id] = moleFrac * mw / totalMassPerMol;
    }

    const massFlow = molarFlow * totalMassPerMol;
    return {composition, massFlow};
}

function streamsTotalMW(molarComposition: Composition): number {
    let sum = 0;
    for (const [k, v] of Object.entries(molarComposition)) {
        sum += v * (COMPONENTS_DB[k]?.molarMass ?? 0.030);
    }
    return sum;
}

export function getMixtureCp(molarComposition: Composition): number {
    const { composition } = molarToMass(molarComposition, 1);
    let cp = 0;
    for (const [id, massFrac] of Object.entries(composition)) {
        const comp = COMPONENTS_DB[id];
        if (!comp) throw new Error(`Missing Cp for component [${id}]`);
        cp += massFrac * comp.cp;
    }
    return cp;
}

export class Mixer { 
    static mix(streams: Stream[]): Stream {
        if (streams.length === 0) throw new Error("Mixer requires feeds.");
        
        const id = "mixer-out";
        const totalMolarFlow = streams.reduce((s, x) => s + x.molarFlow, 0);
        
        if (totalMolarFlow === 0) { return { id, massFlow: 0, molarFlow: 0, temperature: streams[0].temperature, composition: {}, molarComposition: {},pressure: streams[0].pressure, phase: "liquid" }; }
        
        const totalEnergyFlow = streams.reduce((acc, s) => {
            const { massFlow } = molarToMass(s.molarComposition, s.molarFlow);
            return acc + s.temperature * massFlow * getMixtureCp(s.molarComposition);
        }, 0);

        const totalHeatCapacityFlow = streams.reduce((acc, s) => {
            const { massFlow } = molarToMass(s.molarComposition, s.molarFlow);
            return acc + (massFlow * getMixtureCp(s.molarComposition))
        }, 0);

        const temperature = totalEnergyFlow / totalHeatCapacityFlow;

        const molarComp: Composition = {};
        for (const s of streams) {
            for (const [k, v] of Object.entries(s.molarComposition)) {
                molarComp[k] = (molarComp[k] || 0) + v * s.molarFlow;
            }
        }
        for (const k of Object.keys(molarComp)) { molarComp[k] = molarComp[k] / totalMolarFlow };

        const { composition, massFlow } = molarToMass(molarComp, totalMolarFlow);

        const pressure = Math.min(...streams.map(s => s.pressure));
        return { id, molarFlow: totalMolarFlow, massFlow, temperature, molarComposition: molarComp, composition, pressure, phase: "liquid" };
    }
}

export class Splitter {
    static split(stream: Stream, fractions: number[]): Stream[] {
        const sum = fractions.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1.0) > 1e-6) throw new Error("Split fractions must sum to 1");  
        
        return fractions.map((f, i) => ({
            id: `${stream.id}-split${i + 1}`,
            molarFlow: stream.molarFlow * f,
            massFlow: stream.massFlow * f,
            temperature: stream.temperature,
            molarComposition: { ...stream.molarComposition },
            composition: { ...stream.composition },
            pressure: stream.pressure,
            phase: stream.phase
        }));
    }
}

export class HeatExchanger {
    static fromOutletTemp(stream: Stream, targetT: number): { outStream: Stream; duty: number} {
        const streamCp = getMixtureCp(stream.molarComposition);
        const Q = streamCp * stream.massFlow * (targetT - stream.temperature);
        const outStream: Stream = { ...stream, id: stream.id + "-hx", temperature: targetT };
        return { outStream, duty: Q };
    }
}

export class FlashDrum {
    static flashTP(stream: Stream, targetT: number, targetP: number): { vaporStream: Stream; liquidStream: Stream; vaporFraction: number } {
        const P_mmHg = targetP / 133.322;
        const T_celsius = targetT - 273.15;
        const z = stream.molarComposition;
        const components = Object.keys(z);

        const K: Record<string, number> = {};
        for (const c of components) {
            const comp = COMPONENTS_DB[c];
            if (!comp) throw new Error(`Missing data for ${c}`);
            const logPsat = comp.antoine.A - comp.antoine.B / (T_celsius + comp.antoine.C);
            K[c] = Math.pow(10, logPsat) / P_mmHg;
        }

        // Rachford-Rice function
        const RR = (psi: number) => components.reduce((s, c) => s + z[c] * (K[c] - 1) / (1 + psi * (K[c] - 1)), 0);

        const f0 = RR(0);
        const f1 = RR(1);

        const vaporPhase = "vapor" as const;
        const liquidPhase = "liquid" as const;

        if (f0 <= 0) {
            // All liquid
            const { composition, massFlow } = molarToMass(z, stream.molarFlow);
            return {
                vaporStream: { ...stream, id: `${stream.id}-vapor`, molarFlow: 0, massFlow: 0, temperature: targetT, pressure: targetP, molarComposition: { ...z }, composition, phase: vaporPhase },
                liquidStream: { ...stream, id: `${stream.id}-liquid`, molarFlow: stream.molarFlow, massFlow, temperature: targetT, pressure: targetP, molarComposition: { ...z }, composition, phase: liquidPhase },
                vaporFraction: 0
            };
        }

        if (f1 >= 0) {
            // All vapor
            const { composition, massFlow } = molarToMass(z, stream.molarFlow);
            return {
                vaporStream: { ...stream, id: `${stream.id}-vapor`, molarFlow: stream.molarFlow, massFlow, temperature: targetT, pressure: targetP, molarComposition: { ...z }, composition, phase: vaporPhase },
                liquidStream: { ...stream, id: `${stream.id}-liquid`, molarFlow: 0, massFlow: 0, temperature: targetT, pressure: targetP, molarComposition: { ...z }, composition, phase: liquidPhase },
                vaporFraction: 1
            };
        }

        // Bisection
        let lo = 0, hi = 1, psi = 0.5;
        for (let i = 0; i < 200; i++) {
            psi = (lo + hi) / 2;
            const f = RR(psi);
            if (Math.abs(f) < 1e-10) break;
            if (f > 0) lo = psi;
            else hi = psi;
        }

        // Phase compositions
        const xL: Record<string, number> = {};
        const yV: Record<string, number> = {};
        for (const c of components) {
            xL[c] = z[c] / (1 + psi * (K[c] - 1));
            yV[c] = xL[c] * K[c];
        }

        const vaporMolarFlow = stream.molarFlow * psi;
        const liquidMolarFlow = stream.molarFlow * (1 - psi);

        const { composition: lMass, massFlow: lMassFlow } = molarToMass(xL, liquidMolarFlow);
        const { composition: vMass, massFlow: vMassFlow } = molarToMass(yV, vaporMolarFlow);
        
        return {
            vaporStream: { id: `${stream.id}-vapor`, molarFlow: vaporMolarFlow, massFlow: vMassFlow, temperature: targetT, pressure: targetP, molarComposition: yV, composition: vMass, phase: vaporPhase },
            liquidStream: { id: `${stream.id}-liquid`, molarFlow: liquidMolarFlow, massFlow: lMassFlow, temperature: targetT, pressure: targetP, molarComposition: xL, composition: lMass, phase: liquidPhase },
            vaporFraction: psi
        };
    }

    static flashPQ(stream: Stream, targetP: number, Q: number): { vaporStream: Stream; liquidStream: Stream; vaporFraction: number } {
        let T_lo = 273.15 + 20;
        let T_hi = 273.15 + 200;

        for (let iter = 0; iter < 100; iter++) {
            const T_mid = 0.5 * (T_lo + T_hi);
            const result = FlashDrum.flashTP(stream, T_mid, targetP);
            const Cp = getMixtureCp(stream.molarComposition);
            const Q_actual = Cp * stream.massFlow * (T_mid - stream.temperature);
            if (Math.abs(Q_actual - Q) < 1e-3) return result;
            if (Q_actual < Q) T_lo = T_mid;
            else T_hi = T_mid;
        }
        return FlashDrum.flashTP(stream, 0.5 * (T_lo + T_hi), targetP);
    }
}

export class Pump {
    static pressurised(stream: Stream, targetP: number): { outStream: Stream; work: number } { 
        const outStream: Stream = { ...stream, id: stream.id + "-pump", pressure: targetP };
        return { outStream, work: 0 }
    }
}