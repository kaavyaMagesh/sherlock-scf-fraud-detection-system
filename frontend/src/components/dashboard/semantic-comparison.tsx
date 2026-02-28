import { FileText, Cpu, AlertTriangle } from "lucide-react";

export function SemanticComparison() {
    return (
        <div className="bg-card rounded-2xl p-6 glow-card border border-warning/30 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-foreground glow-text flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-warning" />
                        Semantic Verification
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">AI Document Consistency Check</p>
                </div>
                <div className="px-3 py-1 bg-warning/10 border border-warning/20 text-warning text-xs font-bold rounded-full flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    Mismatch Detected
                </div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4">
                {/* Left Doc */}
                <div className="bg-background/50 border border-border/50 rounded-xl p-4 flex flex-col">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2 border-b border-border/50 pb-2">
                        <FileText className="w-3 h-3" /> Root PO #1002
                    </div>
                    <div className="text-sm text-foreground/80 font-mono leading-relaxed mt-2 flex-1 relative z-0">
                        "Supply of <span className="bg-primary/20 text-primary px-1 rounded">High-grade Industrial Steel Tubes (Spec 44-B)</span> for structural reinforcement."
                    </div>
                </div>

                {/* Right Doc */}
                <div className="bg-warning/5 border border-warning/30 rounded-xl p-4 flex flex-col relative">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2 border-b border-border/50 pb-2">
                        <FileText className="w-3 h-3 text-warning" /> Invoice #841
                    </div>
                    <div className="text-sm text-foreground/80 font-mono leading-relaxed mt-2 flex-1 relative z-10">
                        "Services rendered and <div className="inline-block relative group">
                            <span className="bg-warning/20 text-warning px-1 rounded border-b border-warning border-dashed cursor-help">assorted metal scrap</span>
                            <div className="absolute top-full left-0 mt-2 w-56 bg-card border border-border rounded-lg p-3 text-xs text-foreground shadow-xl hidden group-hover:block z-50">
                                <span className="text-warning font-bold mb-1 block">LLM Flag:</span> Vague description 'assorted metal scrap' semantically contradicts specific PO goods 'high-grade steel tubes'.
                            </div>
                        </div> material."
                    </div>
                </div>
            </div>

            <div className="mt-4 p-3 bg-muted/20 border border-border/50 rounded-lg text-xs leading-relaxed text-muted-foreground">
                <span className="font-bold text-warning">Reasoning:</span> The invoice description is unusually vague and implies lower-grade materials compared to the precise specification in the Root PO. This is a common indicator of a Phantom Invoice.
            </div>
        </div>
    )
}
