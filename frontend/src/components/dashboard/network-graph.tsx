import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
  Handle,
  Position
} from '@xyflow/react';
import { useNetwork } from '@/hooks/use-dashboard-data';
import { AlertCircle } from 'lucide-react';

// Custom Node Component to match aesthetic
const ScfNode = ({ data }: any) => {
  const isFlagged = data.isFlagged;
  const isAnchor = data.tier === 'T1';
  
  return (
    <div className={`
      relative px-4 py-3 rounded-xl border-2 glass-panel shadow-lg min-w-[140px] flex flex-col items-center justify-center
      ${isFlagged ? 'border-destructive shadow-destructive/20' : isAnchor ? 'border-primary shadow-primary/20 glow-card' : 'border-muted-foreground/30'}
      transition-all duration-300 hover:scale-105 hover:z-50 cursor-pointer
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

export function NetworkGraph() {
  const { data, isLoading } = useNetwork();

  // Layout algorithm (simple concentric circles/hierarchy for demo purposes)
  const initialNodes = useMemo(() => {
    if (!data) return [];
    return data.nodes.map((node, i) => {
      let x = 0, y = 0;
      if (node.tier === 'T1') { x = 400; y = 50; }
      else if (node.tier === 'T2') { x = 200 + (i * 150); y = 200; }
      else { x = 100 + (i * 120); y = 350; }
      
      return {
        id: node.id.toString(),
        type: 'scfNode',
        position: { x, y },
        data: node
      };
    });
  }, [data]);

  const initialEdges = useMemo(() => {
    if (!data) return [];
    return data.edges.map(edge => {
      const isGap = edge.type === 'gap';
      const isCarousel = edge.type === 'carousel';
      return {
        id: `e${edge.source}-${edge.target}`,
        source: edge.source.toString(),
        target: edge.target.toString(),
        animated: isCarousel,
        style: {
          stroke: isGap ? 'hsl(var(--destructive))' : isCarousel ? 'hsl(var(--warning))' : 'hsl(var(--primary) / 0.5)',
          strokeWidth: isCarousel ? 3 : 2,
          strokeDasharray: isGap ? '5,5' : 'none',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isGap ? 'hsl(var(--destructive))' : isCarousel ? 'hsl(var(--warning))' : 'hsl(var(--primary) / 0.5)',
        },
      };
    });
  }, [data]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  if (isLoading) return <div className="h-full w-full flex items-center justify-center text-primary glow-text font-mono animate-pulse">ESTABLISHING TOPOLOGY LINK...</div>;

  return (
    <div className="w-full h-full min-h-[500px] rounded-2xl overflow-hidden glow-card border border-border/50 relative bg-background/50">
      <div className="absolute top-4 left-4 z-10 bg-card/80 backdrop-blur border border-border rounded-lg p-3 text-xs font-mono space-y-2">
        <div className="text-muted-foreground uppercase mb-2">Topology Legend</div>
        <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-primary/50"></div> Validated Flow</div>
        <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-destructive border border-dashed border-destructive"></div> Verification Gap</div>
        <div className="flex items-center gap-2"><div className="w-4 h-0.5 bg-warning"></div> Suspected Carousel</div>
      </div>
      
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        fitView
        className="bg-transparent"
      >
        <Background color="rgba(255,255,255,0.05)" gap={20} size={1} />
        <Controls className="fill-primary border-border bg-card shadow-lg" />
      </ReactFlow>
    </div>
  );
}
