import { Fingerprint } from "lucide-react";

export function FraudDnaCard() {
    const typologies = [
        { label: "Carousel Trade", match: 94, isPrimary: true },
        { label: "Over-Invoicing", match: 42, isPrimary: false },
        { label: "Phantom Invoice", match: 12, isPrimary: false }
    ];

    const primary = typologies.find(t => t.isPrimary);

    return (
        <div className="bg-card rounded-2xl p-6 glow-card border border-destructive/20 h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div>
                    <h2 className="text-lg font-semibold text-foreground glow-text flex items-center gap-2">
                        <Fingerprint className="w-5 h-5 text-destructive" />
                        Fraud DNA Classifier
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Multi-factor typology matching</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-6 relative z-10">
                <div className="text-center p-4 rounded-xl border border-destructive/30 bg-destructive/10">
                    <div className="text-xs font-bold uppercase tracking-wider text-destructive mb-1">Primary Signature Detected</div>
                    <div className="text-xl font-black tracking-tight text-foreground">{primary?.label}</div>
                    <div className="text-sm font-mono text-destructive mt-1">{primary?.match}% Match Confidence</div>
                </div>

                <div className="space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Typology Vector Scores</div>
                    {typologies.map((t, i) => (
                        <div key={i} className="flex items-center gap-4">
                            <div className="w-32 text-xs font-medium text-foreground truncate">{t.label}</div>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full ${t.isPrimary ? 'bg-destructive glow-border' : 'bg-primary/50'}`} style={{ width: `${t.match}%` }}></div>
                            </div>
                            <div className="text-xs font-mono font-bold w-10 text-right">{t.match}%</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
