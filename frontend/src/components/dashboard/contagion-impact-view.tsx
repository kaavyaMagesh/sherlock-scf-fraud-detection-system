import { useEffect, useMemo, useState } from "react";
import { Zap, AlertTriangle, Users, Building2, ChevronDown, Loader2 } from "lucide-react";
import { useContagionImpact, useNetwork, useCompanies } from "@/hooks/use-dashboard-data";

function statusRank(s: string) {
    if (s === "BLOCKED") return 0;
    if (s === "REVIEW") return 1;
    return 2;
}

export function ContagionImpactView() {
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [entityId, setEntityId] = useState<number | null>(null);

    const { data: network } = useNetwork();
    const { companies } = useCompanies();

    const defaultFromTopology = useMemo(() => {
        const nodes = network?.nodes || [];
        if (!nodes.length) return null;
        const sorted = [...nodes].sort((a: any, b: any) => {
            const d = statusRank(a.status) - statusRank(b.status);
            if (d !== 0) return d;
            return Number(b.maxRiskScore || 0) - Number(a.maxRiskScore || 0);
        });
        return sorted[0]?.id != null ? Number(sorted[0].id) : null;
    }, [network]);

    useEffect(() => {
        if (entityId != null) return;
        if (defaultFromTopology != null) {
            setEntityId(defaultFromTopology);
            return;
        }
        const first = companies?.[0]?.id;
        if (first != null) setEntityId(Number(first));
    }, [entityId, defaultFromTopology, companies]);

    const { data: contagion, isLoading, isError } = useContagionImpact(entityId);
    const exposedEntities = contagion?.exposedEntities || [];
    const totalExposed = Number(contagion?.totalExposedVolume || 0);

    const companyOptions = useMemo(() => {
        const list = companies || [];
        return [...list].sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
    }, [companies]);

    return (
        <div className="bg-card rounded-2xl p-6 glow-card border border-destructive/30 relative overflow-hidden h-full flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-destructive/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

            <div className="flex flex-col gap-4 mb-4 relative z-10 font-sans">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-destructive glow-text flex items-center gap-2">
                            <Zap className="w-5 h-5 fill-destructive/20" />
                            Contagion Impact Analysis
                        </h2>
                        <p className="text-sm text-destructive/80 mt-1 uppercase tracking-widest font-bold">
                            Network Exposure Monitoring
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-mono font-bold text-destructive">₹{totalExposed.toLocaleString('en-IN')}</div>
                        <div className="text-xs font-bold uppercase tracking-wider text-destructive/80">Capital at Risk</div>
                    </div>
                </div>

                <label className="flex flex-col gap-1 text-xs max-w-md">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wider">Root Analysis Entity</span>
                    <select
                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono"
                        value={entityId ?? ""}
                        onChange={(e) => setEntityId(e.target.value ? Number(e.target.value) : null)}
                    >
                        {companyOptions.length === 0 ? (
                            <option value="">No companies</option>
                        ) : (
                            companyOptions.map((c: any) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))
                        )}
                    </select>
                </label>
            </div>

            <div className="space-y-4 flex-1 overflow-auto custom-scrollbar relative z-10 pr-2">
                <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/40 bg-destructive/10">
                    <AlertTriangle className="w-8 h-8 text-destructive animate-pulse shrink-0" />
                    <div>
                        <div className="text-sm font-bold text-foreground">Root entity</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                            {isLoading && <span className="inline-flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading contagion…</span>}
                            {!isLoading && isError && "Could not load contagion data."}
                            {!isLoading && !isError && contagion && (
                                <>
                                    <span className="font-semibold text-foreground">{contagion.rootEntityName || `Entity ${contagion.rootEntityId}`}</span>
                                    {" · "}
                                    {contagion.exposedEntityCount} partner(s) detected.
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-4 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Exposed trading partners
                </div>

                {!isLoading && exposedEntities.length === 0 && entityId != null && (
                    <div className="text-sm text-muted-foreground py-4">No trade relationships in the database for this entity yet.</div>
                )}

                {exposedEntities.map((entity: any) => {
                    const isExpanded = expandedId === entity.id;
                    return (
                        <div
                            key={entity.id}
                            onClick={() => setExpandedId(isExpanded ? null : entity.id)}
                            className="p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/30 transition-all cursor-pointer group select-none"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-muted rounded-md"><Building2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" /></div>
                                    <div>
                                        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                                            {entity.name}
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono font-bold uppercase">Tier {entity.tier}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            Lender exposure detected
                                            <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-mono font-bold text-foreground">₹{entity.exposure.toLocaleString('en-IN')}</div>
                                    <div className="text-xs font-bold text-[#ffae42] uppercase tracking-tighter">Impact Score {contagion?.contagionRiskScore ?? 0}</div>
                                </div>
                            </div>

                            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-3 point-events-auto' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                                <div className="overflow-hidden">
                                    <div className="p-3 bg-muted/30 rounded border border-border/50 text-xs text-muted-foreground leading-relaxed">
                                        Direct exposure based on counterparty trade volume.
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
