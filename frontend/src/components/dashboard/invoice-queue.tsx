import { useState } from 'react';
import { useInvoiceQueue, useInvoiceDetail } from "@/hooks/use-dashboard-data";
import { FileText, ArrowUpRight, Search, X, ShieldAlert, CheckCircle, AlertTriangle, Info } from "lucide-react";

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

export function InvoiceQueue() {
    const { data: queue, isLoading } = useInvoiceQueue();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedDbId, setSelectedDbId] = useState<number | null>(null);
    
    const { data: details, isLoading: isLoadingDetails } = useInvoiceDetail(selectedDbId ? String(selectedDbId) : null);

    if (isLoading || !queue) {
        return (
            <div className="h-full w-full bg-card rounded-2xl border border-border/50 glow-card p-6 flex items-center justify-center">
                <span className="text-primary glow-text font-mono">LOADING QUEUE...</span>
            </div>
        );
    }

    const filteredQueue = queue.filter(inv => 
        inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.supplier.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full w-full bg-card rounded-2xl border border-border/50 glow-card flex flex-col overflow-hidden relative">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
                <h3 className="text-lg font-medium tracking-tight text-foreground flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Live Invoice Queue
                </h3>
                <div className="relative">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search INV..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-muted/50 border border-border rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground w-48 transition-all hover:bg-muted"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-0">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/20 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th className="px-6 py-3 font-medium">Invoice ID</th>
                            <th className="px-6 py-3 font-medium">Supplier</th>
                            <th className="px-6 py-3 font-medium text-right">Amount</th>
                            <th className="px-6 py-3 font-medium text-center">Score</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredQueue.map((invoice, idx) => (
                            <tr
                                key={invoice.id}
                                onClick={() => {
                                    setSelectedId(invoice.id);
                                    setSelectedDbId(invoice.dbId);
                                }}
                                className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-background/20' : ''} ${selectedId === invoice.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                            >
                                <td className="px-6 py-4 font-mono font-medium text-foreground">
                                    {invoice.id}
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                    {invoice.supplier}
                                </td>
                                <td className="px-6 py-4 font-mono text-right">
                                    {formatCurrency(invoice.amount)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ${invoice.riskScore >= 60 ? 'bg-destructive/20 text-destructive border border-destructive/30' :
                                            invoice.riskScore >= 30 ? 'bg-warning/20 text-warning border border-warning/30' :
                                                'bg-primary/20 text-primary border border-primary/30'
                                        }`}>
                                        {invoice.riskScore}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider border ${invoice.status === 'APPROVED' ? 'bg-primary/10 text-primary border-primary/20' :
                                            invoice.status === 'BLOCKED' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                                invoice.status === 'UNDER REVIEW' ? 'bg-warning/10 text-warning border-warning/20' :
                                                    'bg-muted text-muted-foreground border-border'
                                        }`}>
                                        {invoice.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-md hover:bg-primary/10">
                                        <ArrowUpRight className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Risk Analysis Side Panel */}
            {selectedId && (
                <div className="absolute top-0 right-0 h-full w-80 bg-card/95 backdrop-blur-2xl border-l border-border/50 shadow-2xl z-20 animate-in slide-in-from-right duration-300 flex flex-col">
                    <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
                        <h4 className="font-bold text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4" />
                            Risk Analysis
                        </h4>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedId(null); }} className="hover:text-primary transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto p-4 space-y-6 custom-scrollbar">
                        {isLoadingDetails ? (
                            <div className="flex items-center justify-center h-20">
                                <span className="text-xs font-mono animate-pulse">Analyzing DNA...</span>
                            </div>
                        ) : details ? (
                            <>
                                <section>
                                    <h5 className="text-[10px] font-bold text-muted-foreground uppercase mb-3 tracking-widest">Metadata</h5>
                                    <div className="space-y-2 bg-background/50 p-3 rounded-xl border border-border/30">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-muted-foreground">ID</span>
                                            <span className="text-xs font-mono text-foreground">{details.invoice_number}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-muted-foreground">Total</span>
                                            <span className="text-xs font-mono text-foreground">{formatCurrency(details.amount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-muted-foreground">Status</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold bg-muted ${details.status === 'BLOCKED' ? 'text-destructive' : 'text-primary'}`}>{details.status}</span>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Automated Audit</h5>
                                        <span className="text-xs font-bold text-primary">{details.risk_score || 0} pts</span>
                                    </div>
                                    <div className="space-y-3">
                                        {details.breakdown && details.breakdown.length > 0 ? (
                                            details.breakdown.map((item: any, i: number) => (
                                                <div key={i} className="flex gap-3 p-3 rounded-xl bg-background/40 border border-border/30 group hover:border-primary/30 transition-colors">
                                                    {item.points > 30 ? (
                                                        <ShieldAlert className="w-4 h-4 text-destructive flex-shrink-0" />
                                                    ) : item.points > 15 ? (
                                                        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                                                    ) : (
                                                        <Info className="w-4 h-4 text-primary flex-shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[11px] font-bold text-foreground truncate">{item.factor.replace(/_/g, ' ')}</span>
                                                            <span className="text-[10px] font-mono text-muted-foreground">+{item.points}</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground leading-relaxed italic line-clamp-2">
                                                            {item.detail}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-6 text-center bg-background/20 rounded-2xl border border-dashed border-border/50">
                                                <CheckCircle className="w-8 h-8 text-primary mb-2 opacity-50" />
                                                <p className="text-[10px] text-muted-foreground">Verified Clean. No anomalies detected in current batch.</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {details.status === 'BLOCKED' && (
                                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
                                        <p className="text-[10px] text-destructive leading-relaxed">
                                            <strong>Recommendation:</strong> Automated Block. This invoice shows circular trade patterns or mismatching credentials. Do not disburse.
                                        </p>
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}
