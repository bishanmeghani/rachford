import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ReactFlow, Controls, addEdge, useReactFlow, MarkerType } from '@xyflow/react';
import type { Connection, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Layout from './components/Layout';
import UnitOpNode from './nodes/UnitOpNode';
import { DEFAULT_UNITS, type UnitSettings, fromSI } from './data/unitsDatabase';
import toast from 'react-hot-toast';
import { useFlowsheetStore } from './store/flowsheetStore';

const nodeTypes = { unitOp: UnitOpNode }

export default function App() {
  const savedState = (() => {
    try { return JSON.parse(localStorage.getItem('rachford_flowsheet') ?? 'null'); } catch { return null; }
  })();
  const hasSavedFlowsheet = !!(savedState?.nodes?.length);

  const nodes = useFlowsheetStore(s => s.nodes);
  const edges = useFlowsheetStore(s => s.edges);
  const components = useFlowsheetStore(s => s.components);
  const result = useFlowsheetStore(s => s.result);
  const loading = useFlowsheetStore(s => s.loading);
  const setNodes = useFlowsheetStore(s => s.setNodes);
  const setEdges = useFlowsheetStore(s => s.setEdges);
  const onNodesChange = useFlowsheetStore(s => s.onNodesChange);
  const onEdgesChange = useFlowsheetStore(s => s.onEdgesChange);
  const setComponents = useFlowsheetStore(s => s.setComponents);
  const setResult = useFlowsheetStore(s => s.setResult);
  const setLoading = useFlowsheetStore(s => s.setLoading);
  const updateNodeData = useFlowsheetStore(s => s.updateNodeData);
  const loadFlowsheet = useFlowsheetStore(s => s.loadFlowsheet);
  const resetFlowsheet = useFlowsheetStore(s => s.reset);

  useEffect(() => {
    if (!hasSavedFlowsheet && savedState)
      loadFlowsheet(savedState);
  }, []);
  
  const [hoveredEdge, setHoveredEdge] = useState<{id: string, x: number, y: number} | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(hasSavedFlowsheet);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;
  const [unitSettings, setUnitSettings] = useState<UnitSettings>(() => {
    try { return JSON.parse(localStorage.getItem('rachford_units') ?? 'null') ?? DEFAULT_UNITS; }
    catch { return DEFAULT_UNITS; }
  });
  
  useEffect(() => {
    if (showResumePrompt) return;
    const state = {
        version: '1.0',
        nodes,
        edges,
        components,
    };
    localStorage.setItem('rachford_flowsheet', JSON.stringify(state));
  }, [nodes, edges, components, showResumePrompt]);

  useEffect(() => {
    localStorage.setItem('rachford_units', JSON.stringify(unitSettings));
  }, [unitSettings]);

  const onNew = () => {
    resetFlowsheet()
    fileHandleRef.current = null;
    localStorage.removeItem('rachford_flowsheet');
  };

  const onResumeFlowsheet = () => {
    if (savedState)
      loadFlowsheet(savedState);
    setShowResumePrompt(false);
  };

  const onStartFresh = () => {
    localStorage.removeItem('rachford_flowsheet');
    setShowResumePrompt(false);
  };

  const fileHandleRef = useRef<any>(null);

  const onSave = async () => {
    const state = { version: '1.0', nodes, edges, components };
    try {
      if (!fileHandleRef.current) {
        fileHandleRef.current = await (window as any).showSaveFilePicker({
          suggestedName: 'flowsheet.rachford',
          types: [{ description: 'Rachford-Rice Flowsheet', accept: { 'application/json': ['.rachford'] } }],
        });
      }
      const writable = await fileHandleRef.current.createWritable();
      await writable.write(JSON.stringify(state, null, 2));
      await writable.close();
      toast.success('Flowsheet saved');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
          // Fallback for browsers that don't support File System Access API
          const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'flowsheet.rachford';
          a.click();
          URL.revokeObjectURL(url);
          toast.success('Flowsheet saved to Downloads');
        }
    }
  };

  const onSaveAs = async () => {
    fileHandleRef.current = null; // force new file picker
    await onSave();
  };

  const onLoad = () => {
    console.log('onLoad fired, ref:', fileInputRef.current);
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
          const state = JSON.parse(ev.target?.result as string);
          loadFlowsheet(state);
          setResult(null);
          toast.success('Flowsheet loaded');
        } catch {
          toast.error('Invalid flowsheet file');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => {
      const streamNumber = eds.length + 1;
      const streamLabel = `S${streamNumber}`;
      return addEdge({
        ...connection,
        id: streamLabel,
        label: streamLabel,
        type: 'smoothstep',
        style: { stroke: '#64748b', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 15, height: 15},
        labelStyle: { fontSize: 10, fill: '#94a3b8' },
        labelBgStyle: { fill: 'rgba(15,23,42,0.8)', fillOpacity: 1 }, 
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 3,
      }, eds);
    }), [setEdges]
  );

  const hasFeed = () => nodes.some(n => n.data.nodeType === 'feed');

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('nodeType');
    
    if (!type) return;

    if (type !== "feed" && !hasFeed()) {
      toast.error('Please add a feed node first');
      return;
    }

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const getNodeLabel = (type: string, existingNodes: Node[]) => {
      const prefixMap: Record<string, string> = {
        feed: 'F',
        pump: 'P',
        mixer: 'M',
        heater: 'H',
        flash: 'V',
        splitter: 'SP',
        outlet: 'O',
      };
      const prefix = prefixMap[type] ?? type[0].toUpperCase();
      const count = existingNodes.filter(n => n.data.nodeType === type).length + 1;
      return `${prefix}${count}`;
    };
    const label = getNodeLabel(type, nodes);
    const defaultData: Record<string, Record<string, unknown>> = {
        feed: { massFlow: 10, molarFlow: 100, temperature: 300, pressure: 101325, composition: { water: 0.3, ethanol: 0.7 }, molarComposition: { water: 0.5229, ethanol: 0.4771 } },
        pump: { targetP: 183000 },
        heater: { targetT: 380 },
        flash: { targetT: 361.15, targetP: 101325 },
        splitter: { splitFraction: 0.4 },
    };    
    const newNode = {
      id: `${type}-${Date.now()}`,
      type: 'unitOp',
      position,
      data: { label, nodeType: type, ...(defaultData[type] ?? {}) }
    };
    setNodes((nds) => nds.concat(newNode));    
  };

  const runSimulation = async () => {
    const connectedNodeIds = new Set(edges.flatMap(e => [e.source, e.target]));
    const unconnectedNodes = nodes.filter(n => !connectedNodeIds.has(n.id));
    if (unconnectedNodes.length > 0) {
      toast.error('All nodes must be connected before running the simulation');
      return;
    }

    if (!hasFeed()) {
      toast.error('Please add a feed node before running the simulation');
      return;
    }

    const payload = {
      nodes: nodes.map(n => ({
            id: n.id,
            nodeType: n.data.nodeType,
            label: n.data.label,
            data: n.data,
        })),
      edges: edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
        })),
      components,
    };

    setLoading(true);
    try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        setResult(JSON.stringify(data, null, 2));
      toast.success("Simulation converged!");
    } catch (err) {
      toast.error("Couldn't reach backend");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onNodeDataChange = useCallback((id: string, newData: Record<string, unknown>) => {
    updateNodeData(id, newData);
  }, [updateNodeData]);

  const onEdgeMouseEnter = useCallback((_: React.MouseEvent, edge: Edge) => {
    const el = document.querySelector(`[data-id="${edge.id}"]`);
    const rect = el?.getBoundingClientRect();
    if (rect) setHoveredEdge({ id: edge.id, x: rect.x + rect.width/2, y: rect.y });
  }, []);

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdge(null);
  }, []);

  const onNodeDrag = useCallback((_e: unknown, draggedNode: Node) => {
    setNodes(nds => nds.map(n => {
      if (n.id === draggedNode.id) return n;
      const dx = n.position.x - draggedNode.position.x;
      const dy = n.position.y - draggedNode.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 80 && dist > 0) {
        return {
          ...n,
          position: {
            x: draggedNode.position.x + dx / dist * 65,
            y: draggedNode.position.y + dy / dist * 65,
          }
        };
      }
      return n;
    }));
  }, [setNodes]);

  return (
    <Layout onRun={runSimulation} onNew={onNew} onSave={onSave} onSaveAs={onSaveAs} onLoad={onLoad} onFitView={fitView} result={result} loading={loading} components={components} onComponentsChange={setComponents} selectedNode={selectedNode} onNodeDataChange={onNodeDataChange} unitSettings={unitSettings} onUnitSettingsChange={setUnitSettings}>
      {showResumePrompt && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
        }}>
          <div style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
            padding: '24px 28px', width: 360, boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
              Resume previous flowsheet?
            </div>
            <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 20, lineHeight: 1.5 }}>
              A flowsheet was found saved in this browser. If this is a shared computer, you may want to start fresh instead.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={onStartFresh} style={{
                padding: '7px 14px', borderRadius: 6, border: '1px solid #334155',
                background: 'transparent', color: '#e2e8f0', fontSize: 12.5, cursor: 'pointer'
              }}>Start Fresh</button>
              <button onClick={onResumeFlowsheet} style={{
                padding: '7px 14px', borderRadius: 6, border: 'none',
                background: '#3b82f6', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
              }}>Resume</button>
            </div>
          </div>
        </div>
      )}
      <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
        onDragOver = {onDragOver}
        onDrop = {onDrop}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".rachford,.json"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
        <ReactFlow
          snapToGrid={true}
          snapGrid={[5, 5]}
          proOptions={{ hideAttribution: true }}
          nodeTypes={nodeTypes}
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDrag}
          onEdgesChange={onEdgesChange}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          onConnect={onConnect}
          deleteKeyCode="Delete"
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedNodeId(null)}
          >
          <Controls />
        </ReactFlow>
        {hoveredEdge && (() => {
          const edge = edges.find(e => e.id === hoveredEdge.id);
          if (!edge) return null;
          if (!unitSettings) return null;
          const label = edge.label as string;
          const streamData = result ? (() => {
            try {
              const parsed = JSON.parse(result);
              return parsed.streams?.[label] ?? null;
            } catch { return null; }
          })() : null;
          return (
            <div style={{
              position: 'fixed', left: hoveredEdge.x, top: hoveredEdge.y - 10,
              transform: 'translate(-50%, -100%)',
              background: '#1e293b', border: '1px solid #334155',
              borderRadius: 6, padding: '8px 12px', fontSize: 11,
              color: '#e2e8f0', zIndex: 1000, pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)', minWidth: 180
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: '#94a3b8', fontFamily: 'monospace' }}>{label}</div>
              {streamData ? <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <tbody>
                    {[
                      ['Molar Flow', `${fromSI(streamData.molarFlow, 'molarFlow', unitSettings.molarFlow).toFixed(3)} ${unitSettings.molarFlow}`],
                      ['Mass Flow', `${fromSI(streamData.massFlow, 'massFlow', unitSettings.massFlow).toFixed(3)} ${unitSettings.massFlow}`],
                      ['Temperature', `${fromSI(streamData.temperature, 'temperature', unitSettings.temperature).toFixed(1)} ${unitSettings.temperature}`],
                      ['Pressure', `${fromSI(streamData.pressure, 'pressure', unitSettings.pressure).toFixed(0)} ${unitSettings.pressure}`],
                      ['Phase', streamData.phase]
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ color: '#64748b', paddingRight: 12, paddingBottom: 3 }}>{k}</td>
                        <td style={{ color: k === 'Phase' ? (streamData.phase === 'vapor' ? '#f59e0b' : '#3b82f6') : '#e2e8f0', textAlign: 'right', paddingBottom: 3 }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: 1, margin: '6px 0 4px' }}>MASS COMPOSITION</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <tbody>
                    {Object.entries(streamData.composition ?? {}).map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ color: '#64748b', paddingRight: 12, textTransform: 'capitalize' }}>{k}</td>
                        <td style={{ color: '#e2e8f0', textAlign: 'right' }}>{(v as number).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: 1, margin: '6px 0 4px' }}>MOLAR COMPOSITION</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <tbody>
                    {Object.entries(streamData.molarComposition ?? {}).map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ color: '#64748b', paddingRight: 12, textTransform: 'capitalize' }}>{k}</td>
                        <td style={{ color: '#e2e8f0', textAlign: 'right' }}>{(v as number).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </> : <div style={{ color: '#475569', fontSize: 10 }}>No simulation data yet</div>}
            </div>
          );
        })()}
      </div>
    </Layout>
  );
}