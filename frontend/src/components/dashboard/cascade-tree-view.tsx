import { GitMerge, Layers, ShieldAlert, CheckCircle2 } from "lucide-react";

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

// Mock hierarchical cascade data
const CASCADE_DATA = [
    {
        id: "T1-PO-1002", tier: "T1", entity: "Anchor Corp", type: "Root PO",
        amount: 1000000, risk: "low", status: "VERIFIED",
        children: [
            {
                id: "T2-INV-841", tier: "T2", entity: "Supplier Alpha", type: "Invoice",
                amount: 500000, risk: "low", status: "VERIFIED",
                children: [
                    { id: "T3-INV-22", tier: "T3", entity: "Sub-supplier X", type: "Invoice", amount: 200000, risk: "medium", status: "VERIFIED" }
                ]
            },
            {
                id: "T2-INV-842", tier: "T2", entity: "Supplier Beta", type: "Invoice",
                amount: 650000, risk: "high", status: "FLAGGED",
                children: [
                    { id: "T3-INV-99", tier: "T3", entity: "Sub-supplier Y", type: "Invoice", amount: 400000, risk: "critical", status: "BLOCKED" },
                    { id: "T3-INV-100", tier: "T3", entity: "Sub-supplier Z", type: "Invoice", amount: 300000, risk: "critical", status: "BLOCKED" }
                ]
            }
        ]
    }
];

export function CascadeTreeView() {
    const root = CASCADE_DATA[0];

    // Quick recursive sum logic for total exposure
    const computeExposure = (node: any): number => {
        const childSum = node.children ? node.children.reduce((acc: number, c: any) => acc + computeExposure(c), 0) : 0;
        return node.amount + childSum;
    };
    const totalFinanced = root.children.reduce((acc: number, c: any) => acc + computeExposure(c), 0);
    const rootAmount = root.amount;
    const Ratio = (totalFinanced / rootAmount);

    const renderNode = (node: any, depth = 0) => {
        const isCritical = node.risk === 'critical' || node.risk === 'high';
        const hasChildren = node.children && node.children.length > 0;

        return (
            <div key={node.id} className="w-full">
                {/* Connection Line */}
                {depth > 0 && (
                    <div className="absolute -left-6 top-6 w-6 h-px bg-border group-hover:bg-primary/50 transition-colors"></div>
                )}
                {depth > 0 && hasChildren && (
                    <div className="absolute left-[11px] top-6 bottom-[-24px] w-px bg-border group-hover:bg-primary/50 transition-colors z-0"></div>
                )}

                <div className={`relative z-10 p-3 mb-2 rounded-xl border flex items-center justify-between transition-colors
          ${isCritical ? 'bg-destructive/10 border-destructive/40 shadow-[0_0_10px_rgba(220,38,38,0.1)]' : 'bg-card border-border hover:border-primary/50'}
        `}>
                    <div className="flex items-center gap-3">
                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase font-mono
              ${node.tier === 'T1' ? 'bg-primary/20 text-primary' : node.tier === 'T2' ? 'bg-accent/20 text-accent-foreground' : 'bg-muted text-muted-foreground'}
            `}>
                            {node.tier}
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                                {node.entity}
                                {isCritical ? <ShieldAlert className="w-3.5 h-3.5 text-destructive" /> : <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">{node.id} • {node.type}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-mono text-sm font-bold text-foreground">
                            {formatCurrency(node.amount)}
                        </div>
                        <div className={`text-[10px] font-bold uppercase tracking-wider px-1.5 rounded inline-block mt-0.5 ${isCritical ? 'bg-destructive text-white' : 'bg-primary/10 text-primary'
                            }`}>
                            {node.status}
                        </div>
                    </div>
                </div>

                {hasChildren && (
                    <div className="pl-6 border-l border-border relative ml-3 mt-1 pb-1">
                        {node.children.map((child: any) => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-card rounded-2xl p-6 glow-card border border-border/50 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-foreground glow-text flex items-center gap-2">
                        <GitMerge className="w-5 h-5 text-primary" />
                        Cross-Tier Cascade Exposure
                    </h2>
                    <p className="text-sm text-muted-foreground">Monitoring Deep-Tier Multi-Financing</p>
                </div>
            </div>

            {/* Metrics Banner */}
            <div className={`p-4 rounded-xl border mb-6 flex items-center justify-between ${Ratio > 1.1 ? 'bg-destructive/10 border-destructive/50' : 'bg-muted/10 border-border'
                }`}>
                <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Root PO Value</div>
                    <div className="font-mono text-xl text-foreground font-bold">{formatCurrency(rootAmount)}</div>
                </div>
                <div className="text-center">
                    <Layers className={`w-6 h-6 mx-auto mb-1 ${Ratio > 1.1 ? 'text-destructive' : 'text-primary'}`} />
                    <div className={`text-xs font-bold ${Ratio > 1.1 ? 'text-destructive' : 'text-primary'}`}>
                        {(Ratio * 100).toFixed(1)}% FINANCED
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Cumulative Tiered Financing</div>
                    <div className={`font-mono text-xl font-bold ${Ratio > 1.1 ? 'text-destructive glow-text' : 'text-foreground'}`}>
                        {formatCurrency(totalFinanced)}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {renderNode(root)}
            </div>
        </div>
    );
}
