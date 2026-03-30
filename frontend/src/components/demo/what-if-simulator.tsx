import { useState } from "react";
import { HelpCircle, ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";

export function WhatIfSimulator() {
    const [isApproved, setIsApproved] = useState(false);
    const [fundAmount, setFundAmount] = useState(250000);

    const baseHealth = 85.0;

    // Deterministic drop based on the input amount
    const dropPercentage = Math.min((fundAmount / 20000) * 1.5, 60.0);
    const calculatedHealth = isApproved ? Math.max(baseHealth - dropPercentage, 12.5).toFixed(1) : baseHealth.toFixed(1);

    return (
        <div className="bg-card rounded-2xl p-6 glow-card border border-border/50 h-full flex flex-col relative overflow-hidden transition-colors duration-500">
            <div className={`absolute inset-0 opacity-10 transition-opacity duration-500 pointer-events-none ${isApproved ? 'bg-destructive' : 'bg-primary'}`}></div>

            <div className="flex items-center justify-between mb-4 relative z-10">
                <div>
                    <h2 className="text-lg font-semibold text-foreground glow-text flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-primary" />
                        Disbursement Tool
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Simulate cascading risk of override</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 shrink-0 relative z-10">
                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Target Invoice</label>
                    <input type="text" defaultValue="INV-8001" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Exposure Amount (INR)</label>
                    <input
                        type="number"
                        value={fundAmount}
                        onChange={(e) => setFundAmount(parseFloat(e.target.value) || 0)}
                        className="w-full bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3 bg-muted/50 p-1 rounded-full border border-border/50 mb-6 shrink-0 relative z-10">
                <button
                    onClick={() => setIsApproved(false)}
                    className={`flex-1 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${!isApproved ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    Keep Blocked
                </button>
                <button
                    onClick={() => setIsApproved(true)}
                    className={`flex-1 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${isApproved ? 'bg-destructive text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    Test Override
                </button>
            </div>

            <div className="flex-1 flex flex-col justify-center space-y-4 relative z-10 h-full">
                <div className="grid grid-cols-2 gap-4">

                    <div className={`p-5 rounded-xl border transition-all duration-500 flex flex-col items-center justify-center text-center ${!isApproved ? 'bg-primary/10 border-primary/30' : 'bg-muted/10 border-border/50 opacity-50'}`}>
                        <ShieldCheck className={`w-8 h-8 mb-2 ${!isApproved ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="text-2xl font-mono font-bold text-foreground mb-1">{baseHealth}%</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Base Health</div>
                    </div>

                    <div className="flex items-center justify-center -mx-4 z-20">
                        <div className="bg-card p-2 rounded-full border border-border/50 shadow-lg">
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>

                    <div className={`p-5 rounded-xl border transition-all duration-500 flex flex-col items-center justify-center text-center ${isApproved ? 'bg-destructive/10 border-destructive/50 shadow-[0_0_20px_rgba(220,38,38,0.2)] scale-105' : 'bg-muted/10 border-border/50 opacity-50'}`}>
                        <ShieldAlert className={`w-8 h-8 mb-2 ${isApproved ? 'text-destructive' : 'text-muted-foreground'}`} />
                        <div className="text-2xl font-mono font-bold text-foreground mb-1">
                            {isApproved ? `${calculatedHealth}%` : '---'}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">New Health</div>
                    </div>

                </div>

                <div className={`p-3 rounded-xl border transition-all duration-500 ${isApproved ? 'bg-destructive/5 border-destructive/30' : 'bg-primary/5 border-primary/20'}`}>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {isApproved
                            ? `Overriding this block injects ₹${fundAmount.toLocaleString('en-IN')} capital into a designated high-risk entity. Modeler predicts a ${dropPercentage.toFixed(1)}% drop in network health.`
                            : "Keeping the block maintains the network firewall. System health evaluates optimally without contagion risk from the designated account."}
                    </p>
                </div>
            </div>
        </div>
    );
}
