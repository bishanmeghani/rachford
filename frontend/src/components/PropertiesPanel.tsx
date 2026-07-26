import { useState } from 'react';
import React from 'react';
import type { Node } from '@xyflow/react'
import { COMPONENTS_DB } from '../data/componentsDatabase';
import { fromSI, toSI, DEFAULT_UNITS, type UnitSettings } from '../data/unitsDatabase';

interface PropertiesPanelProps {
    node: Node;
    components: string[];
    onNodeDataChange: (id: string, data: Record<string, unknown>) => void;
    unitSettings?: UnitSettings;
}

const inputStyle = {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 4,
    color: '#e2e8f0', fontSize: 11, padding: '4px 8px', width: '100%',
    boxSizing: 'border-box' as const
}
const labelStyle = { fontSize: 10, color: '#475569', marginBottom: 2, display: 'block' as const };
const fieldStyle = { marginBottom: 10 };

function BasisToggle({ basis, setBasis }: { basis: 'mass' | 'molar'; setBasis: (b: 'mass' | 'molar') => void }) {
    return (
         <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {(['molar', 'mass'] as const).map(b => (
                <div key={b} onClick={() => setBasis(b)}
                    style={{ flex: 1, padding: '3px 6px', fontSize: 9, fontWeight: 700, textAlign: 'center',
                        cursor: 'pointer', borderRadius: 4, letterSpacing: 0.5,
                        background: basis === b ? '#2563eb' : '#0f172a',
                        color: basis === b ? 'white' : '#475569' }}>
                    {b === 'mass' ? 'MASS' : 'MOLAR'}
                </div>
            ))}
         </div>
    );
}

function FractionInput({ value, readOnly, onChange, inputStyle }: {
    value: number;
    readOnly?: boolean;
    onChange?: (v: number) => void;
    inputStyle: React.CSSProperties;
}) {
    const [local, setLocal] = useState(value.toFixed(4));
    
    // sync if external value changes significantly
    React.useEffect(() => {
        setLocal(value.toFixed(4));
    }, [value]);

    return (
        <input
            style={{ ...inputStyle, color: readOnly ? '#64748b' : '#e2e8f0' }}
            type="number" min="0" max="1" step="0.01"
            value={local}
            readOnly={readOnly}
            onChange={e => setLocal(e.target.value)}
            onBlur={() => {
                const parsed = parseFloat(local);
                if (!isNaN(parsed) && onChange) onChange(parsed);
            }}
        />
    );
}

function NumberInput({ value, readOnly, onChange, inputStyle }: {
    value: number;
    readOnly?: boolean;
    onChange?: (v: number) => void;
    inputStyle: React.CSSProperties;
}) {
    const [local, setLocal] = useState(String(value));

    React.useEffect(() => {
        setLocal(parseFloat(value.toFixed(6)).toString()); 
    }, [value]);

    return (
        <input
            style={{ ...inputStyle, color: readOnly ? '#64748b' : '#e2e8f0' }}
            type="number"
            value={local}
            readOnly={readOnly}
            onChange={e => setLocal(e.target.value)}
            onBlur={() => {
                const parsed = parseFloat(local);
                if (!isNaN(parsed) && onChange) onChange(parsed);
            }}
        />
    );
}

function FeedProperties({ data, components, update, unitSettings }: {
    data: Record<string, unknown>;
    components: string[];
    update: (key: string, value: unknown) => void;
    unitSettings: UnitSettings;
}) {
    const [flowBasis, setFlowBasis] = useState<'mass' | 'molar'>('molar');
    const [compBasis, setCompBasis] = useState<'mass' | 'molar'>('molar');

    const molarComposition = (data.molarComposition as Record<string, number>) ?? {};
    const composition = (data.composition as Record<string, number>) ?? {};
    const molarFlowSI = data.molarFlow as number ?? 100;
    const temperatureSI = data.temperature as number ?? 300;
    const pressureSI = data.pressure as number ?? 101325;

    const avgMW = components.reduce((sum, id) => {
        return sum + (molarComposition[id] ?? 0) * (COMPONENTS_DB[id]?.molarMass ?? 0.030);
    }, 0) || 0.030;

    const massFlowSI = molarFlowSI * avgMW;

    const molarFlowDisplay = fromSI(molarFlowSI, 'molarFlow', unitSettings.molarFlow);
    const massFlowDisplay = fromSI(massFlowSI, 'massFlow', unitSettings.massFlow);
    const temperatureDisplay = fromSI(temperatureSI, 'temperature', unitSettings.temperature);
    const pressureDisplay = fromSI(pressureSI, 'pressure', unitSettings.pressure);

    return <>
        <BasisToggle basis={flowBasis} setBasis={setFlowBasis} />

        <div style={fieldStyle}>
            <label style={labelStyle}>Molar Flow ({unitSettings.molarFlow}){flowBasis === 'mass' ? ' — calculated' : ''}</label>
            <NumberInput
                value={molarFlowDisplay}
                readOnly={flowBasis === 'mass'}
                inputStyle={inputStyle}
                onChange={flowBasis === 'molar' ? (v) => {
                    const si = toSI(v, 'molarFlow', unitSettings.molarFlow);
                    update('molarFlow', si);
                    update('massFlow', si * avgMW);
                } : undefined} />
        </div>

        <div style={fieldStyle}>
            <label style={labelStyle}>Mass Flow ({unitSettings.massFlow}){flowBasis === 'molar' ? ' — calculated' : ''}</label>
            <NumberInput
                value={massFlowDisplay}
                readOnly={flowBasis === 'molar'}
                inputStyle={inputStyle}
                onChange={flowBasis === 'mass' ? (v) => {
                    const si = toSI(v, 'massFlow', unitSettings.massFlow);
                    update('massFlow', si);
                    update('molarFlow', avgMW > 0 ? si / avgMW : 0);
                } : undefined} />
        </div>

        <div style={fieldStyle}>
            <label style={labelStyle}>Temperature (K)</label>
            <NumberInput value={temperatureDisplay} inputStyle={inputStyle} onChange={(v) => update('temperature', toSI(v, 'temperature', unitSettings.temperature))} />
        </div>

        <div style={fieldStyle}>
            <label style={labelStyle}>Pressure (Pa)</label>
            <NumberInput value={pressureDisplay} inputStyle={inputStyle} onChange={(v) => update('pressure', toSI(v, 'pressure', unitSettings.pressure))} />
        </div>

        <BasisToggle basis={compBasis} setBasis={setCompBasis} />

        {compBasis === 'molar' && <>
            <div style={{ color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>MOLE FRACTIONS</div>
            {components.map((id, i) => {
                const isLast = i === components.length - 1;
                const val = isLast
                    ? Math.max(0, 1 - components.slice(0, -1).reduce((s, cid) => s + (molarComposition[cid] ?? 0), 0))
                    : (molarComposition[id] ?? 0);
                return (
                    <div key={id} style={fieldStyle}>
                        <label style={labelStyle}>{COMPONENTS_DB[id]?.name ?? id}{isLast ? ' (calculated)' : ''}</label>
                        <FractionInput
                            value={val}
                            readOnly={isLast}
                            inputStyle={inputStyle}
                            onChange={isLast ? undefined : (v) => {
                                const newMolarComp = { ...molarComposition, [id]: v };
                                const lastId = components[components.length - 1];
                                newMolarComp[lastId] = Math.max(0, 1 - components.slice(0, -1).reduce((s, cid) => s + (newMolarComp[cid] ?? 0), 0));
                                update('molarComposition', newMolarComp);
                                const totalMW = components.reduce((s, cid) => s + (newMolarComp[cid] ?? 0) * (COMPONENTS_DB[cid]?.molarMass ?? 0.030), 0);
                                const massComp: Record<string, number> = {};
                                components.forEach(cid => {
                                    massComp[cid] = totalMW > 0 ? ((newMolarComp[cid] ?? 0) * (COMPONENTS_DB[cid]?.molarMass ?? 0.030)) / totalMW : 0;
                                });
                                update('composition', massComp);
                            }} />
                    </div>
                );
            })}
            <div style={{ color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6, marginTop: 8 }}>MASS FRACTIONS (calculated)</div>
            {components.map(id => {
                const totalMW = components.reduce((s, cid) => s + (molarComposition[cid] ?? 0) * (COMPONENTS_DB[cid]?.molarMass ?? 0.030), 0);
                const massFrac = totalMW > 0 ? ((molarComposition[id] ?? 0) * (COMPONENTS_DB[id]?.molarMass ?? 0.030)) / totalMW : 0;
                return (
                    <div key={id} style={fieldStyle}>
                        <label style={labelStyle}>{COMPONENTS_DB[id]?.name ?? id}</label>
                        <FractionInput value={massFrac} readOnly inputStyle={inputStyle} />
                    </div>
                );
            })}
        </>}

        {compBasis === 'mass' && <>
            <div style={{ color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>MASS FRACTIONS</div>
            {components.map((id, i) => {
                const isLast = i === components.length - 1;
                const val = isLast
                    ? Math.max(0, 1 - components.slice(0, -1).reduce((s, cid) => s + (composition[cid] ?? 0), 0))
                    : (composition[id] ?? 0);
                return (
                    <div key={id} style={fieldStyle}>
                        <label style={labelStyle}>{COMPONENTS_DB[id]?.name ?? id}{isLast ? ' (calculated)' : ''}</label>
                        <FractionInput
                            value={val}
                            readOnly={isLast}
                            inputStyle={inputStyle}
                            onChange={isLast ? undefined : (v) => {
                                const newComp = { ...composition, [id]: v };
                                const lastId = components[components.length - 1];
                                newComp[lastId] = Math.max(0, 1 - components.slice(0, -1).reduce((s, cid) => s + (newComp[cid] ?? 0), 0));
                                update('composition', newComp);
                                const totalMolesPerKg = components.reduce((s, cid) => s + (newComp[cid] ?? 0) / (COMPONENTS_DB[cid]?.molarMass ?? 0.030), 0);
                                const molarComp: Record<string, number> = {};
                                components.forEach(cid => {
                                    molarComp[cid] = totalMolesPerKg > 0 ? ((newComp[cid] ?? 0) / (COMPONENTS_DB[cid]?.molarMass ?? 0.030)) / totalMolesPerKg : 0;
                                });
                                update('molarComposition', molarComp);
                            }} />
                    </div>
                );
            })}
            <div style={{ color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6, marginTop: 8 }}>MOLE FRACTIONS (calculated)</div>
            {components.map(id => {
                const totalMolesPerKg = components.reduce((s, cid) => s + (composition[cid] ?? 0) / (COMPONENTS_DB[cid]?.molarMass ?? 0.030), 0);
                const moleFrac = totalMolesPerKg > 0 ? ((composition[id] ?? 0) / (COMPONENTS_DB[id]?.molarMass ?? 0.030)) / totalMolesPerKg : 0;
                return (
                    <div key={id} style={fieldStyle}>
                        <label style={labelStyle}>{COMPONENTS_DB[id]?.name ?? id}</label>
                        <FractionInput value={moleFrac} readOnly inputStyle={inputStyle} />
                    </div>
                );
            })}
        </>}
    </>;
}

export default function PropertiesPanel({ node, components, onNodeDataChange, unitSettings }: PropertiesPanelProps) {
    const nodeType = node.data.nodeType as string;
    const data = node.data as Record<string, unknown>;
    const us = unitSettings ?? DEFAULT_UNITS

    const update = (key: string, value: unknown) => {
        onNodeDataChange(node.id, { [key]: value });
    };

    return (
        <div style={{ padding: '12px', fontSize: 11 }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12, marginBottom: 12, fontFamily: 'monospace' }}>
                {String(data.label)} - {nodeType.toUpperCase()}
            </div>

            {nodeType === 'feed' && <FeedProperties data={data} components={components} update={update} unitSettings={us}/>}
            
            {nodeType === 'pump' && <>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Target Pressure ({us.pressure})</label>
                    <NumberInput value={fromSI(data.targetP as number ?? 183000, 'pressure', us.pressure)} inputStyle={inputStyle}  
                    onChange={(v) => update('targetP', toSI(v, 'pressure', us.pressure))} />
                </div>
            </>}

            {nodeType === 'heater' && <>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Target Temperature ({us.temperature})</label>
                    <NumberInput value={fromSI(data.targetT as number ?? 380, 'temperature', us.temperature)} inputStyle={inputStyle} 
                    onChange={(v) => update('targetT', toSI(v, 'temperature', us.temperature))} />
                </div>
            </>}

            {nodeType === 'flash' && <>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Temperature ({us.temperature})</label>
                    <NumberInput value={fromSI(data.targetT as number ?? 380, 'temperature', us.temperature)} inputStyle={inputStyle} 
                    onChange={(v) => update('targetT', toSI(v, 'temperature', us.temperature))} />
                </div>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Pressure ({us.pressure})</label>
                    <NumberInput value={fromSI(data.targetP as number ?? 183000, 'pressure', us.pressure)} inputStyle={inputStyle} 
                    onChange={(v) => update('targetP', toSI(v, 'pressure', us.pressure))} />
                </div>
            </>}
            
            {nodeType === 'splitter' && <>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Split Fraction (outlet 1)</label>
                    <FractionInput value={data.splitFraction as number ?? 0.6} inputStyle={inputStyle} onChange={(v) => update('splitFraction', v)} />
                </div>
            </>}
            
            {(nodeType === 'mixer' || nodeType === 'outlet') && (
                <div style={{ color: '#475569', fontSize: 11 }}>No parameters required.</div>
            )}
            
        </div>
    );
}