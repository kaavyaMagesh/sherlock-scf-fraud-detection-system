import { HelpCircle, RefreshCcw, ArrowRight, FlaskConical } from "lucide-react";

interface CounterfactualPanelProps {
    counterfactual?: string | null;
    invoiceStatus?: string;
    riskScore?: number;
    isLoading?: boolean;
    /** Set when the explain API call returns an error. */
    isError?: boolean;
    /** The Error object from the hook — message is shown in the error block. */
    error?: Error | null;
    hasSelection?: boolean;
}

export function CounterfactualPanel({
    counterfactual,
    invoiceStatus,
    riskScore,
    isLoading = false,
    isError = false,
    error,
    hasSelection = false,
}: CounterfactualPanelProps) {
    const hasCounterfactual = !!(counterfactual && counterfactual.trim());
    const isLowRisk = riskScore != null && riskScore < 30;
    // Show the fallback ONLY when there is genuinely no counterfactual text
    // (either never generated, or the invoice truly has no issues).
    const fallback = "No critical threshold changes identified for this risk profile.";

    return (
        <div className="bg-card rounded-2xl p-6 glow-card border border-primary/20 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-foreground glow-text flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-primary" />
                        Counterfactual Solution
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">"What would make this safe?"</p>
                </div>
                {isLoading && <RefreshCcw className="w-4 h-4 text-primary animate-spin" />}
            </div>

            <div className="flex-1 flex flex-col justify-center space-y-6">
                {/* No selection state */}
                {!hasSelection ? (
                    <div className="flex flex-col items-center justify-center min-h-[200px] text-center border border-dashed border-border/60 rounded-xl p-6 gap-3">
                        <FlaskConical className="w-10 h-10 text-muted-foreground/30" />
                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">No invoice selected</div>
                        <div className="text-sm text-muted-foreground">Select an invoice to load the What-If analysis.</div>
                    </div>

                /* Loading skeleton */
                ) : isLoading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="p-4 rounded-xl border border-border/50 bg-background/50 space-y-2">
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                            <div className="h-2 bg-muted rounded w-full"></div>
                            <div className="h-2 bg-muted rounded w-4/5"></div>
                        </div>
                        <div className="flex justify-center">
                            <RefreshCcw className="w-4 h-4 text-muted-foreground/30" />
                        </div>
                        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                            <div className="h-3 bg-muted rounded w-1/3"></div>
                            <div className="h-2 bg-muted rounded w-full"></div>
                            <div className="h-2 bg-muted rounded w-3/4"></div>
                        </div>
                    </div>

                /* Error state — Layer 7 engine unreachable */
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center min-h-[200px] text-center border border-destructive/40 rounded-xl p-6 gap-3 bg-destructive/10">
                        <FlaskConical className="w-10 h-10 text-destructive/60" />
                        <div className="text-xs font-bold uppercase tracking-wider text-destructive">Analysis Unavailable</div>
                        <div className="text-[11px] font-mono text-destructive/80 max-w-[260px] leading-relaxed">
                            {error?.message ?? 'The counterfactual engine could not be reached. Re-evaluate the invoice or try again.'}
                        </div>
                    </div>

                /* Loaded data */
                ) : (
                    <>
                        {/* Current State Block */}
                        <div className="p-4 rounded-xl border border-border/50 bg-background/50 relative">
                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-card border-2 border-destructive flex items-center justify-center">
                                <div className={`w-2 h-2 rounded-full ${invoiceStatus === 'BLOCKED' ? 'bg-destructive' : invoiceStatus === 'REVIEW' ? 'bg-warning' : 'bg-primary'}`}></div>
                            </div>
                            <div className={`text-sm mb-1 font-medium pl-2 ${invoiceStatus === 'BLOCKED' ? 'text-destructive' : invoiceStatus === 'REVIEW' ? 'text-warning' : 'text-primary'}`}>
                                Current State ({invoiceStatus ?? 'UNKNOWN'})
                                {riskScore != null && (
                                    <span className="ml-2 font-mono text-xs text-muted-foreground">— Risk Score: {riskScore}</span>
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground leading-relaxed pl-2">
                                {isLowRisk && !hasCounterfactual
                                    ? "This invoice currently meets all risk thresholds. No immediate action required."
                                    : "This invoice has been flagged based on one or more risk signals detected during automated evaluation."}
                            </div>
                        </div>

                        {/* Connector */}
                        <div className="flex justify-center -my-2 opacity-50 relative z-10">
                            <RefreshCcw className="w-4 h-4 text-muted-foreground" />
                        </div>

                        {/* Required Mitigations Block */}
                        <div className="p-4 rounded-xl border border-primary/50 bg-primary/5 glow-card relative">
                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(54,255,143,0.5)]">
                                <ArrowRight className="w-3 h-3 text-card" />
                            </div>
                            <div className="text-sm text-primary mb-2 font-bold pl-2">Required Mitigations (Target: Score &lt;30)</div>
                            {hasCounterfactual ? (
                                <p className="text-xs text-muted-foreground leading-relaxed pl-2">
                                    {counterfactual}
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground leading-relaxed pl-2 italic">{fallback}</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
