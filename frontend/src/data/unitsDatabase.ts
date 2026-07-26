export type UnitDef = {
    label: string;
    factor?: number;
    convert?: (si: number) => number;
    back?: (display: number) => number;
};

export type UnitCategory = 'molarFlow' | 'massFlow' | 'temperature' | 'pressure' | 'energy' | 'time';

export const UNITS: Record<UnitCategory, UnitDef[]> = {
    molarFlow: [
        { label: 'mol/s', factor: 1 },
        { label: 'kmol/s', factor: 1e-3 },
        { label: 'lbmol/s', factor: 1/453.592 },
        { label: 'mol/min', factor: 60 },
        { label: 'kmol/min', factor: 0.060 },
        { label: 'lbmol/min', factor: 60/453.592 },
        { label: 'mol/hr', factor: 3600 },
        { label: 'kmol/hr', factor: 3.6 },
        { label: 'lbmol/hr', factor: 3600/453.592 },
    ],
    massFlow: [
        { label: 'kg/s', factor: 1 },
        { label: 'kg/min', factor: 60 },
        { label: 'kg/hr', factor: 3600 },
        { label: 'lb/s', factor: 2.20462 },
        { label: 'lb/min', factor: 132.277 },
        { label: 'lb/hr', factor: 7936.64 },
        { label: 'ton/s', factor: 1e-3 },
        { label: 'ton/min', factor: 0.06 },
        { label: 'ton/hr', factor: 3.6 },
    ],
    temperature: [
        { label: 'K', convert: K => K, back: v => v },
        { label: '°C', convert: K => K - 273.15, back: v => v + 273.15 },
        { label: '°F', convert: K => (K - 273.15) * 9/5 + 32, back: v => (v - 32) * 5/9 + 273.15 },
        { label: '°R', convert: K => K * 9/5, back: v => v * 5/9 },
    ],
    pressure: [
        { label: 'Pa', factor: 1 },
        { label: 'kPa', factor: 1e-3 },
        { label: 'MPa', factor: 1e-6 },
        { label: 'bar', factor: 1e-5 },
        { label: 'atm', factor: 1/101325 },
        { label: 'psi', factor: 1/6894.76 },
        { label: 'mmHg', factor: 1/133.322 },
    ],
    energy: [
        { label: 'W', factor: 1 },
        { label: 'kW', factor: 1e-3 },
        { label: 'MW', factor: 1e-6 },
        { label: 'BTU/hr', factor: 3.41214 },
        { label: 'kcal/hr', factor: 0.859845 },
    ],
    time: [
        { label: 's', factor: 1 },
        { label: 'min', factor: 1/60 },
        { label: 'hr', factor: 1/3600 },
    ],
};

export type UnitSettings = Record<UnitCategory, string>;

export const DEFAULT_UNITS: UnitSettings = {
    molarFlow: 'mol/s',
    massFlow: 'kg/s',
    temperature: 'K',
    pressure: 'Pa',
    energy: 'W',
    time: 's'
};

export function toSI(value: number, category: UnitCategory, unitLabel: string): number {
    const unit = UNITS[category].find(u => u.label === unitLabel);
    if (!unit) return value;
    if (unit.back) return unit.back(value);
    return unit.factor ? value / unit.factor : value;
}

export function fromSI(value: number, category: UnitCategory, unitLabel: string): number {
    const unit = UNITS[category].find(u => u.label === unitLabel);
    if (!unit) return value;
    if (unit.convert) return unit.convert(value);
    return unit.factor ? value * unit.factor : value;
}

export function fmt(value: number, category: UnitCategory, unitLabel: string, decimals = 3): string {
    return fromSI(value, category, unitLabel).toFixed(decimals);
}