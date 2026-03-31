import { useCallback, useMemo, useState } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MarkerType,
    Handle,
    Position,
    type NodeMouseHandler
} from '@xyflow/react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

const API_BASE = 'http://localhost:3000/api';

const ScfNode = ({ data }: any) => {
    const isFlagged = data.isFlagged;
    const isAnchor = data.tier === 'T1';

    return (
        <div className={`
      relative px-4 py-3 rounded-xl border-2 glass-panel shadow-lg min-w-[140px] flex flex-col items-center justify-center
      ${isFlagged ? 'border-destructive shadow-destructive/20' : isAnchor ? 'border-primary shadow-primary/20 glow-card' : 'border-muted-foreground/30'}
      transition-all duration-300 hover:scale-105 cursor-pointer
    `}>
            <Handle type="target" position={Position.Top} className="opacity-0" />

            {isFlagged && (
                <div className="absolute -top-3 -right-3 animate-bounce">
                    <AlertCircle className="text-destructive fill-destructive/20" size={24} />
                </div>
            )}

            <div className={`text-xs font-mono mb-1 ${isAnchor ? 'text-primary' : 'text-muted-foreground'}`}>
                {data.tier}
            </div>
            <div className="font-semibold text-sm text-center text-foreground whitespace-nowrap">
                {data.label}
            </div>
            {data.riskScore > 0 && (
                <div className="mt-2 w-full h-1 bg-black/50 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${data.riskScore > 75 ? 'bg-destructive' : data.riskScore > 40 ? 'bg-warning' : 'bg-primary'}`}
                        style={{ width: `${data.riskScore}%` }}
                    />
                </div>
            )}
            <Handle type="source" position={Position.Bottom} className="opacity-0" />
        </div>
    );
};

const nodeTypes = { scfNode: ScfNode };

export function RetailNetworkGraph() {
    const { data, isLoading } = useQuery({
        queryKey: ['retail-topology'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/retail/topology`, {
                headers: { 'x-lender-id': '1' }
            });
            if (!res.ok) throw new Error('Failed');
            return await res.json();
        },
        refetchInterval: 5000
    });

    const [selectedNode, setSelectedNode] = useState<any>(null);

    const initialNodes = useMemo(() => {
        if (!data?.nodes) return [];
        return data.nodes
            .filter((node: any) => node && node.id) // Protect against nulls
            .map((node: any, i: number) => {
                let x = 0, y = 0;
                if (node.tier === 'T1') { x = 400; y = 50; }
                else if (node.tier === 'T2') { x = 200 + (i * 150); y = 200; }
                else { x = 100 + (Math.random() * 200 + (i * 80)); y = 350; }

                return {
                    id: String(node.id),
                    type: 'scfNode',
                    position: { x, y },
                    data: node
                };
            });
    }, [data]);

    const initialEdges = useMemo(() => {
        if (!data?.edges) return [];
        return data.edges
            .filter((edge: any) => edge && edge.id && edge.source && edge.target) // Protect against null edge hooks
            .map((edge: any) => {
                const isCarousel = edge.type === 'carousel';
                return {
                    id: String(edge.id),
                    source: String(edge.source),
                    target: String(edge.target),
                    label: edge.label,
                    animated: isCarousel,
                    style: {
                        stroke: isCarousel ? 'hsl(var(--warning))' : 'hsl(var(--primary) / 0.5)',
                        strokeWidth: isCarousel ? 3 : 2,
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: isCarousel ? 'hsl(var(--warning))' : 'hsl(var(--primary) / 0.5)',
                    },
                };
            });
    }, [data]);

    const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
        setSelectedNode(node.data);
    }, []);

    if (isLoading) return <div className="h-full w-full flex items-center justify-center text-primary glow-text font-mono animate-pulse">ESTABLISHING RETAIL LINK...</div>;

    return (
        <div className="w-full h-full min-h-[500px] rounded-2xl overflow-hidden glow-card border border-border/50 relative bg-background/50">

            {/* Topology Legend */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 pointer-events-none">
                <div className="bg-card/80 backdrop-blur border border-border/50 rounded-lg p-3 text-xs font-mono space-y-2">
                    <div className="text-muted-foreground uppercase mb-2">Live Retail Topology Legend</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-primary/50"></div> Standard Transfer</div>
                    <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-warning border border-dashed border-warning"></div> Suspect Transfer (Mule/Carousel)</div>
                </div>
            </div>

            <ReactFlow
                nodes={initialNodes}
                edges={initialEdges}
                nodeTypes={nodeTypes}
                onNodeClick={onNodeClick}
                fitView
                className="bg-transparent"
            >
                <Background color="rgba(255,255,255,0.05)" gap={20} size={1} />
                <Controls className="fill-primary border-border bg-card shadow-lg" />
            </ReactFlow>

            {/* Slide Over Panel for Node Inspection */}
            {selectedNode && (
                <div className="absolute top-0 right-0 h-full w-80 bg-card/95 backdrop-blur-xl border-l border-border/50 p-6 shadow-2xl z-50 transition-transform duration-300 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <div className="text-xs font-mono font-bold text-primary mb-1">{selectedNode.tier} Entity</div>
                            <h3 className="text-xl font-bold text-foreground tracking-tight whitespace-pre-line">{selectedNode.label}</h3>
                        </div>
                        <button onClick={() => setSelectedNode(null)} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-6 flex-1">
                        <div className="p-4 rounded-xl border border-border/50 bg-background/50">
                            <div className="text-sm text-muted-foreground mb-1">Entity Risk Score</div>
                            <div className="flex items-center gap-3">
                                <span className={`text-4xl font-mono font-black ${selectedNode.riskScore > 75 ? 'text-destructive glow-text' : selectedNode.riskScore > 40 ? 'text-warning glow-text' : 'text-primary glow-text'}`}>
                                    {selectedNode.riskScore}/100
                                </span>
                                {selectedNode.isFlagged && <ShieldAlert className="w-6 h-6 text-destructive animate-pulse" />}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-muted/20 rounded-lg border border-border/50">
                                <div className="text-xs text-muted-foreground mb-1 truncate">Status</div>
                                <div className={`text-sm font-semibold flex items-center gap-1 ${selectedNode.isFlagged ? 'text-destructive' : 'text-primary'}`}>
                                    {selectedNode.isFlagged ? <><AlertCircle className="w-3 h-3" /> Flagged</> : <><CheckCircle2 className="w-3 h-3" /> Active</>}
                                </div>
                            </div>
                            <div className="p-3 bg-muted/20 rounded-lg border border-border/50">
                                <div className="text-xs text-muted-foreground mb-1 truncate">Account</div>
                                <div className="text-xs font-mono font-semibold text-foreground truncate">{selectedNode.id}</div>
                            </div>
                        </div>

                        <div className="space-y-2 mt-4">
                            {selectedNode.isFlagged ? (
                                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs leading-relaxed text-destructive/90">
                                    <span className="font-bold">CRITICAL:</span> Node involved in suspected Retail fraud loop (Mule proxy or Circular funding).
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground italic">No active alerts for this entity.</div>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
