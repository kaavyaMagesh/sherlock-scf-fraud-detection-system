import { FileText, Cpu, AlertTriangle, RefreshCcw, MapPin, Clock, PackageSearch, Binary, Globe, Activity } from "lucide-react";

interface SemanticComparisonProps {
    data?: {
        invoiceDescription: string;
        poDescription: string;
        grnDescription: string;
        invoiceLocation?: string;
        poLocation?: string;
        invoiceTerms?: string;
        poTerms?: string;
    } | null;
    isLoading?: boolean;
    breakdown?: any[];
    /** When false, show “select an invoice” empty state */
    hasSelection?: boolean;
}

export function SemanticComparison({ data, isLoading, breakdown, hasSelection = false }: SemanticComparisonProps) {
    const semanticMismatch = breakdown?.find(
        (b) =>
            b.factor === "semantic_mismatch" ||
            b.factor === "vague_description" ||
            b.factor === "templated_invoices" ||
            b.factor === "geographical_anomaly" ||
            b.factor === "payment_timeline_anomaly"
    );

    const geoMismatch = breakdown?.find(b => b.factor === "geographical_anomaly");
    const timelineMismatch = breakdown?.find(b => b.factor === "payment_timeline_anomaly");
    const techAnomaly = breakdown?.find(b => b.factor === "technical_fraud_anomaly" || b.factor === "vague_description");
    const goodsMismatch = breakdown?.find(b => b.factor === "semantic_mismatch" && b.detail?.toLowerCase().includes("mismatch"));

    const mismatchDetail = semanticMismatch?.detail as string | undefined;

    const isEmptyDoc =
        !data?.invoiceDescription?.trim() &&
        !data?.poDescription?.trim() &&
        !data?.grnDescription?.trim();

    return (
        <div className="bg-card rounded-2xl p-6 glow-card border border-warning/30 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-foreground glow-text flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-warning" />
                        Semantic Verification
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">PO / invoice / GRN text used in the risk engine semantic layer</p>
                </div>
                {isLoading ? (
                    <RefreshCcw className="w-4 h-4 text-warning animate-spin" />
                ) : semanticMismatch ? (
                    <div className="flex gap-2">
                        {goodsMismatch && (
                             <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold rounded-md flex items-center gap-1.5 animate-pulse">
                                <PackageSearch className="w-3 h-3" /> Mismatch
                            </div>
                        )}
                        {techAnomaly && (
                             <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold rounded-md flex items-center gap-1.5">
                                <Binary className="w-3 h-3" /> Tech Scan
                            </div>
                        )}
                        <div className="px-3 py-1 bg-warning/10 border border-warning/20 text-warning text-xs font-bold rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                            <AlertTriangle className="w-3 h-3" />
                            Flagged
                        </div>
                    </div>
                ) : hasSelection && !isEmptyDoc ? (
                    <div className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-xs font-bold rounded-full flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Clean Signal
                    </div>
                ) : null}
            </div>

            {!hasSelection ? (
                <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-muted-foreground border border-dashed border-border/60 rounded-xl">
                    Select an invoice in the queue to load PO, invoice, and GRN fields from the database.
                </div>
            ) : (
                <>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-background/50 border border-border/50 rounded-xl p-4 flex flex-col min-h-[120px]">
                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2 border-b border-border/50 pb-2">
                                <FileText className="w-3 h-3" /> Purchase Order
                            </div>
                            <div className="text-[11px] text-foreground/80 font-mono leading-relaxed mt-2 flex-1 break-words">
                                {data?.poDescription?.trim() ? `"${data.poDescription}"` : "— No goods category on linked PO —"}
                            </div>
                        </div>

                        <div
                            className={`rounded-xl p-4 flex flex-col min-h-[120px] relative ${
                                semanticMismatch ? "bg-warning/5 border border-warning/30" : "bg-background/50 border border-border/50"
                            }`}
                        >
                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2 border-b border-border/50 pb-2">
                                <FileText className={`w-3 h-3 ${semanticMismatch ? "text-warning" : ""}`} /> Invoice
                            </div>
                            <div className="text-[11px] text-foreground/80 font-mono leading-relaxed mt-2 flex-1 break-words">
                                {data?.invoiceDescription?.trim() ? `"${data.invoiceDescription}"` : "— No goods category on invoice —"}
                            </div>
                            {semanticMismatch && mismatchDetail && (
                                <div className="mt-2 p-2 bg-warning/10 rounded border border-warning/20 text-[10px] text-warning">
                                    {mismatchDetail}
                                </div>
                            )}
                        </div>

                        <div className="bg-background/50 border border-border/50 rounded-xl p-4 flex flex-col min-h-[120px]">
                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2 border-b border-border/50 pb-2">
                                <FileText className="w-3 h-3" /> Goods receipt
                            </div>
                            <div className="text-[11px] text-foreground/80 font-mono leading-relaxed mt-2 flex-1 break-words">
                                {data?.grnDescription?.trim()
                                    ? `"${data.grnDescription}"`
                                    : "— No receipt amount on linked GRN —"}
                            </div>
                        </div>
                    </div>

                    {/* Geography & Timeline Row (Layer 6 Addition) */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`backdrop-blur-md rounded-xl p-4 flex flex-col min-h-[110px] transition-all duration-300 ${
                            geoMismatch ? "bg-warning/10 border border-warning/50 shadow-[0_0_20px_rgba(245,158,11,0.1)]" : "bg-background/40 border border-border/30"
                        }`}>
                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2 border-b border-border/20 pb-2">
                                <Globe className={`w-3.5 h-3.5 ${geoMismatch ? "text-warning animate-pulse" : ""}`} /> 
                                <span className={geoMismatch ? "text-warning" : ""}>Geographical Plausibility</span>
                            </div>
                            <div className="text-[11px] text-foreground/90 font-mono leading-relaxed mt-1 flex-1 space-y-1">
                                <div><span className="text-[9px] text-muted-foreground uppercase mr-1">R:</span> {data?.poLocation || "— No location on PO —"}</div>
                                {data?.invoiceLocation && data.invoiceLocation !== data.poLocation && (
                                    <div className="pt-1 border-t border-border/10">
                                        <span className="text-[9px] text-muted-foreground uppercase mr-1">S:</span> {data.invoiceLocation}
                                    </div>
                                )}
                            </div>
                            {geoMismatch && (
                                <div className="mt-3 text-[10px] text-warning bg-warning/5 p-2 rounded-lg border border-warning/10 flex items-start gap-2">
                                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                    <span>{geoMismatch.detail}</span>
                                </div>
                            )}
                        </div>

                        <div className={`backdrop-blur-md rounded-xl p-4 flex flex-col min-h-[110px] transition-all duration-300 ${
                            timelineMismatch ? "bg-warning/10 border border-warning/50 shadow-[0_0_20px_rgba(245,158,11,0.1)]" : "bg-background/40 border border-border/30"
                        }`}>
                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2 border-b border-border/20 pb-2">
                                <Clock className={`w-3.5 h-3.5 ${timelineMismatch ? "text-warning animate-pulse" : ""}`} /> 
                                <span className={timelineMismatch ? "text-warning" : ""}>Payment Timeline Analysis</span>
                            </div>
                            <div className="text-[11px] text-foreground/90 font-mono leading-relaxed mt-1 flex-1 space-y-1">
                                <div><span className="text-[9px] text-muted-foreground uppercase mr-1">R:</span> {data?.poTerms || "— Default terms —"}</div>
                                {data?.invoiceTerms && data.invoiceTerms !== data.poTerms && (
                                    <div className="pt-1 border-t border-border/10">
                                        <span className="text-[9px] text-muted-foreground uppercase mr-1">S:</span> {data.invoiceTerms}
                                    </div>
                                )}
                            </div>
                            {timelineMismatch && (
                                <div className="mt-3 text-[10px] text-warning bg-warning/5 p-2 rounded-lg border border-warning/10 flex items-start gap-2">
                                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                    <span>{timelineMismatch.detail}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            <div className="mt-4 p-3 bg-muted/20 border border-border/50 rounded-lg text-xs leading-relaxed text-muted-foreground">
                {semanticMismatch ? (
                    <>
                        <span className="font-bold text-warning mr-1">Semantic Signal:</span>
                        The risk engine recorded factor "{String(semanticMismatch.factor).replace(/_/g, " ")}". Descriptions above are loaded from your live database rows.
                    </>
                ) : hasSelection ? (
                    "Choose an invoice to inspect stored document text."
                ) : (
                    "Choose an invoice to inspect stored document text."
                )}
            </div>
        </div>
    );
}
