import { useState, useEffect } from "react";
import { Play, RotateCcw, ShieldAlert, Activity, CheckCircle2 } from "lucide-react";

export function FraudSimulator() {
    const [phase, setPhase] = useState<'idle' | 'injecting' | 'catching' | 'complete'>('idle');
    const [invoicesProcessed, setInvoicesProcessed] = useState(0);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (phase === 'injecting') {
            timer = setTimeout(() => setPhase('catching'), 2000);
        } else if (phase === 'catching') {
            const interval = setInterval(() => {
                setInvoicesProcessed(prev => {
                    if (prev >= 340) {
                        clearInterval(interval);
                        setPhase('complete');
                        return 340;
                    }
                    return prev + Math.floor(Math.random() * 15) + 5;
                });
            }, 100);
            return () => clearInterval(interval);
        }
        return () => clearTimeout(timer);
    }, [phase]);

    const reset = () => {
        setPhase('idle');
        setInvoicesProcessed(0);
    };

    return (
        <div className="bg-card rounded-2xl p-6 glow-card border border-primary/20 h-full flex flex-col relative overflow-hidden">
            {phase === 'complete' && (
                <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-in fade-in duration-500">
                    <div className="bg-card border-2 border-primary p-8 rounded-2xl shadow-[0_0_50px_rgba(54,255,143,0.3)] text-center max-w-sm">
                        <ShieldAlert className="w-16 h-16 text-primary mx-auto mb-4" />
                        <h2 className="text-2xl font-bold glow-text text-foreground mb-2">Cascade Neutralized</h2>
                        <div className="text-4xl font-mono font-black text-primary mb-2">340</div>
                        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">Invoices Blocked</p>

                        <div className="p-4 bg-muted/30 rounded-xl border border-primary/20 mb-6">
                            <div className="text-sm text-foreground mb-1">Total Exposure Prevented</div>
                            <div className="text-2xl font-mono text-primary font-bold">$47,500,000</div>
                        </div>

                        <button onClick={reset} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-primary/30 text-primary hover:bg-primary/10 transition-colors font-bold uppercase tracking-wider text-sm">
                            <RotateCcw className="w-4 h-4" /> Reset Simulation
                        </button>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                    <h2 className="text-lg font-semibold text-foreground glow-text flex items-center gap-2">
                        <Activity className="w-5 h-5 text-destructive" />
                        Attack Simulator
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Stress-test defense algorithms</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center space-y-8 relative z-10">

                {phase === 'idle' && (
                    <button
                        onClick={() => setPhase('injecting')}
                        className="group relative px-8 py-5 rounded-2xl bg-destructive/10 border-2 border-destructive/50 text-destructive hover:bg-destructive hover:text-white transition-all duration-300 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-destructive/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        <div className="relative z-10 flex flex-col items-center gap-2">
                            <Play className="w-8 h-8 mb-1" />
                            <div className="font-bold tracking-widest uppercase text-lg">Inject Phantom Cascade</div>
                            <div className="text-xs opacity-80 font-mono">Launch T3 Automated Attack Vector</div>
                        </div>
                    </button>
                )}

                {phase === 'injecting' && (
                    <div className="flex flex-col items-center animate-pulse">
                        <Activity className="w-12 h-12 text-destructive mb-4" />
                        <div className="text-xl font-bold text-destructive tracking-widest uppercase">Breach Initiated...</div>
                        <div className="text-sm text-muted-foreground font-mono mt-2">Flooding network with synthetic invoices</div>
                    </div>
                )}

                {phase === 'catching' && (
                    <div className="flex flex-col items-center w-full max-w-xs">
                        <CheckCircle2 className="w-12 h-12 text-primary mb-4 animate-bounce" />
                        <div className="text-xl font-bold text-primary tracking-widest uppercase mb-4">AI Defense Active</div>

                        <div className="w-full bg-muted rounded-full h-4 mb-2 overflow-hidden border border-border">
                            <div className="bg-primary h-full transition-all duration-100 glow-border" style={{ width: `${(invoicesProcessed / 340) * 100}%` }}></div>
                        </div>

                        <div className="flex justify-between w-full text-sm font-mono text-muted-foreground mb-4">
                            <span>Intercepting</span>
                            <span className="text-primary font-bold">{invoicesProcessed} / 340</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
