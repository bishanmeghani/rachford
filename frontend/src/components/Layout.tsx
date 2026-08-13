import React from 'react';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Node } from '@xyflow/react';
import Palette from './Palette';
import Explorer from './Explorer';
import PropertiesPanel from './PropertiesPanel';
import UnitsSettings from './UnitsSettings';
import { DEFAULT_UNITS, fromSI, type UnitSettings } from '../data/unitsDatabase';

interface LayoutProps {
    children: ReactNode;
    onRun?: () => void;
    onNew?: () => void;
    onSave?: () => void;
    onSaveAs?: () => void;
    onLoad?: () => void;
    onFitView?: () => void;
    result?: string | null;
    loading?: boolean;
    components?: string[];
    onComponentsChange?: (c: string[]) => void;
    selectedNode?: Node | null;
    onNodeDataChange?: (id: string, data: Record<string, unknown>) => void;
    unitSettings?: UnitSettings;
    onUnitSettingsChange?: (s: UnitSettings) => void;
}

const COLLAPSE_THRESHOLD = 125;

export default function Layout({ children, onRun, onNew, onSave, onSaveAs, onLoad, onFitView, result, loading, components, onComponentsChange, selectedNode, onNodeDataChange, unitSettings, onUnitSettingsChange }: LayoutProps) {
    const [explorerWidth, setExplorerWidth] = useState(200);
    const [messagesHeight, setMessagesHeight] = useState(150);
    const [rightPanelWidth, setRightPanelWidth] = useState(200);
    const [showUnitsModal, setShowUnitsModal] = useState(false);

    const onExplorerDrag = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = explorerWidth;
        const onMouseMove = (e: MouseEvent) => {
            const newWidth = startWidth + e.clientX - startX 
            setExplorerWidth(newWidth < COLLAPSE_THRESHOLD ? 32 : Math.min(500, newWidth));
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp)
    };

    const onRightPanelDrag = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = rightPanelWidth;

        const onMouseMove = (e: MouseEvent) => {
            const newWidth = startWidth - (e.clientX - startX);
            setRightPanelWidth(newWidth < COLLAPSE_THRESHOLD ? 32 : Math.min(500, newWidth));
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp)
    };

    const onMessagesDrag = (e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = messagesHeight;
        const onMouseMove = (e: MouseEvent) => {
            const newHeight = startHeight - (e.clientY - startY);
            setMessagesHeight(newHeight < 60 ? 32 : Math.min(400, newHeight));
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const explorerCollapsed = explorerWidth <= 32;
    const messagesCollapsed = messagesHeight <= 32;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
            
            {/* Menu Bar */}
            <div style={{ height: 36, background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4, flexShrink: 0 }}>
                <MenuBar onRun={onRun} onNew={onNew} onSave={onSave} onSaveAs={onSaveAs} onLoad={onLoad} onFitView={onFitView} onUnitsSettings={() => setShowUnitsModal(true)}/>
            </div>

            {/* Main area */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                
                {/* Explorer */}
                <div style={{ width: explorerWidth, background: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1, display: 'flex', justifyContent: explorerCollapsed ? 'center' : 'space-between', alignItems: 'center' }}>
                        {!explorerCollapsed && <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1 }}>EXPLORER</span>}
                        <span onClick={() => setExplorerWidth(explorerCollapsed ? 200 : 32)} style={{ cursor: 'pointer', color: '#475569', fontSize: 14 }}>
                            {explorerCollapsed ? '▶' : '◀'}
                        </span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                        {!explorerCollapsed && <Explorer components={components ?? []} onComponentsChange={onComponentsChange ?? (() => {})} />}
                    </div>
                    <div
                        onMouseDown={onExplorerDrag}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'ew-resize', background: 'transparent', zIndex: 10 }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#2563eb')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    />
                </div>

                {/* Canvas */}
                <div style={{ flex: 1, position: 'relative' }}>
                    {children}
                </div>

                {/* Right Panel */}
                <RightPanel width={rightPanelWidth} onDrag={onRightPanelDrag} onCollapse={() => setRightPanelWidth(32)} onExpand={() => setRightPanelWidth(220)} selectedNode={selectedNode} onNodeDataChange={onNodeDataChange} components={components} unitSettings={unitSettings} />

            </div>

            {/* Messages */}
            <div style={{ height: messagesHeight, background: '#1e293b', borderTop: '1px solid #334155', flexShrink: 0, position: 'relative' }}>
                <div onMouseDown={onMessagesDrag}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, cursor: 'ns-resize', background: 'transparent', zIndex: 10 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#2563eb')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} />
                <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #0f172a' }}>
                    {!messagesCollapsed && <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1 }}>MESSAGES</span>}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
                        {!messagesCollapsed && result && <StreamTable result={result} />}
                        <span onClick={() => setMessagesHeight(messagesCollapsed ? 150 : 32)} style={{ cursor: 'pointer', color: '#475569', fontSize: 14 }}>
                            {messagesCollapsed ? '▲' : '▼'}
                        </span>
                    </div>
                </div>
                {!messagesCollapsed && <MessagesContent result={result} loading={loading} unitSettings={unitSettings} />}
            </div>

            {showUnitsModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                    onClick={() => setShowUnitsModal(false)}>
                    <div style={{
                        background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
                        padding: 24, minWidth: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
                    }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Units Settings</span>
                            <span onClick={() => setShowUnitsModal(false)} style={{ cursor: 'pointer', color: '#475569', fontSize: 18 }}>✕</span>
                        </div>
                        <UnitsSettings settings={unitSettings ?? DEFAULT_UNITS} onChange={onUnitSettingsChange ?? (() => {})} />
                    </div>
                </div>
            )}
        </div>
    );
}

function MenuBar({ onRun, onNew, onSave, onSaveAs, onLoad, onFitView, onUnitsSettings }: { onRun?: () => void; onNew?: () => void; onSave?: () => void; onSaveAs?: () => void; onLoad?: () => void; onFitView?: () => void; onUnitsSettings?: () => void;}) {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    
    useEffect(() => {
        const handleClickOutside = () => setActiveMenu(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);        
    }, []);

    const menuItems: Record<string, { label: string; action?: () => void}[]> = {
        File: [
            { label: 'New', action: onNew },
            { label: 'Save', action: onSave },
            { label: 'Save As', action: onSaveAs },
            { label: 'Open', action: onLoad },
            { label: 'Export' },
        ],
        Edit: [
            { label: 'Undo' },
            { label: 'Redo' },
            { label: 'Delete' },
        ],
        Run: [
            { label: 'Run Simulation', action: onRun },
        ],
        View: [
            { label: 'Fit to Screen', action: onFitView },
        ],
        Tools: [
            { label: 'Units Settings', action: onUnitsSettings },
            { label: 'Settings' },
        ],
        Help: [
            { label: 'About' },
        ],
    };

    return (
        <div style={{ display: 'flex', position: 'relative' }}>
            {Object.entries(menuItems).map(([menu, items]) => (
                <div key={menu} style={{ position: 'relative' }}>
                    <div
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === menu ? null : menu); }}
                        style={{ padding: '4px 10px', fontSize: 12, color: '#94a3b8', cursor: 'pointer', borderRadius: 4, background: activeMenu === menu ? '#334155' : 'transparent' }}>
                        {menu}
                    </div>
                    {activeMenu === menu && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                        }}>
                            {items.map(item => (
                                <div key={item.label}
                                    onClick={() => { item.action?.(); setActiveMenu(null); }}
                                    style={{ padding: '6px 12px', fontSize: 12, color: '#e2e8f0', cursor: 'pointer' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#334155')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    {item.label}
                               </div>
                        ))}
                    </div>
                )}
            </div>
        ))}
    </div>
    );
}

function RightPanel({ width, onDrag, onCollapse, onExpand, selectedNode, onNodeDataChange, components, unitSettings }: { width: number; onDrag: (e: React.MouseEvent) => void; onCollapse: () => void; onExpand: () => void; selectedNode?: Node | null; onNodeDataChange?: (id: string, data: Record<string, unknown>) => void; components?: string[]; unitSettings?: UnitSettings}) {
    const [activeTab, setActiveTab] = useState<'unitops' | 'properties'>('unitops');
    const collapsed = width <= 32;

    useEffect(() => {
        if (selectedNode) setActiveTab('properties');
    }, [selectedNode]);

    return (
        <div style={{ width, background: '#1e293b', borderLeft: '1px solid #334155', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <div onMouseDown={onDrag}
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, cursor: 'ew-resize', background: 'transparent', zIndex: 10 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#2563eb')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')} />
            {/*Tabs*/}
            <div style={{ display: 'flex', borderBottom: '1px solid #334155', alignItems: 'center' }}>
                {!collapsed && (['unitops', 'properties'] as const).map(tab => (
                    <div key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1, padding: '6px 8px', fontSize: 10, fontWeight: 700,
                            color: activeTab === tab ? '#e2e8f0' : '#475569',
                            background: activeTab === tab ? '#0f172a' : 'transparent',
                            cursor: 'pointer', textAlign: 'center', letterSpacing: 0.5
                        }}>
                        {tab === 'unitops' ? 'UNIT OPS' : 'PROPERTIES'}
                    </div>
                ))}
                <span onClick={() => collapsed ? onExpand() : onCollapse()} 
                    style={{ cursor: 'pointer', color: '#475569', fontSize: 12, padding: '6px 8px', marginLeft: 'auto' }}>
                    {collapsed ? '◀' : '▶'}
                </span>
            </div>
            {/* Content */}
            {!collapsed && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {activeTab === 'unitops' && <Palette embedded />}
                    {activeTab === 'properties' && (
                        selectedNode ? <PropertiesPanel node={selectedNode} components={components ?? []} onNodeDataChange={onNodeDataChange ?? (() => {})} unitSettings={unitSettings} /> :
                        <div style={{ padding: '8px 12px', fontSize: 11, color: '#475569' }}>Select a unit to view properties.</div>
                    )}
                </div>
            )}
        </div>
    );
}

function MessagesContent({ result, loading, unitSettings }: { result?: string | null; loading?: boolean; unitSettings?: UnitSettings; }) {
    if (loading) return <div style={{ padding: '8px 12px', fontSize: 11, color: '#94a3b8' }}>Running simulation...</div>;
    if (!result) return <div style={{ padding: '8px 12px', fontSize: 11, color: '#475569' }}>No results yet — run a simulation.</div>;
    let parsed: any = null;
    try { parsed = JSON.parse(result) } catch { return <pre style={{ padding: '8px 12px', fontSize: 10, color: '#94a3b8', margin: 0, whiteSpace: 'pre-wrap', overflowY: 'auto' }}>{result}</pre>; }
    if (parsed.status === 'Failed') {
        return <div style={{ padding: '8px 12px', fontSize: 11, color: '#ef4444' }}>Error: {parsed.error}</div>
    }
    const streams = parsed.streams ?? {};
    const streamIds = Object.keys(streams).sort((a, b) => {
        const numA = parseInt(a.replace('S', ''));
        const numB = parseInt(b.replace('S', ''));
        return numA - numB;
    });
    if (streamIds.length === 0) return <div style={{ padding: '8px 12px', fontSize: 11, color: '#475569'  }}>No streams in result.</div>;
    const firstStream = streams[streamIds[0]];
    const componentNames = Object.keys(firstStream?.composition ?? {});
    const headerStyle: React.CSSProperties = { padding: '4px 10px', fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #334155' };
    const cellStyle: React.CSSProperties = { padding: '4px 10px', fontSize: 11, color: '#e2e8f0', whiteSpace: 'nowrap', borderBottom: '1px solid #1e293b' };
    const dimCellStyle: React.CSSProperties = { ...cellStyle, color: '#64748b' };

    return (
        <div style={{ overflowX: 'auto', overflowY: 'auto', height: 'calc(100% - 32px)' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
                <thead>
                    <tr style={{ background: '#0f172a' }}>
                        <th style={headerStyle}></th>
                        <th style={{ ...headerStyle, textAlign: 'right' }}>Molar Flow ({unitSettings?.molarFlow ?? 'mol/s'})</th>
                        <th style={{ ...headerStyle, textAlign: 'right' }}>Mass Flow ({unitSettings?.massFlow ?? 'kg/s'})</th>
                        <th style={{ ...headerStyle, textAlign: 'right' }}>T ({unitSettings?.temperature ?? 'K'})</th>
                        <th style={{ ...headerStyle, textAlign: 'right' }}>P ({unitSettings?.pressure ?? 'Pa'})</th>
                        <th style={{ ...headerStyle, textAlign: 'center' }}>Phase</th>
                        {componentNames.map(c => (
                            <th key={`mol-${c}`} style={{ ...headerStyle, textAlign: 'right' }}>{c} (mol)</th>
                        ))}
                        {componentNames.map(c => (
                            <th key={`mass-${c}`} style={{ ...headerStyle, textAlign: 'right' }}>{c} (mass)</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {streamIds.map((id, i) => {
                        const s = streams[id];
                        const rowBg = i % 2 === 0 ? 'transparent' : '#0f172a22';
                        return (
                            <tr key={id} style={{ background: rowBg }}>
                                <td style={{ ...dimCellStyle, fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa' }}>{id}</td>
                                <td style={{ ...cellStyle, textAlign: 'right' }}>{unitSettings? fromSI(s.molarFlow, 'molarFlow', unitSettings.molarFlow).toFixed(3) : s.molarFlow?.toFixed(3)}</td>
                                <td style={{ ...cellStyle, textAlign: 'right' }}>{unitSettings? fromSI(s.massFlow, 'massFlow', unitSettings.massFlow).toFixed(3) : s.massFlow?.toFixed(3)}</td>
                                <td style={{ ...cellStyle, textAlign: 'right' }}>{unitSettings? fromSI(s.temperature, 'temperature', unitSettings.temperature).toFixed(1) : s.temperature?.toFixed(1)}</td>
                                <td style={{ ...cellStyle, textAlign: 'right' }}>{unitSettings? fromSI(s.pressure, 'pressure', unitSettings.pressure).toFixed(0) : s.pressure?.toFixed(0)}</td>
                                <td style={{ ...cellStyle, textAlign: 'center', color: s.phase === 'vapor' ? '#f59e0b' : '#3b82f6' }}>{s.phase}</td>
                                {componentNames.map(c => (
                                    <td key={`mol-${c}`} style={{ ...cellStyle, textAlign: 'right' }}>{(s.molarComposition?.[c] ?? 0).toFixed(4)}</td>
                                ))}
                                {componentNames.map(c => (
                                    <td key={`mass-${c}`} style={{ ...cellStyle, textAlign: 'right' }}>{(s.composition?.[c] ?? 0).toFixed(4)}</td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function StreamTable({ result }: { result: string }) {
    const exportToExcel = () => {
        try {
            const parsed = JSON.parse(result);
            const streams = parsed.streams ?? {};
            const streamIds = Object.keys(streams);
            if (streamIds.length === 0) return;
            const firstStream = streams[streamIds[0]];
            const componentNames = Object.keys(firstStream?.composition ?? {});
            const headers = ['Stream', 'Mass Flow (kg/s)', 'Molar Flow (mol/s)', 'T (K)', 'P (Pa)', 'Phase',
                ...componentNames.map(c => `${c} mass frac`),
                ...componentNames.map(c => `${c} mol frac`)
            ];
            const rows = streamIds.map(id => {
                const s = streams[id];
                return [
                    id,
                    s.massFlow?.toFixed(3),
                    s.molarFlow?.toFixed(3),
                    s.temperature?.toFixed(1),
                    s.pressure?.toFixed(0),
                    s.phase,
                    ...componentNames.map(c => (s.composition?.[c] ?? 0).toFixed(4)),
                    ...componentNames.map(c => (s.molarComposition?.[c] ?? 0).toFixed(4)),
                ];
            });
            const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bchemsim_results.csv';
            a.click();
            URL.revokeObjectURL(url);
        } catch {}
    };
    
    return (
        <button onClick={exportToExcel} style={{
            background: '#1e3a5f', border: '1px solid #2563eb', borderRadius: 4,
            color: '#60a5fa', fontSize: 10, padding: '3px 8px', cursor: 'pointer',
            fontWeight: 700, letterSpacing: 0.5
        }}>
            ↓ CSV
        </button>
    );
}