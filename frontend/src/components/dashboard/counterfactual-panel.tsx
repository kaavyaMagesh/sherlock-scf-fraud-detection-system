import { HelpCircle, RefreshCcw, ArrowRight } from "lucide-react";

export function CounterfactualPanel() {
    return (
        <div className="bg-card rounded-2xl p-6 glow-card border border-primary/20 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-foreground glow-text flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-primary" />
                        Counterfactual AI
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">"What would make this safe?"</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center space-y-6">
                <div className="p-4 rounded-xl border border-border/50 bg-background/50 relative">
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-card border-2 border-primary flex items-center justify-center">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                    </div>
                    <div className="text-sm text-foreground mb-1 font-medium pl-2">Current State (Blocked)</div>
                    <div className="text-xs text-muted-foreground leading-relaxed pl-2">
                        Invoice #841 involves a T3 entity with a historical dilution rate of 8% and forms a closed cycle with Anchor PO #1002.
                    </div>
                </div>

                <div className="flex justify-center -my-2 opacity-50 relative z-10">
                    <RefreshCcw className="w-4 h-4 text-muted-foreground" />
                </div>

                <div className="p-4 rounded-xl border border-primary/50 bg-primary/5 glow-card relative">
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(54,255,143,0.5)]">
                        <ArrowRight className="w-3 h-3 text-card" />
                    </div>
                    <div className="text-sm text-primary mb-1 font-bold pl-2">Required Mitigations (Target: Score &lt;30)</div>
                    <ul className="text-xs text-muted-foreground leading-relaxed list-disc list-inside space-y-1 pl-2">
                        <li>Verify Tier 3 KYC and obtain Verifiable Credential</li>
                        <li>Extend cycle discovery window to rule out related party transaction</li>
                        <li>Provide physical shipping manifest for PO #1002</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
