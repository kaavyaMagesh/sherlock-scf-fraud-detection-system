import { useState } from "react";
import { 
    CheckCircle2, 
    AlertTriangle, 
    ShieldCheck, 
    Database, 
    Network, 
    BrainCircuit, 
    Fingerprint,
    Play,
    RotateCcw,
    ChevronRight,
    Activity
} from "lucide-react";

type FraudType = 'inflation' | 'duplicate' | 'bot' | 'carousel';
type SimulationMode = 'healthy' | 'fraudulent';

interface Step {
    id: number;
    title: string;
    description: string;
    icon: React.ElementType;
}

const steps: Step[] = [
    { 
        id: 1, 
        title: "Digital Ingestion & Fingerprinting", 
        description: "Generating cryptographic SHA-256 fingerprint for duplicate detection.", 
        icon: Fingerprint 
    },
    { 
        id: 2, 
        title: "Identity Gateway (W3C Check)", 
        description: "Verifying DIDs & Verifiable Credentials from the trust ledger.", 
        icon: ShieldCheck 
    },
    { 
        id: 3, 
        title: "Triple-Match Logic (Audit)", 
        description: "Validating PO (Purchase Order) vs GRN (Goods Receipt) vs Invoice amounts.", 
        icon: Database 
    },
    { 
        id: 4, 
        title: "Graph Correlation Service", 
        description: "Scanning for N-hop circular cycles and hidden shell dependencies.", 
        icon: Network 
    },
    { 
        id: 5, 
        title: "Neural Risk Scoring", 
        description: "Applying 20+ weighted signals including velocity and payment behaviors.", 
        icon: BrainCircuit 
    },
    { 
        id: 6, 
        title: "Consensus System Verdict", 
        description: "Final block/approval based on weighted heuristic consensus.", 
        icon: CheckCircle2 
    }
];

export function UnifiedSimulator() {
    const [mode, setMode] = useState<SimulationMode>('healthy');
    const [selectedFrauds, setSelectedFrauds] = useState<Set<FraudType>>(new Set());
    const [amount, setAmount] = useState(45000);
    const [isRunning, setIsRunning] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [logs, setLogs] = useState<{msg: string, status: 'ok' | 'fail' | 'working'}[]>([]);
    const [result, setResult] = useState<'approved' | 'blocked' | null>(null);
    const [finalScore, setFinalScore] = useState(0);

    const toggleFraud = (type: FraudType) => {
        const newSet = new Set(selectedFrauds);
        if (newSet.has(type)) newSet.delete(type);
        else newSet.add(type);
        setSelectedFrauds(newSet);
    };

    const calculateCompositeScore = () => {
        if (mode === 'healthy') return 10;
        
        let score = 10; // Start with user-defined baseline
        if (selectedFrauds.has('bot')) score += 20;
        if (selectedFrauds.has('carousel')) score += 25;
        if (selectedFrauds.has('inflation')) score += 30;
        if (selectedFrauds.has('duplicate')) score += 50;
        
        return Math.min(score, 99);
    };

    const getStepExplanation = (stepId: number, frauds: Set<FraudType>, amt: number) => {
        const isHealthy = mode === 'healthy';
        const formattedAmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);
        const inflationAmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt * 1.25);
        
        switch (stepId) {
            case 1:
                if (!isHealthy && frauds.has('duplicate')) return { msg: `HASH COLLISION: Exact match found with transaction ID #4412-B.`, status: 'fail' };
                return { msg: `OK: Unique trace fingerprint [${Math.random().toString(16).slice(2, 10)}] generated.`, status: 'ok' };
            case 2:
                return { msg: `SUCCESS: Digital Identities & VC signatures validated via Ledger-Node-4.`, status: 'ok' };
            case 3:
                if (!isHealthy && frauds.has('inflation')) return { msg: `AUDIT FAIL: Invoice (${inflationAmt}) significantly exceeds GRN matching value (${formattedAmt}).`, status: 'fail' };
                return { msg: `MATCH: Zero-delta between PO, GRN, and Invoice values confirmed at ${formattedAmt}.`, status: 'ok' };
            case 4:
                if (!isHealthy && frauds.has('carousel')) return { msg: `LOOP DETECTED: Supplier-Buyer-Lender path analysis reveals a closed circular loop.`, status: 'fail' };
                return { msg: `CLEAN: Relational graph validated. No cyclic dependencies in current 3-hop view.`, status: 'ok' };
            case 5:
                if (!isHealthy && frauds.has('bot')) return { msg: `ANOMALY: Input velocity exceeds 40req/sec from the source origin.`, status: 'fail' };
                return { msg: `STABLE: Scoring engine confirms normal temporal patterns for this entity.`, status: 'ok' };
            case 6:
                const isBlocked = !isHealthy && frauds.size > 0;
                return { msg: isBlocked ? `QUARANTINE: Reject consensus reached due to multi-pattern risk detection.` : `APPROVED: All gates passed successfully. Transmitting for disbursement.`, status: isBlocked ? 'fail' : 'ok' };
            default: return { msg: 'Scanning...', status: 'working' };
        }
    };

    const runSimulation = async () => {
        setIsRunning(true);
        setCurrentStep(1);
        setLogs([]);
        setResult(null);

        for (let i = 1; i <= 6; i++) {
            setCurrentStep(i);
            const explanation = getStepExplanation(i, selectedFrauds, amount);
            
            setLogs(prev => [...prev, { msg: `Executing Gate #0${i}...`, status: 'working' }]);
            await new Promise(r => setTimeout(r, 1200));
            
            setLogs(prev => {
                const newLogs = [...prev];
                newLogs[i-1] = explanation as any;
                return newLogs;
            });
            
            await new Promise(r => setTimeout(r, 400));
        }

        const score = calculateCompositeScore();
        setFinalScore(score);
        
        if (score < 30) setResult('approved');
        else if (score > 60) setResult('blocked');
        else setResult(null); // Wait for manual decision in 30-60 range

        setIsRunning(false);
    };

    const handleManualDecision = (decision: 'approved' | 'blocked') => {
        setResult(decision);
    };

    const reset = () => {
        setIsRunning(false);
        setCurrentStep(0);
        setLogs([]);
        setResult(null);
        setFinalScore(0);
        setSelectedFrauds(new Set());
        setMode('healthy');
    };

    return (
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden flex flex-col lg:flex-row h-full">
            {/* Control Panel */}
            <div className="w-full lg:w-96 border-r border-border/50 p-6 flex flex-col relative z-10 bg-muted/5">
                <div className="mb-6">
                    <h2 className="text-xl font-bold glow-text flex items-center gap-2">
                        <Activity className="w-5 h-5 text-primary" />
                        Risk Engine Studio
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 tracking-tight">Manual Execution Trace</p>
                </div>

                <div className="flex-1 space-y-6">
                    {/* Mode Selector */}
                    <div className="p-1 bg-background/50 border border-border rounded-xl flex gap-1">
                        <button 
                            onClick={() => { if (!isRunning) { setMode('healthy'); setSelectedFrauds(new Set()); }}}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'healthy' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Healthy Baseline
                        </button>
                        <button 
                            onClick={() => { if (!isRunning) setMode('fraudulent'); }}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'fraudulent' ? 'bg-destructive text-white shadow-sm shadow-destructive/20' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Inject Violations
                        </button>
                    </div>

                    <div className="space-y-4">
                        <label className={`text-[10px] font-black uppercase tracking-widest ${mode === 'healthy' ? 'opacity-20' : 'text-muted-foreground'}`}>
                           {mode === 'healthy' ? 'Violations Disabled' : 'Select Patterns to Inject'}
                        </label>
                        
                        <div className={`space-y-2 transition-opacity duration-500 ${mode === 'healthy' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                            {[
                                { id: 'inflation', label: 'Triple-Match Inflation', desc: '+30 Risk Index', color: 'text-warning' },
                                { id: 'duplicate', label: 'Exact Hash Collision', desc: '+50 Risk Index', color: 'text-destructive' },
                                { id: 'bot', label: 'Velocity Submission', desc: '+20 Risk Index', color: 'text-orange-400' },
                                { id: 'carousel', label: 'Carousel Trace', desc: '+25 Risk Index', color: 'text-purple-400' }
                            ].map((fraud) => (
                                <div 
                                    key={fraud.id}
                                    onClick={() => toggleFraud(fraud.id as FraudType)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                                        selectedFrauds.has(fraud.id as FraudType) 
                                        ? 'bg-primary/10 border-primary/40' 
                                        : 'bg-background/20 border-border/50 hover:bg-background/40'
                                    }`}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedFrauds.has(fraud.id as FraudType) ? 'bg-primary border-primary' : 'border-border'}`}>
                                        {selectedFrauds.has(fraud.id as FraudType) && <CheckCircle2 className="w-2.5 h-2.5 text-primary-foreground font-black" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className={`text-[11px] font-bold ${fraud.color}`}>{fraud.label}</div>
                                        <div className="text-[9px] text-muted-foreground">{fraud.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-border/30">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Trace Amount (₹)</label>
                        <input 
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            disabled={isRunning}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                </div>

                <div className="mt-6">
                    {!isRunning && result ? (
                        <button 
                            onClick={reset}
                            className="w-full py-4 rounded-xl border border-primary/30 text-primary font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-primary/5 transition-all"
                        >
                            <RotateCcw className="w-4 h-4" /> Reset Workshop
                        </button>
                    ) : (
                        <button 
                            onClick={runSimulation}
                            disabled={isRunning || (mode === 'fraudulent' && selectedFrauds.size === 0)}
                            className="group relative w-full py-4 rounded-xl bg-primary/10 border-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-500 overflow-hidden disabled:opacity-50"
                        >
                            <div className="relative z-10 flex flex-col items-center gap-1">
                                <Play className={`w-5 h-5 ${isRunning ? 'animate-pulse' : ''}`} />
                                <div className="font-bold tracking-widest uppercase text-[10px]">
                                    {isRunning ? "Engine Running Trace..." : "Trace system execution"}
                                </div>
                            </div>
                        </button>
                    )}
                </div>
            </div>

            {/* Visualizer Area */}
            <div className="flex-1 flex flex-col min-h-[580px] relative">
                <div className="absolute inset-0 bg-grid-white/[0.01] pointer-events-none"></div>
                
                {/* Stepper Content */}
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar relative z-10">
                    <div className="max-w-xl mx-auto space-y-4">
                        {steps.map((step, idx) => {
                            const stepLog = logs[idx];
                            const isActive = currentStep === step.id;
                            const isFinished = stepLog !== undefined;
                            const isFailed = isFinished && stepLog.status === 'fail';
                            const isClean = isFinished && stepLog.status === 'ok';
                            const isPending = !isActive && !isFinished;

                            return (
                                <div 
                                    key={step.id}
                                    className={`relative flex gap-6 items-start transition-all duration-500 ${
                                        isPending ? 'opacity-20' : 'opacity-100'
                                    }`}
                                >
                                    {/* Icon Column */}
                                    <div className="relative flex flex-col items-center">
                                        <div className={`p-3 rounded-2xl border-2 transition-all duration-500 bg-card ${
                                            isActive ? 'border-primary shadow-[0_0_20px_rgba(54,255,143,0.3)] scale-110' : 
                                            isFailed ? 'border-destructive bg-destructive/10 animate-shake' :
                                            isClean ? 'border-primary/40 bg-primary/5' : 
                                            'border-border'
                                        }`}>
                                            {isFailed ? (
                                                <AlertTriangle className="w-5 h-5 text-destructive" />
                                            ) : (
                                                <step.icon className={`w-5 h-5 ${isActive ? 'text-primary' : isFinished ? 'text-primary/70' : 'text-muted-foreground'}`} />
                                            )}
                                        </div>
                                        {step.id < steps.length && (
                                            <div className={`w-0.5 h-10 my-1 transition-all duration-1000 ${
                                                isFinished ? 'bg-primary' : 'bg-border'
                                            }`}></div>
                                        )}
                                    </div>

                                    {/* Text Column */}
                                    <div className={`pt-1 flex-1 transition-all duration-500 ${isActive ? 'scale-[1.01]' : ''}`}>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-[10px] font-black font-mono text-muted-foreground uppercase tracking-[0.2em]">Gate 0{step.id}</span>
                                            {isActive && <span className="text-[10px] text-primary animate-pulse font-bold uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">Evaluating...</span>}
                                            {isFailed && <span className="text-[10px] text-destructive animate-pulse font-bold uppercase tracking-widest bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20">Violation Identified</span>}
                                            {isClean && <span className="text-[10px] text-primary font-bold uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded">Pass</span>}
                                        </div>
                                        <h3 className={`text-sm font-bold ${isFailed ? 'text-destructive' : isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {step.title}
                                        </h3>
                                        
                                        {isFinished && (
                                            <div className={`mt-2 p-2.5 rounded-xl border text-[11px] font-mono leading-relaxed transition-all duration-500 ${
                                                isFailed ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-muted/40 border-border/50 text-muted-foreground'
                                            }`}>
                                                <div className="flex gap-2 items-start">
                                                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                                    {stepLog.msg}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Final Result Overlay / Manual Decision Area */}
                {(result || (!isRunning && finalScore >= 30 && finalScore <= 60)) && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center p-8 bg-background/50 backdrop-blur-md animate-in fade-in zoom-in duration-500">
                        <div className={`max-w-md w-full p-8 rounded-3xl border-2 bg-card shadow-2xl text-center relative overflow-hidden transition-all duration-500 ${
                            result === 'approved' ? 'border-primary shadow-primary/20' : 
                            result === 'blocked' ? 'border-destructive shadow-destructive/20' :
                            'border-warning shadow-warning/20'
                        }`}>
                            <div className={`absolute top-0 left-0 w-full h-2 transition-all ${
                                result === 'approved' ? 'bg-primary' : 
                                result === 'blocked' ? 'bg-destructive' : 
                                'bg-warning'
                            }`}></div>
                            
                            <div className="mb-6 relative">
                                {result === 'approved' ? (
                                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto ring-8 ring-primary/5">
                                        <ShieldCheck className="w-8 h-8 text-primary" />
                                    </div>
                                ) : result === 'blocked' ? (
                                    <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto ring-8 ring-destructive/5">
                                        <AlertTriangle className="w-8 h-8 text-destructive animate-bounce" />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto ring-8 ring-warning/5 animate-pulse">
                                        <Activity className="w-8 h-8 text-warning" />
                                    </div>
                                )}
                            </div>

                            <h3 className={`text-4xl font-black mb-2 tracking-tighter ${
                                result === 'approved' ? 'text-primary' : 
                                result === 'blocked' ? 'text-destructive' : 
                                'text-warning'
                            }`}>
                                {result === 'approved' ? 'AUTO-APPROVED' : 
                                 result === 'blocked' ? 'BLOCK ENFORCED' : 
                                 'SUSPICIOUS ENTRY'}
                            </h3>
                            
                            <div className="flex flex-col items-center gap-1 mb-6">
                                <div className="text-6xl font-mono font-black text-foreground tabular-nums">{finalScore}</div>
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Aggregated Risk Magnitude</div>
                            </div>

                            <div className={`p-4 rounded-xl mb-6 border text-xs font-mono transition-all ${
                                result === 'approved' ? 'bg-primary/5 border-primary/20 text-primary' : 
                                result === 'blocked' ? 'bg-destructive/5 border-destructive/20 text-destructive' : 
                                'bg-warning/5 border-warning/20 text-warning'
                            }`}>
                                <div className="uppercase font-bold mb-1 opacity-70">Decision Logic</div>
                                {result === 'approved' ? "Transaction within risk tolerance. Disbursal authorized." : 
                                 result === 'blocked' ? "Critical violations identified. Funding restricted." : 
                                 "Medium risk detected. Manual oversight required for disbursal."}
                            </div>

                            {/* Financial Impact Section */}
                            <div className="mb-6 p-4 bg-muted/30 rounded-2xl border border-border/50">
                                <div className="flex flex-col items-center gap-1">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Impact Analysis</div>
                                    <div className={`text-xl font-black ${result === 'blocked' ? 'text-green-400' : 'text-foreground'}`}>
                                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)}
                                    </div>
                                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">
                                        {result === 'blocked' ? "Capital Protected (Loss Avoidance)" : "Authorized for Disbursement"}
                                    </div>
                                </div>
                            </div>

                            {!result && finalScore >= 30 && finalScore <= 60 ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => handleManualDecision('approved')}
                                        className="py-3 px-4 bg-primary text-primary-foreground font-bold rounded-xl text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
                                    >
                                        Override & Disburse
                                    </button>
                                    <button 
                                        onClick={() => handleManualDecision('blocked')}
                                        className="py-3 px-4 bg-destructive text-white font-bold rounded-xl text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-destructive/20"
                                    >
                                        Confirm Block
                                    </button>
                                </div>
                            ) : (
                                <button onClick={reset} className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-all hover:tracking-[0.4em]">
                                    Close Analysis Report
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both;
                }
            `}</style>
            {/* FINAL IMPACT SPLASH SCREEN (WOW FACTOR) */}
            {currentStep === 6 && (
                <div className="mt-8 animate-in zoom-in-95 fade-in duration-500">
                    <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 relative overflow-hidden text-center group hover:border-primary/40 transition-all">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-primary/10 transition-all" />
                        <ShieldCheck className="w-16 h-16 text-primary mx-auto mb-4 glow-text animate-pulse" />
                        <h3 className="text-4xl font-black text-foreground tracking-tighter mb-2 italic uppercase">Forensic Protection Achieved</h3>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.3em] mb-1">Capital Preservation</span>
                            <span className="text-6xl font-black text-primary glow-text font-mono">₹{(finalScore * 140000).toLocaleString('en-IN')}</span>
                        </div>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto mt-6 leading-relaxed">
                            Sherlock blocked this high-risk transaction in <span className="text-foreground font-bold">142ms</span>, preventing a potential contagion wave across {mode === 'fraudulent' ? selectedFrauds.size : 0} detected anomalies.
                        </p>

                        {/* WHAT-IF PORTFOLIO DELTA (MINI CHART) */}
                        <div className="mt-8 pt-8 border-t border-border/30 grid grid-cols-2 gap-8 items-center text-left">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <Activity className="w-3 h-3 text-primary" />
                                    What-If Portfolio Delta
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-[10px] mb-1">
                                            <span className="text-muted-foreground">Original Portfolio Risk</span>
                                            <span className="text-primary font-bold">12.4%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-primary w-[12.4%] shadow-sm" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[10px] mb-1">
                                            <span className="text-muted-foreground">If Disbursed (New Risk)</span>
                                            <span className="text-destructive font-bold">{(12.4 + finalScore / 10).toFixed(1)}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-destructive w-[24%]" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-background/40 rounded-2xl p-4 border border-border/30">
                                <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                                    "Approving this invoice would create a <span className="text-destructive font-bold">{(finalScore / 10).toFixed(1)}% surge</span> in non-performing asset risk. Sherlock's auto-block preserved <span className="text-primary font-bold">₹{(finalScore * 140000 / 10000000).toFixed(2)} Cr</span> in healthy capital."
                                </p>
                            </div>
                        </div>

                        {/* AUDITOR OVERRIDE SECTION */}
                        <div className="mt-8 pt-6 border-t border-border/20">
                            <button 
                                onClick={() => {
                                    const reason = prompt("Enter mandatory forensic reason for override:");
                                    if(reason) {
                                        setResult('approved');
                                        setFinalScore(5);
                                    }
                                }}
                                className="px-6 py-2 rounded-xl border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-all"
                            >
                                Trigger Auditor Override (Log Reason)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
