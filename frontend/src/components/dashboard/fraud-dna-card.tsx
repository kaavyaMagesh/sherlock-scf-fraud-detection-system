import { Fingerprint, RefreshCcw, ShieldAlert, Info, Binary } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BreakdownItem {
    factor: string;
    points?: number | string;
    detail?: string;
}

interface FraudDnaProps {
    dna?: {
        typologies?: Array<{
            label: string;
            confidence: number;
            action: string;
            isPrimary?: boolean;
        }>;
        evidence: string[];
        geminiReasoning?: string;
        // Legacy fields for compatibility if they still exist in some database records
        typology?: string;
        confidence?: number;
        action?: string;
    } | null;
    isLoading?: boolean;
    /** Set when the explain API call returns an error. */
    isError?: boolean;
    /** The Error object thrown by the hook — message is shown in the error block. */
    error?: Error | null;
    breakdown?: BreakdownItem[];
    /** String returned by the backend detectImpatienceSignal function, or null. */
    impatienceSignal?: string | null;
    /** Set when the user picked a queue row (even before detail fetch completes). */
    hasSelection?: boolean;
}

function factorPoints(b: BreakdownItem): number {
    if (typeof b.points === "number") return b.points;
    if (typeof b.points === "string" && b.points.startsWith("x")) return 20;
    const n = parseInt(String(b.points), 10);
    return Number.isFinite(n) ? n : 0;
}

export function FraudDnaCard({ dna, isLoading, isError, error, breakdown, impatienceSignal, hasSelection = false }: FraudDnaProps) {
    const factorRows =
        breakdown?.filter((b) => b.factor && b.factor !== "centrality_multiplier").slice(0, 100) ?? [];
    const maxPts = Math.max(1, ...factorRows.map(factorPoints));

    // Handle both new array-based typologies and legacy single-object typology
    const typologies = dna?.typologies || (dna?.typology ? [{
        label: dna.typology,
        confidence: dna.confidence || 0,
        action: dna.action || "",
        isPrimary: true
    }] : [{
        label: "UNKNOWN PATTERN",
        confidence: 0,
        action: "",
        isPrimary: true
    }]);

    const primary = typologies.find((t: any) => t.isPrimary) || typologies[0];
    const evidenceTrail = dna?.evidence || [];

    return (
        <div className="bg-card rounded-2xl p-6 glow-card border border-destructive/20 h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                    <h2 className="text-lg font-semibold text-foreground glow-text flex items-center gap-2">
                        <Fingerprint className="w-5 h-5 text-destructive" />
                        Fraud DNA Classifier
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Typology derived from the latest risk audit breakdown</p>
                </div>
                {isLoading && <RefreshCcw className="w-4 h-4 text-primary animate-spin" />}
            </div>

            <div className="flex-1 flex flex-col gap-6 relative z-10">
                {!hasSelection ? (
                    <div className="text-center p-4 rounded-xl border bg-muted/10 border-border h-full flex flex-col items-center justify-center min-h-[300px]">
                        <Fingerprint className="w-12 h-12 text-muted-foreground/30 mb-4" />
                        <div className="text-xs font-bold uppercase tracking-wider mb-1 text-muted-foreground">No invoice selected</div>
                        <div className="text-sm text-muted-foreground">Choose a row in the Live Invoice Queue to load Fraud DNA.</div>
                    </div>
                ) : isLoading ? (
                    <div className="text-center p-4 rounded-xl border border-border/50 text-sm text-muted-foreground h-full flex flex-col items-center justify-center min-h-[300px]">
                        <RefreshCcw className="w-8 h-8 text-destructive animate-spin mb-4" />
                        Analyzing Fraud DNA Vector...
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/50 bg-destructive/10 p-6 gap-3 min-h-[300px] text-center">
                        <ShieldAlert className="w-10 h-10 text-destructive/70" />
                        <div className="text-xs font-bold uppercase tracking-wider text-destructive">Analysis Unavailable</div>
                        <div className="text-[11px] font-mono text-destructive/80 max-w-[260px] leading-relaxed">
                            {error?.message ?? 'The Layer 7 engine could not be reached. Re-evaluate the invoice or try again.'}
                        </div>
                    </div>
                ) : !dna ? (
                    <div className="text-center p-4 rounded-xl border border-destructive/20 text-sm text-muted-foreground h-full flex items-center justify-center min-h-[300px]">
                        Could not load Fraud DNA for this invoice.
                    </div>
                ) : (
                    <>
                        {impatienceSignal && (
                            <div className="bg-destructive/10 border border-destructive/50 rounded-xl p-3 flex items-center justify-between animate-pulse">
                                <div className="flex items-center gap-2 text-destructive font-bold text-xs uppercase tracking-tighter">
                                    <ShieldAlert className="w-4 h-4" />
                                    IMPATIENCE SIGNAL DETECTED
                                </div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info className="w-4 h-4 text-destructive/60" />
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-popover text-popover-foreground border-border max-w-[240px]">
                                            <p className="text-[10px] leading-tight">{impatienceSignal}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}

                        <div
                            className={`text-center p-4 rounded-xl border transition-colors ${
                                primary?.label === "LOW_RISK_PROFILE"
                                    ? "bg-primary/5 border-primary/30"
                                    : "border-destructive/30 bg-destructive/10"
                            }`}
                        >
                            <div
                                className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                                    primary?.label === "LOW_RISK_PROFILE" ? "text-primary" : "text-destructive"
                                }`}
                            >
                                Primary typology
                            </div>
                            <div className="text-xl font-black tracking-tight text-foreground uppercase">
                                {primary?.label.replace(/_/g, " ")}
                            </div>
                            <div
                                className={`text-sm font-mono mt-1 ${
                                    primary?.label === "LOW_RISK_PROFILE" ? "text-primary" : "text-destructive"
                                }`}
                            >
                                {primary?.confidence}% confidence
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Typology Vector Scores</div>
                            {typologies.map((t: any, i: number) => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="w-32 text-xs font-medium text-foreground truncate">{t.label ? t.label.replace(/_/g, ' ') : "UNKNOWN"}</div>
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                        <div className={`h-full ${t.isPrimary ? 'bg-destructive glow-border' : 'bg-primary/50'}`} style={{ width: `${t.confidence}%` }}></div>
                                    </div>
                                    <div className="text-xs font-mono font-bold w-10 text-right">{t.confidence}%</div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-2 space-y-1">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Evidence Trail</div>
                            {evidenceTrail.length > 0 ? (
                                evidenceTrail.map((ev, i) => (
                                    <div key={i} className="text-[10px] text-muted-foreground font-mono leading-tight flex gap-2">
                                        <span className="text-destructive shrink-0">•</span>
                                        <span>{ev}</span>
                                    </div>
                                ))
                            ) : !dna?.geminiReasoning && (
                                <div className="text-[10px] text-muted-foreground italic font-mono">No specific DNA markers identified.</div>
                            )}

                            {dna?.geminiReasoning && (
                                <div className="mt-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                                    <div className="text-[9px] font-bold text-primary uppercase mb-1 flex items-center gap-1.5">
                                        <Binary className="w-3 h-3" />
                                        AI Reasoning
                                    </div>
                                    <div className="text-[10px] text-foreground font-medium leading-relaxed italic">
                                        "{dna.geminiReasoning}"
                                    </div>
                                </div>
                            )}
                        </div>

                        {factorRows.length > 0 && (
                            <div className="mt-2 space-y-2">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Raw Factor Analysis</div>
                                <div className="bg-muted/30 rounded-lg p-2 border border-border/50 max-h-[120px] overflow-auto custom-scrollbar">
                                    {factorRows.map((f, i) => (
                                        <div key={i} className="text-[9px] font-mono text-muted-foreground/80 flex justify-between gap-4 py-0.5 border-b border-border/20 last:border-0">
                                            <span className="truncate">{f.factor}:</span>
                                            <span className="shrink-0 text-foreground/70">{f.points} pts</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {typologies.filter((t: any) => t.action).map((t: any, idx: number) => (
                            <div key={idx} className="p-4 rounded-xl border border-warning/30 bg-warning/10 mt-2">
                                <div className="text-xs font-bold uppercase tracking-wider text-warning mb-1">Investigator Action ({t.label.replace(/_/g, ' ')})</div>
                                <div className="text-sm text-foreground font-medium leading-relaxed">{t.action}</div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
