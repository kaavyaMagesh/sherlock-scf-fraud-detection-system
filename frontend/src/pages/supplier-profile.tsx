import { useParams, Link } from "wouter";
import { ArrowLeft, Building2, ShieldCheck, ShieldAlert, Activity, FileText, Network } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useInvoiceDetail } from "@/hooks/use-dashboard-data";

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const API_BASE = "http://localhost:3000/api";
const getHeaders = () => ({
    "Content-Type": "application/json",
    "x-lender-id": localStorage.getItem("sherlock-lender-id") || "1"
});

export default function SupplierProfilePage() {
    const params = useParams<{ id: string }>();
    const id = params?.id || "1";
    const lenderId = localStorage.getItem("sherlock-lender-id") || "1";
    
    // Parse invoice context from URL
    const searchParams = new URLSearchParams(window.location.search);
    const invoiceId = searchParams.get("invoice");
    const { data: trxDetails } = useInvoiceDetail(invoiceId);

    const { data: companies = [] } = useQuery({
        queryKey: ["companies", lenderId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/identity/companies`, { headers: getHeaders() });
            if (!res.ok) throw new Error("Failed to fetch companies");
            return res.json();
        }
    });

    const { data: portfolio = [] } = useQuery({
        queryKey: ["supplier-portfolio", lenderId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/lender/${lenderId}/portfolio`, { headers: getHeaders() });
            if (!res.ok) throw new Error("Failed to fetch portfolio");
            return res.json();
        }
    });

    const { data: egoNetwork = [] } = useQuery({
        queryKey: ["supplier-ego", id, lenderId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/graph/ego/${id}`, { headers: getHeaders() });
            if (!res.ok) throw new Error("Failed to fetch ego network");
            return res.json();
        }
    });

    const { data: companyProfile } = useQuery({
        queryKey: ["company-profile", id, lenderId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/identity/companies/${id}/profile`, { headers: getHeaders() });
            if (!res.ok) throw new Error("Failed to fetch company profile");
            return res.json();
        }
    });

    const companyInvoices = useMemo(
        () => portfolio.filter(
            (inv: any) =>
                String(inv.supplier_id) === String(id) ||
                String(inv.buyer_id) === String(id)
        ),
        [portfolio, id]
    );

    const avgRisk = useMemo(() => {
        if (!companyInvoices.length) return 0;
        const total = companyInvoices.reduce((sum: number, inv: any) => sum + Number(inv.risk_score || 0), 0);
        return Math.round(total / companyInvoices.length);
    }, [companyInvoices]);

    const latestStatus = companyProfile?.status || companyInvoices[0]?.status || "APPROVED";
    const totalVolume = Number(companyProfile?.totalVolume || 0);
    const company = companies.find((c: any) => String(c.id) === String(id));

    const trendMap = useMemo(() => {
        const map = new Map<string, { month: string; scoreTotal: number; count: number }>();
        companyInvoices.forEach((inv: any) => {
            const d = new Date(inv.invoice_date);
            const month = d.toLocaleString("en-US", { month: "short" });
            const curr = map.get(month) || { month, scoreTotal: 0, count: 0 };
            curr.scoreTotal += Number(inv.risk_score || 0);
            curr.count += 1;
            map.set(month, curr);
        });
        return Array.from(map.values()).map((m) => ({
            month: m.month,
            score: Math.round(m.scoreTotal / Math.max(1, m.count))
        }));
    }, [companyInvoices]);

    const supplier = {
        id,
        name: companyProfile?.name || company?.name || `Supplier ${id}`,
        tier: `Tier ${companyProfile?.tier || company?.tier || 1}`,
        status: latestStatus,
        currentScore: Number(companyProfile?.maxRiskScore ?? companyProfile?.avgRiskScore ?? avgRisk),
        did: `did:sherlock:company:${id}`,
        kycStatus: latestStatus === "BLOCKED" ? "REVIEW" : "VERIFIED",
        totalVolume,
        activeInvoices: Number(companyProfile?.activeInvoices ?? companyInvoices.length)
    };

    const isBlocked = supplier.status === "BLOCKED";

    return (
        <div className="flex-1 overflow-auto bg-transparent p-4 md:p-8 custom-scrollbar">
            {/* Header */}
            <div className="mb-6 flex items-center gap-4">
                <Link href="/topology">
                    <button className="p-2 bg-card border border-border/50 rounded-full hover:bg-muted transition-colors">
                        <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                    </button>
                </Link>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-foreground glow-text tracking-tight">{supplier.name}</h1>
                        <span className={`px-2.5 py-0.5 rounded text-xs font-bold tracking-wider uppercase ${isBlocked ? 'bg-destructive/20 text-destructive border border-destructive/30' : 'bg-primary/20 text-primary border border-primary/30'}`}>
                            {supplier.status}
                        </span>
                    </div>
                    <div className="text-muted-foreground mt-1 font-mono text-xs flex items-center gap-3">
                        <span>{supplier.tier} Entity</span>
                        <span>•</span>
                        <span>DID: {supplier.did}</span>
                    </div>
                </div>
                <div className="ml-auto">
                    {!isBlocked && (
                        <button 
                            onClick={async () => {
                                if (confirm("DANGER: This will permanently revoke this company's verifiable identity. All current and future invoices will be blocked. Proceed?")) {
                                    const res = await fetch(`http://localhost:3000/api/identity/companies/${id}/revoke`, { 
                                        method: 'POST', 
                                        headers: {
                                            "Content-Type": "application/json",
                                            "x-lender-id": localStorage.getItem("sherlock-lender-id") || "1"
                                        }
                                    });
                                    if(res.ok) window.location.reload();
                                }
                            }}
                            className="px-6 py-2.5 bg-destructive/10 text-destructive border border-destructive/50 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-destructive hover:text-white transition-all shadow-lg shadow-destructive/20 flex items-center gap-2"
                        >
                            <ShieldAlert className="w-4 h-4" />
                            Revoke Credential
                        </button>
                    )}
                </div>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-card p-6 rounded-2xl border border-border/50 glow-card">
                    <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" /> Risk Score
                    </div>
                    <div className={`text-4xl font-mono font-bold ${isBlocked ? 'text-destructive glow-text' : 'text-primary'}`}>
                        {Number(supplier.currentScore || 0).toFixed(2)}/100
                    </div>
                </div>
                <div className="bg-card p-6 rounded-2xl border border-border/50 glow-card">
                    <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" /> Total Financed Volume
                    </div>
                    <div className="text-3xl font-mono font-bold text-foreground">
                        ₹{Math.round(supplier.totalVolume).toLocaleString("en-IN")}
                    </div>
                </div>
                <div className="bg-card p-6 rounded-2xl border border-border/50 glow-card">
                    <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" /> Active Invoices
                    </div>
                    <div className="text-3xl font-mono font-bold text-foreground">
                        {supplier.activeInvoices}
                    </div>
                </div>
                <div className={`bg-card p-6 rounded-2xl border glow-card ${isBlocked ? 'border-destructive/30 bg-destructive/5' : 'border-primary/30 bg-primary/5'}`}>
                    <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                        {isBlocked ? <ShieldAlert className="w-4 h-4 text-destructive" /> : <ShieldCheck className="w-4 h-4 text-primary" />}
                        Verifiable Credential
                    </div>
                    <div className={`text-xl font-bold tracking-wider mt-2 ${isBlocked ? 'text-destructive' : 'text-primary'}`}>
                        {supplier.kycStatus}
                    </div>
                </div>
            </div>

            {/* Transaction Specific Identity (Document Triplet) - Only shown if invoice context exists */}
            {trxDetails && trxDetails.documentTriplet && (
                <div className="mb-8 animate-in fade-in slide-in-from-top duration-500">
                    <h2 className="text-sm font-bold text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Transaction Identity • Triplet Verification
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Invoice */}
                        <div className="bg-card/40 backdrop-blur-md border border-primary/20 rounded-2xl p-6 glow-card relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-primary/10" />
                            <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-3">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Invoice</span>
                                <span className="text-xs font-mono text-primary font-bold">{trxDetails.invoice_number}</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Amount</span>
                                    <span className="text-lg font-mono font-bold text-foreground">{formatCurrency(trxDetails.amount)}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Goods Category</span>
                                    <span className="text-xs italic text-foreground opacity-80">{trxDetails.goods_category || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* PO */}
                        <div className="bg-card/40 backdrop-blur-md border border-primary/20 rounded-2xl p-6 glow-card relative overflow-hidden group">
                             <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-primary/10" />
                            <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-3">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Purchase Order</span>
                                <span className="text-xs font-mono text-primary font-bold">PO-{trxDetails.po_id}</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">PO Date</span>
                                    <span className="text-lg font-mono font-bold text-foreground">
                                        {trxDetails.documentTriplet.po.date ? String(trxDetails.documentTriplet.po.date).split('T')[0] : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">PO Total Amount</span>
                                    <span className="text-lg font-mono font-bold text-foreground">{formatCurrency(trxDetails.documentTriplet.po.amount)}</span>
                                </div>
                            </div>
                        </div>

                        {/* GRN */}
                        <div className="bg-card/40 backdrop-blur-md border border-primary/20 rounded-2xl p-6 glow-card relative overflow-hidden group">
                             <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-primary/10" />
                            <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-3">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Goods Receipt</span>
                                <span className="text-xs font-mono text-primary font-bold">GRN-{trxDetails.grn_id}</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Delivery Date</span>
                                    <span className="text-lg font-mono font-bold text-foreground">
                                        {trxDetails.documentTriplet.grn.date ? String(trxDetails.documentTriplet.grn.date).split('T')[0] : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Quantity Received</span>
                                    <span className="text-lg font-mono font-bold text-foreground">{formatCurrency(trxDetails.documentTriplet.grn.amount)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Risk Score Trend */}
                <div className="lg:col-span-2 bg-card rounded-2xl p-6 glow-card border border-border/50 h-[400px] flex flex-col">
                    <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-primary" />
                        Historical Risk Trend
                    </h2>
                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendMap} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                                />
                                <Area type="monotone" dataKey="score" stroke="hsl(var(--destructive))" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Local Relationship Map */}
                <div className="bg-card rounded-2xl p-6 glow-card border border-border/50 h-[400px] flex flex-col">
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Network className="w-5 h-5 text-primary" />
                        Ego Network
                    </h2>
                    <div className="flex-1 bg-background/50 rounded-xl border border-border/50 flex flex-col items-center justify-center relative overflow-hidden p-4">
                        {egoNetwork.length === 0 ? (
                            <div className="text-xs text-muted-foreground text-center px-4">
                                No direct relationships found for this supplier.
                            </div>
                        ) : (
                            <>
                                <div className="w-full space-y-2 mt-2">
                                    {egoNetwork.slice(0, 6).map((edge: any, idx: number) => (
                                        <div key={idx} className="p-2 bg-card border border-border rounded-lg text-xs">
                                            {edge.supplier_name} → {edge.buyer_name}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 text-xs text-muted-foreground text-center px-4">
                                    Live ego-network derived from `trade_relationships`.
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
