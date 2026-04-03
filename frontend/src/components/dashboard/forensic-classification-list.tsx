import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    ShieldAlert, 
    AlertTriangle, 
    Info, 
    Search, 
    ArrowUpRight, 
    Calendar,
    Hash,
    Building2,
    CheckCircle2
} from "lucide-react";

interface Alert {
    id: number;
    invoice_id: number;
    invoice_number: string;
    lender_id: number;
    severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'BLOCKED';
    fraud_rule: string;
    message: string;
    created_at: string;
    supplier_id: number;
    buyer_id: number;
    resolved: boolean;
}

export function ForensicClassificationList({ onSelectAlert }: { onSelectAlert: (dbId: number) => void }) {
    const [searchTerm, setSearchTerm] = useState("");

    const { data: alerts, isLoading } = useQuery<Alert[]>({
        queryKey: ['dashboard-alerts'],
        queryFn: async () => {
            const res = await fetch('/api/dashboard/alerts');
            if (!res.ok) throw new Error('Failed to fetch forensic alerts');
            return res.json();
        }
    });

    if (isLoading) {
        return (
            <div className="h-full w-full bg-card rounded-2xl border border-border/50 glow-card p-6 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="text-primary glow-text font-mono text-xs uppercase tracking-widest">Scanning Forensic Logs...</span>
            </div>
        );
    }

    const filteredAlerts = alerts?.filter(a => 
        a.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.fraud_rule.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.message.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'CRITICAL':
            case 'BLOCKED':
                return 'bg-destructive/10 text-destructive border-destructive/20 active-glow-red';
            case 'WARNING':
                return 'bg-warning/10 text-warning border-warning/20 active-glow-orange';
            default:
                return 'bg-primary/10 text-primary border-primary/20 active-glow-green';
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'CRITICAL':
            case 'BLOCKED':
                return <ShieldAlert className="w-4 h-4" />;
            case 'WARNING':
                return <AlertTriangle className="w-4 h-4" />;
            default:
                return <Info className="w-4 h-4" />;
        }
    };

    return (
        <div className="h-full w-full bg-card rounded-2xl border border-border/50 glow-card flex flex-col overflow-hidden relative">
            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <ShieldAlert className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold tracking-widest uppercase text-foreground">Forensic Classification Findings</h3>
                        <p className="text-[10px] text-muted-foreground font-mono">Cross-portfolio anomaly detection stream</p>
                    </div>
                </div>
                <div className="relative">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search Rules/Invoices..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-background/50 border border-border rounded-full pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground w-64 transition-all hover:bg-muted"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-4 space-y-3">
                {filteredAlerts.length > 0 ? (
                    filteredAlerts.map((alert) => (
                        <div 
                            key={alert.id}
                            onClick={() => onSelectAlert(alert.invoice_id)}
                            className="bg-background/30 border border-border/40 rounded-xl p-4 hover:border-primary/40 transition-all cursor-pointer group relative overflow-hidden"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border flex items-center gap-1 ${getSeverityStyles(alert.severity)}`}>
                                            {getSeverityIcon(alert.severity)}
                                            {alert.severity}
                                        </span>
                                        <span className="text-[10px] font-bold text-primary font-mono lowercase tracking-tight">
                                            {alert.fraud_rule.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1 font-mono">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(alert.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    
                                    <h4 className="text-xs font-bold text-foreground mb-1 flex items-center gap-2">
                                        <Hash className="w-3 h-3 text-muted-foreground" />
                                        {alert.invoice_number}
                                    </h4>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 italic mb-3">
                                        {alert.message}
                                    </p>

                                    <div className="flex items-center gap-4 border-t border-border/30 pt-3">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <Building2 className="w-3 h-3 text-muted-foreground" />
                                            <span className="text-[10px] text-muted-foreground truncate font-mono uppercase tracking-tighter">SID: {alert.supplier_id}</span>
                                        </div>
                                        {alert.resolved ? (
                                            <div className="flex items-center gap-1 text-[10px] text-primary font-bold uppercase tracking-widest ml-auto">
                                                <CheckCircle2 className="w-3 h-3" />
                                                RESOLVED
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 ml-auto">
                                                ANALYZE FINDING <ArrowUpRight className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="h-40 flex flex-col items-center justify-center text-center p-8 bg-muted/10 rounded-2xl border border-dashed border-border/50">
                        <CheckCircle2 className="w-8 h-8 text-primary mb-2 opacity-50" />
                        <p className="text-xs text-muted-foreground font-mono">Zero classified anomalies in the current monitoring window.</p>
                    </div>
                )}
            </div>

            <style>{`
                .active-glow-red { box-shadow: inset 0 0 10px rgba(239, 68, 68, 0.1); }
                .active-glow-orange { box-shadow: inset 0 0 10px rgba(245, 158, 11, 0.1); }
                .active-glow-green { box-shadow: inset 0 0 10px rgba(54, 255, 143, 0.1); }
            `}</style>
        </div>
    );
}
