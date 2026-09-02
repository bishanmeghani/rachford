import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { UNIT_OPS_DB } from '../data/unitOpsDatabase';
import { UNIT_OP_SYMBOLS } from '../data/unitOpsSymbols';
import { useFlowsheetStore } from '../store/flowsheetStore';
import { fromSI, type UnitSettings } from '../data/unitsDatabase';

const positionMap: Record<string, Position> = {
    top: Position.Top,
    bottom: Position.Bottom,
    left: Position.Left,
    right: Position.Right
};

const STATUS_COLOR: Record<string, string> = {
    converged: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
};

const STATUS_LABEL: Record<string, string> = {
    converged: 'Converged',
    warning: 'Warning',
    error: 'Error',
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <tr>
            <td style={{ color: '#64748b', paddingRight: 12, paddingBottom: 3, whiteSpace: 'nowrap' }}>{label}</td>
            <td style={{ color: '#e2e8f0', textAlign: 'right', paddingBottom: 3 }}>{value}</td>
        </tr>
    );
}

const power = (w: number, u: UnitSettings) => `${fromSI(w, 'energy', u.energy).toFixed(2)} ${u.energy}`;
const pressure = (pa: number, u: UnitSettings) => `${fromSI(pa, 'pressure', u.pressure).toFixed(2)} ${u.pressure}`;
const temp = (k: number, u: UnitSettings) => `${fromSI(k, 'temperature', u.temperature).toFixed(1)} ${u.temperature}`;
const massFlow = (kgps: number, u: UnitSettings) => `${fromSI(kgps, 'massFlow', u.massFlow).toFixed(3)} ${u.massFlow}`;


function ResultRows({ nodeType, r, u }: { nodeType: string; r: Record<string, unknown>; u: UnitSettings }) {
    switch (nodeType) {
        case 'heater':
            return <>
                <Row label="Duty" value={power(r.duty as number, u)} />
                <Row label="Outlet T" value={temp(r.outletT as number, u)} />
                <Row label="ΔT" value={`${(r.deltaT as number).toFixed(1)} K`} />
                {r.vaporFractionChange ? <Row label="Phase change" value="Yes" /> : null}
            </>;
        case 'pump':
            return <>
                <Row label="Power" value={power(r.power as number, u)} />
                <Row label="ΔP" value={pressure(r.deltaP as number, u)} />
                <Row label="Outlet P" value={pressure(r.outletP as number, u)} />
            </>;
        case 'mixer':
            return <>
                <Row label="Combined flow" value={massFlow(r.combinedMassFlow as number, u)} />
                <Row label="Outlet T" value={temp(r.outletT as number, u)} />
                <Row label="Outlet P" value={pressure(r.outletP as number, u)} />
                {r.warning ? <Row label="⚠" value={<span style={{ color: '#f59e0b' }}>{r.warning as string}</span>} /> : null}
            </>;
        case 'splitter': {
            const fractions = r.splitFractions as number[] ?? [];
            return <>
                <Row label="Split fractions" value={fractions.map(f => f.toFixed(2)).join(' / ')} />
                <Row label="Mass balance" value={r.massBalanceOk ? 'OK' : 'Mismatch'} />
            </>;
        }
        case 'flash': {
            const kValues = r.kValues as Record<string, number> ?? {};
            return <>
                <Row label="Vapor fraction (β)" value={(r.vaporFraction as number).toFixed(4)} />
                {Object.entries(kValues).map(([c, k]) => (
                    <Row key={c} label={`K (${c})`} value={k.toFixed(3)} />
                ))}
            </>;
        }
        default:
            return null;
    }
}

export default function UnitOpNode({ id, data }: NodeProps) {
    const nodeType = data.nodeType as string;
    const converged = data.converged as boolean ?? false;
    const renderSymbol = UNIT_OP_SYMBOLS[nodeType];
    const symbol = renderSymbol ? renderSymbol(converged) : (
        <svg width="36" height="36" viewBox="0 0 36 36">
            <rect x="2" y="2" width="32" height="32" fill="none" stroke="#64748b" strokeWidth="1.5"/>
        </svg>
    );
    const def = UNIT_OPS_DB[nodeType];
    const handles = def?.handles ?? [];

    const result = useFlowsheetStore(s => s.result);
    const unitSettings = useFlowsheetStore(s => s.unitSettings);
    const [hovered, setHovered] = useState(false);

    const nodeResult = result ? (() => {
        try {
            const parsed = JSON.parse(result);
            return parsed.nodeResults?.[id] ?? null;
        } catch { return null; }
    })() : null;

    const status = nodeResult?.status as string | undefined;
    const hasTooltipContent = nodeType !== 'feed' && nodeType !== 'outlet';

    return (
        <div
            style={{ background: "transparent", border: "none", padding: 0, textAlign: "center", position: 'relative' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
                {handles.map((h) => {
                const samePosition = handles.filter(x => x.position === h.position);
                const posIndex = samePosition.indexOf(h);
                const total = samePosition.length;

                const offsetStyle: React.CSSProperties = {};
                if (h.position === 'left' || h.position === 'right') {
                    offsetStyle.top = `${((posIndex + 1) / (total + 1)) * 100}%`;
                } else {
                    offsetStyle.left = `${((posIndex + 1) / (total + 1)) * 100}%`;
                }

                return (
                    <Handle
                        key={h.id}
                        id={h.id}
                        type={h.type}
                        position={positionMap[h.position]}
                        style={{
                            background: h.type === 'target' ? '#2563eb' : '#dc2626',
                            width: 8, height: 8,
                            border: '2px solid #0f172a',
                            ...offsetStyle
                        }}
                    />
                );
            })}
            {symbol}
            {status && (
                <div style={{
                    position: 'absolute', top: -3, right: -3,
                    width: 8, height: 8, borderRadius: '50%',
                    background: STATUS_COLOR[status] ?? '#64748b',
                    border: '1.5px solid #0f172a',
                    pointerEvents: 'none',
                }} />
            )}
            {/* Label absolutely positioned below, not affecting node bounds */}
            <div style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                color: "#94a3b8",
                fontSize: 9,
                marginTop: 4,
                fontFamily: "monospace",
                letterSpacing: 0.5,
                whiteSpace: 'nowrap',
                pointerEvents: 'none'
            }}>
                {String(data.label).toUpperCase()}
            </div>
            {hovered && hasTooltipContent && (
                <div style={{
                    position: 'absolute', left: '50%', bottom: 'calc(100% + 10px)',
                    transform: 'translateX(-50%)',
                    background: '#1e293b', border: '1px solid #334155',
                    borderRadius: 6, padding: '8px 12px', fontSize: 11,
                    color: '#e2e8f0', zIndex: 1000, pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.6)', minWidth: 170,
                    textAlign: 'left',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace' }}>{String(data.label)}</span>
                        {status && (
                            <span style={{ color: STATUS_COLOR[status] ?? '#64748b', fontSize: 10, fontWeight: 600 }}>
                                {STATUS_LABEL[status] ?? status}
                            </span>
                        )}
                    </div>
                    {nodeResult ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                            <tbody>
                                <ResultRows nodeType={nodeType} r={nodeResult} u={unitSettings}/>
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ color: '#475569', fontSize: 10 }}>No simulation data yet</div>
                    )}
                </div>
            )}
        </div>
    );
}