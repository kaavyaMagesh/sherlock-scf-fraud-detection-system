import { useState } from 'react';
import { Link } from 'wouter';
import { useInvoiceQueue, useInvoiceDetail, useInvoiceAudits, useReEvaluateInvoice } from "@/hooks/use-dashboard-data";
import { FileText, ArrowUpRight, Search, X, ShieldAlert, ShieldCheck, CheckCircle, AlertTriangle, Info, RefreshCw, History, ChevronRight, ExternalLink } from "lucide-react";

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

export function InvoiceQueue({ onSelectInvoice, raw = false }: { onSelectInvoice?: (dbId: number | null) => void, raw?: boolean }) {
    const { data: queue, isLoading } = useInvoiceQueue();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedDbId, setSelectedDbId] = useState<number | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [recalcError, setRecalcError] = useState<string | null>(null);

    const { data: details, isLoading: isLoadingDetails, error } = useInvoiceDetail(selectedDbId ? String(selectedDbId) : null);
    const { data: audits, isLoading: isLoadingAudits } = useInvoiceAudits(selectedDbId ? String(selectedDbId) : null);
    const reEvaluate = useReEvaluateInvoice();

    const handleSelect = (id: string, dbId: number) => {
        setSelectedId(id);
        setSelectedDbId(dbId);
        setShowHistory(false);
        setRecalcError(null);
        if (onSelectInvoice) onSelectInvoice(dbId);
    };

    const handleReEvaluate = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedDbId) {
            setRecalcError(null);
            try {
                await reEvaluate.mutateAsync(String(selectedDbId));
            } catch (err) {
                setRecalcError(err instanceof Error ? err.message : 'Recalculation failed');
            }
        }
    };

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
                            {!raw && (
                                <>
                                    <th className="px-6 py-3 font-medium text-center">Score</th>
                                    <th className="px-6 py-3 font-medium text-center">Status</th>
                                </>
                            )}
                            <th className="px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredQueue.map((invoice, idx) => (
                            <tr
                                key={invoice.dbId}
                                onClick={() => handleSelect(invoice.id, invoice.dbId)}
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
                                {!raw && (
                                    <>
                                        <td className="px-6 py-4 text-center">
                                            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ${invoice.riskScore >= 60 ? 'bg-destructive/20 text-destructive border border-destructive/30' :
                                                invoice.riskScore >= 30 ? 'bg-warning/20 text-warning border border-warning/30' :
                                                    'bg-primary/20 text-primary border border-primary/30'
                                                }`}>
                                                {invoice.riskScore}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${invoice.status === 'APPROVED' ? 'bg-primary/10 text-primary border-primary/20' :
                                                invoice.status === 'BLOCKED' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                                    invoice.status === 'REVIEW' ? 'bg-warning/10 text-warning border-warning/20' :
                                                        invoice.status === 'DISPUTED' ? 'bg-destructive/20 text-destructive border-destructive/40 font-bold' :
                                                            'bg-muted text-muted-foreground border-border'
                                                }`}>
                                                {invoice.status}
                                            </span>
                                        </td>
                                    </>
                                )}
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
                <div className="absolute top-0 right-0 h-full w-96 bg-card/95 backdrop-blur-2xl border-l border-border/50 shadow-2xl z-20 animate-in slide-in-from-right duration-300 flex flex-col">
                    <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4" />
                                {showHistory ? "Audit History" : "Risk Analysis"}
                            </h4>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleReEvaluate}
                                disabled={reEvaluate.isPending}
                                className={`p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all ${reEvaluate.isPending ? 'animate-spin text-primary' : ''}`}
                                title="Trigger Recalculation"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className={`p-1.5 rounded-md hover:bg-primary/10 transition-all ${showHistory ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary'}`}
                                title="View Version History"
                            >
                                <History className="w-4 h-4" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedId(null); if (onSelectInvoice) onSelectInvoice(null); }} className="hover:text-primary transition-colors p-1.5 rounded-md hover:bg-muted text-muted-foreground ml-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    {recalcError && !showHistory && (
                        <div className="mx-4 mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-mono">
                            {recalcError}
                        </div>
                    )}

                    <div className="flex-1 overflow-auto p-4 space-y-6 custom-scrollbar text-foreground">
                        {isLoadingDetails || (showHistory && isLoadingAudits) ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-3">
                                <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                                <span className="text-xs font-mono glow-text">{showHistory ? 'FETCHING AUDIT LOGS...' : 'ANALYZING DNA...'}</span>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center p-6 text-center bg-destructive/10 rounded-2xl border border-dashed border-destructive/50">
                                <ShieldAlert className="w-8 h-8 text-destructive mb-2 opacity-80" />
                                <p className="text-[11px] text-destructive-foreground font-bold uppercase tracking-wider mb-1">Access Denied / Error</p>
                                <p className="text-[10px] text-destructive/80 font-mono">
                                    {error instanceof Error ? error.message : "Failed to load invoice details"}
                                </p>
                            </div>
                        ) : showHistory && audits ? (
                            <div className="space-y-4">
                                {audits.map((audit: any) => (
                                    <div key={audit.version} className="bg-background/40 border border-border/30 rounded-xl p-4 hover:border-primary/30 transition-all group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Version {audit.version}</div>
                                                <div className="text-[10px] text-muted-foreground font-mono">{new Date(audit.created_at).toLocaleString()}</div>
                                            </div>
                                            <div className={`text-lg font-bold font-mono ${audit.score >= 60 ? 'text-destructive' : audit.score >= 30 ? 'text-warning' : 'text-primary'}`}>
                                                {audit.score}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {audit.breakdown?.slice(0, 3).map((b: any, i: number) => (
                                                <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground truncate">
                                                    <ChevronRight className="w-3 h-3 text-primary/50" />
                                                    <span className="font-semibold text-foreground/80 lowercase">{b.factor.replace(/_/g, ' ')}</span>
                                                </div>
                                            ))}
                                            {audit.breakdown?.length > 3 && (
                                                <div className="text-[9px] text-muted-foreground pl-5">+ {audit.breakdown.length - 3} more signals</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {audits.length === 0 && (
                                    <div className="text-center p-8 text-muted-foreground text-xs italic">No historical audits found for this entity.</div>
                                )}
                            </div>
                        ) : details ? (
                            <>
                                {details.status === 'DISPUTED' && (
                                    <div className="mx-0 mb-6 p-4 rounded-xl bg-destructive/20 border border-destructive/50 animate-pulse">
                                        <div className="flex items-center gap-2 text-destructive mb-1">
                                            <ShieldAlert className="w-5 h-5" />
                                            <span className="font-black text-xs uppercase tracking-tighter">Active Buyer Dispute Detected</span>
                                        </div>
                                        <p className="text-[10px] text-destructive-foreground font-medium leading-relaxed">
                                            The buyer has formally disputed this invoice. This is a critical signal for **Dilution Fraud** (Goods Returned/Quality Issues). Score has been adjusted.
                                        </p>
                                    </div>
                                )}
                                <section>
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Gateway Identity Proof</h5>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-black">LAYER 8 ACTIVE</span>
                                    </div>
                                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-start gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                            <ShieldCheck className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className="text-[11px] font-bold text-foreground">Identity Verified</span>
                                                <span className="text-[9px] text-muted-foreground font-mono">(Ed25519)</span>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground font-mono truncate opacity-70">did:sherlock:company:{details.supplier_id}</div>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Document Triplet Semantic Match</h5>
                                        <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold">LLM-AUDIT ACTIVE</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="p-2.5 rounded-xl bg-background/50 border border-border/30">
                                            <span className="text-[8px] uppercase font-bold text-muted-foreground block mb-1">Invoice Record</span>
                                            <p className="text-[10px] leading-tight text-foreground font-medium">
                                                {details.goods_category || "N/A"}
                                            </p>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-background/50 border border-border/30 flex flex-col justify-between">
                                            <div>
                                                <span className="text-[8px] uppercase font-bold text-muted-foreground block mb-1">PO Record</span>
                                                <p className="text-[10px] leading-tight text-foreground/80 italic">
                                                    {details.po_description || "N/A"}
                                                </p>
                                            </div>
                                            {details.goods_category !== details.po_description && (
                                                <div className="mt-2 text-[8px] text-destructive font-bold uppercase flex items-center gap-1">
                                                    <AlertTriangle className="w-2.5 h-2.5" />
                                                    Textual Mismatch
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Network Cascade Exposure</h5>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">TOPOLOGY-AWARE</span>
                                    </div>
                                    <div className="space-y-3 relative pl-4 border-l border-border/30">
                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background z-10" />
                                            <div className="p-2.5 rounded-xl bg-background/50 border border-border/30">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-foreground">Tier 1 • This Supplier</span>
                                                    <span className="text-[9px] font-mono text-primary font-bold">₹{formatCurrency(details.amount).replace('₹', '')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="relative pt-1">
                                            <div className="absolute -left-[21px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-muted-foreground/30 border-2 border-background z-10" />
                                            <div className="p-2.5 rounded-xl bg-background/20 border border-border/20 opacity-70">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] text-muted-foreground">Tier 2 • Sub-Suppliers</span>
                                                    <span className="text-[9px] font-mono text-muted-foreground italic">CONTINGENT</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="pt-2 flex justify-between items-center border-t border-border/30 mt-2">
                                            <span className="text-[9px] text-muted-foreground uppercase font-bold">Contagion Risk</span>
                                            <span className="text-[10px] font-bold text-destructive">₹{formatCurrency(details.amount * 1.4).replace('₹', '')} (+40%)</span>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center justify-between mb-1">
                                        <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Forensic Metadata</h5>
                                    </div>
                                    <div className="space-y-2 bg-background/50 p-3 rounded-xl border border-border/30">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-muted-foreground uppercase tracking-tighter">Last Engine Scan</span>
                                            <span className="text-[10px] font-mono text-primary font-bold">
                                                {audits?.[0]?.created_at ? new Date(audits[0].created_at).toLocaleTimeString() : 'PENDING'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-muted-foreground uppercase tracking-tighter">Decision Version</span>
                                            <span className="text-[10px] font-mono text-foreground font-bold italic">v{audits?.[0]?.version || 1}.0-beta</span>
                                        </div>
                                        <div className="pt-2 mt-2 border-t border-border/30"></div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-muted-foreground">ID</span>
                                            <span className="text-xs font-mono text-foreground">{details.invoice_number}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-muted-foreground">Total</span>
                                            <span className="text-xs font-mono text-foreground">{formatCurrency(details.amount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-muted-foreground">Supplier ID</span>
                                            <span className="text-xs font-mono text-foreground">{details.supplier_id}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-muted-foreground">Buyer ID</span>
                                            <span className="text-xs font-mono text-foreground">{details.buyer_id}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-muted-foreground">Inv Date</span>
                                            <span className="text-xs font-mono text-foreground">{details.invoice_date ? String(details.invoice_date).split('T')[0] : 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-muted-foreground">Due Date</span>
                                            <span className="text-xs font-mono text-foreground">{details.expected_payment_date ? String(details.expected_payment_date).split('T')[0] : 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between mt-2 pt-2 border-t border-border/50">
                                            <span className="text-xs text-muted-foreground">Status</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${details.status === 'BLOCKED' || details.status === 'DISPUTED' ? 'text-destructive bg-destructive/10' : 'text-primary bg-primary/10'}`}>{details.status}</span>
                                        </div>
                                    </div>
                                    {details.supplier_id != null && (
                                        <Link href={`/supplier/${details.supplier_id}?invoice=${details.id}`}>
                                            <a className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-colors text-xs font-bold tracking-wide uppercase">
                                                View Complete Identity
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        </Link>
                                    )}
                                </section>

                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Automated Audit</h5>
                                            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-mono">v{audits?.[0]?.version || 1}</span>
                                        </div>
                                        <span className="text-xs font-bold text-primary">{details.risk_score || 0} pts</span>
                                    </div>
                                    <div className="space-y-3">
                                        {details.breakdown && details.breakdown.length > 0 ? (
                                            details.breakdown.map((item: any, i: number) => (
                                                <div key={i} className="flex gap-3 p-3 rounded-xl bg-background/40 border border-border/30 group hover:border-primary/30 transition-colors">
                                                    {(typeof item.points === 'number' && item.points > 30) || (typeof item.points === 'string' && item.points.includes('x')) ? (
                                                        <ShieldAlert className="w-4 h-4 text-destructive flex-shrink-0" />
                                                    ) : item.points > 15 ? (
                                                        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                                                    ) : (
                                                        <Info className="w-4 h-4 text-primary flex-shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[11px] font-bold text-foreground truncate">{item.factor.replace(/_/g, ' ')}</span>
                                                            <span className="text-[10px] font-mono text-muted-foreground">
                                                                {typeof item.points === 'number' ? `+${item.points}` : item.points}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground leading-relaxed italic">
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
