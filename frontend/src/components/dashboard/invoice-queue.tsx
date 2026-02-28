import { useInvoiceQueue } from "@/hooks/use-dashboard-data";
import { FileText, ArrowUpRight, Search } from "lucide-react";

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

export function InvoiceQueue() {
    const { data: queue, isLoading } = useInvoiceQueue();

    if (isLoading || !queue) {
        return (
            <div className="h-full w-full bg-card rounded-2xl border border-border/50 glow-card p-6 flex items-center justify-center">
                <span className="text-primary glow-text font-mono">LOADING QUEUE...</span>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-card rounded-2xl border border-border/50 glow-card flex flex-col overflow-hidden">
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
                        {queue.map((invoice, idx) => (
                            <tr
                                key={invoice.id}
                                className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? 'bg-background/20' : ''}`}
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
        </div>
    );
}
