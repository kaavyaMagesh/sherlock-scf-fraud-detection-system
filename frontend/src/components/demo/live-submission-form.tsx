import { useState } from "react";
import { CopyPlus, Send, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

export function LiveSubmissionForm() {
    const [status, setStatus] = useState<'idle' | 'analyzing' | 'blocked' | 'approved'>('idle');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('analyzing');

        // Simulate complex analysis delay
        setTimeout(() => {
            // For demo purposes, we automatically catch it as suspicious if it's over 100k
            const form = e.target as HTMLFormElement;
            const amount = parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value || '0');

            if (amount > 100000) {
                setStatus('blocked');
            } else {
                setStatus('approved');
            }
        }, 1500);
    };

    return (
        <div className="bg-card rounded-2xl p-6 glow-card border border-border/50 h-full flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                    <h2 className="text-lg font-semibold text-foreground glow-text flex items-center gap-2">
                        <CopyPlus className="w-5 h-5 text-primary" />
                        Live Entry Simulator
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Submit a test invoice to index</p>
                </div>
            </div>

            <div className="flex-1 relative">
                {status !== 'idle' ? (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur flex flex-col items-center justify-center z-20 rounded-xl border border-border/50">
                        {status === 'analyzing' && (
                            <div className="text-center">
                                <RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                                <div className="font-mono text-sm text-foreground uppercase tracking-widest">Running AI Heuristics...</div>
                            </div>
                        )}

                        {status === 'blocked' && (
                            <div className="text-center p-6 animate-in zoom-in duration-300">
                                <div className="w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-destructive/50 shadow-[0_0_30px_rgba(220,38,38,0.3)]">
                                    <AlertTriangle className="w-10 h-10 text-destructive" />
                                </div>
                                <h3 className="text-2xl font-black text-foreground tracking-tight mb-2">INVOICE BLOCKED</h3>
                                <p className="text-sm text-muted-foreground mb-6">Risk Score: 92/100 (Velocity Anomaly)</p>
                                <button onClick={() => setStatus('idle')} className="text-sm font-bold text-primary uppercase tracking-wider hover:underline">Submit Another</button>
                            </div>
                        )}

                        {status === 'approved' && (
                            <div className="text-center p-6 animate-in zoom-in duration-300">
                                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/50 shadow-[0_0_30px_rgba(54,255,143,0.3)]">
                                    <CheckCircle2 className="w-10 h-10 text-primary" />
                                </div>
                                <h3 className="text-2xl font-black text-foreground tracking-tight mb-2">AUTO-APPROVED</h3>
                                <p className="text-sm text-muted-foreground mb-6">Risk Score: 12/100 (Flow Verified)</p>
                                <button onClick={() => setStatus('idle')} className="text-sm font-bold text-primary uppercase tracking-wider hover:underline">Submit Another</button>
                            </div>
                        )}
                    </div>
                ) : null}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supplier Name</label>
                            <input type="text" required defaultValue="Acme Corp" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount (USD)</label>
                            <input type="number" name="amount" required defaultValue={150000} className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Root PO Reference</label>
                        <input type="text" required defaultValue="PO-1002" className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono" />
                    </div>
                    <div className="space-y-1.5 pb-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description of Goods</label>
                        <textarea rows={2} required defaultValue="Consulting services rendered." className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                    </div>

                    <button type="submit" className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-wider text-sm shadow-[0_0_15px_rgba(54,255,143,0.3)] hover:shadow-[0_0_25px_rgba(54,255,143,0.5)] transition-shadow flex items-center justify-center gap-2">
                        <Send className="w-4 h-4" /> Inject Payload
                    </button>
                </form>
            </div>
        </div>
    );
}
