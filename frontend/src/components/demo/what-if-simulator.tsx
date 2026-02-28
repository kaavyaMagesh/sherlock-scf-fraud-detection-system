import { useState } from "react";
import { HelpCircle, ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";

export function WhatIfSimulator() {
    const [isApproved, setIsApproved] = useState(false);

    return (
        <div className="bg-card rounded-2xl p-6 glow-card border border-border/50 h-full flex flex-col relative overflow-hidden transition-colors duration-500">
            <div className={`absolute inset-0 opacity-10 transition-opacity duration-500 pointer-events-none ${isApproved ? 'bg-destructive' : 'bg-primary'}`}></div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                    <h2 className="text-lg font-semibold text-foreground glow-text flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-primary" />
                        What-If Disbursement
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Simulate cascading risk of override</p>
                </div>

                <div className="flex items-center gap-3 bg-muted/50 p-1.5 rounded-full border border-border/50">
                    <button
                        onClick={() => setIsApproved(false)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${!isApproved ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Blocked (Current)
                    </button>
                    <button
                        onClick={() => setIsApproved(true)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${isApproved ? 'bg-destructive text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Override & Approve
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center space-y-6 relative z-10">
                <div className="grid grid-cols-2 gap-4">

                    <div className={`p-5 rounded-xl border transition-all duration-500 flex flex-col items-center justify-center text-center ${!isApproved ? 'bg-primary/10 border-primary/30' : 'bg-muted/10 border-border/50 opacity-50'}`}>
                        <ShieldCheck className={`w-10 h-10 mb-2 ${!isApproved ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="text-2xl font-mono font-bold text-foreground mb-1">81.2%</div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Health Score</div>
                    </div>

                    <div className="flex items-center justify-center -mx-4 z-20">
                        <div className="bg-card p-2 rounded-full border border-border/50 shadow-lg">
                            <ArrowRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                    </div>

                    <div className={`p-5 rounded-xl border transition-all duration-500 flex flex-col items-center justify-center text-center ${isApproved ? 'bg-destructive/10 border-destructive/50 shadow-[0_0_20px_rgba(220,38,38,0.2)] scale-105' : 'bg-muted/10 border-border/50 opacity-50'}`}>
                        <ShieldAlert className={`w-10 h-10 mb-2 ${isApproved ? 'text-destructive' : 'text-muted-foreground'}`} />
                        <div className="text-2xl font-mono font-bold text-foreground mb-1">
                            {isApproved ? '42.5%' : '---'}
                        </div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Health Score</div>
                    </div>

                </div>

                <div className={`p-4 rounded-xl border transition-all duration-500 ${isApproved ? 'bg-destructive/5 border-destructive/30' : 'bg-primary/5 border-primary/20'}`}>
                    <div className="text-sm font-bold text-foreground mb-2">Simulated Outcome</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {isApproved
                            ? "Overriding the block on Invoice #841 injects capital into a suspected carousel. The model predicts a 38.7% drop in portfolio health within 48 hours as contagion spreads to interconnected Tier 3 entities, exposing $2.4M in related party networks."
                            : "Maintaining the block successfully isolates the anomaly. The network remains insulated from the suspected Tier 3 carousel trade, preserving the 81% health benchmark."}
                    </p>
                </div>
            </div>
        </div>
    );
}
