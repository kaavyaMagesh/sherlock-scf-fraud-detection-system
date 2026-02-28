import { useState } from "react";
import { Zap, AlertTriangle, Users, Building2, ChevronDown } from "lucide-react";

export function ContagionImpactView() {
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const exposedEntities = [
        {
            name: "Supplier Beta",
            tier: "T2",
            exposure: 650000,
            riskIncrease: "+40%",
            details: "Direct financial dependency on Anchor Corp. Flagged due to matching beneficial owner with Sub-supplier Y. 3 pending invoices frozen."
        },
        {
            name: "Manuf. Corp",
            tier: "T3",
            exposure: 120000,
            riskIncrease: "+25%",
            details: "Shared logistics provider with suspected carousel. Low transaction volume but high velocity anomaly detected."
        },
        {
            name: "Logistics X",
            tier: "T3",
            exposure: 85000,
            riskIncrease: "+15%",
            details: "Historical overlaps in delivery coordinates with flagged GRNs. Moderate risk of complicit documentation."
        }
    ];

    const totalExposed = exposedEntities.reduce((acc, curr) => acc + curr.exposure, 0);

    return (
        <div className="bg-card rounded-2xl p-6 glow-card border border-destructive/30 relative overflow-hidden h-full flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-destructive/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

            <div className="flex items-center justify-between mb-6 relative z-10 font-sans">
                <div>
                    <h2 className="text-lg font-semibold text-destructive glow-text flex items-center gap-2">
                        <Zap className="w-5 h-5 fill-destructive/20" />
                        Contagion Impact Analysis
                    </h2>
                    <p className="text-sm text-destructive/80 mt-1">Blast radius for selected anomaly</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-mono font-bold text-destructive">${totalExposed.toLocaleString()}</div>
                    <div className="text-xs font-bold uppercase tracking-wider text-destructive/80">Capital at Risk</div>
                </div>
            </div>

            <div className="space-y-4 flex-1 overflow-auto custom-scrollbar relative z-10 pr-2">
                <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/40 bg-destructive/10">
                    <AlertTriangle className="w-8 h-8 text-destructive animate-pulse" />
                    <div>
                        <div className="text-sm font-bold text-foreground">Root Incident Detected</div>
                        <div className="text-xs text-muted-foreground mt-0.5">T3 Entity 'Sub-supplier Y' flagged for Carousel Trade. Propagating risk scores...</div>
                    </div>
                </div>

                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-4 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Exposed Trading Partners
                </div>

                {exposedEntities.map((entity, i) => {
                    const isExpanded = expandedId === i;
                    return (
                        <div
                            key={i}
                            onClick={() => setExpandedId(isExpanded ? null : i)}
                            className="p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/30 transition-all cursor-pointer group select-none"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-muted rounded-md"><Building2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" /></div>
                                    <div>
                                        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            {entity.name}
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{entity.tier}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            Linked via open POs
                                            <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-mono font-bold text-foreground">${entity.exposure.toLocaleString()}</div>
                                    <div className="text-xs font-bold text-[#ffae42]">{entity.riskIncrease} Risk</div>
                                </div>
                            </div>

                            {/* Expandable Details Area */}
                            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-3 point-events-auto' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                                <div className="overflow-hidden">
                                    <div className="p-3 bg-muted/30 rounded border border-border/50 text-xs text-muted-foreground leading-relaxed">
                                        <div className="font-bold text-foreground mb-1">Exposure Context:</div>
                                        {entity.details}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    )
}
