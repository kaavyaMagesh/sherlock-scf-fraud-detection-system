import { useParams, Link } from "wouter";
import { ArrowLeft, Building2, ShieldCheck, ShieldAlert, Activity, FileText, Network } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

const MOCK_SCORE_HISTORY = [
    { month: "Jan", score: 12 },
    { month: "Feb", score: 15 },
    { month: "Mar", score: 14 },
    { month: "Apr", score: 18 },
    { month: "May", score: 25 },
    { month: "Jun", score: 88 } // Sudden spike
];

export default function SupplierProfilePage() {
    const params = useParams<{ id: string }>();
    const id = params?.id || "1";

    // Mock data for supplier
    const supplier = {
        id,
        name: "Sub-supplier Y",
        tier: "Tier 3",
        status: "BLOCKED",
        currentScore: 88,
        did: "did:sherlock:company:992",
        kycStatus: "REVOKED",
        totalVolume: 1250000,
        activeInvoices: 3
    };

    const isBlocked = supplier.status === "BLOCKED";

    return (
        <div className="flex-1 overflow-auto bg-transparent p-4 md:p-8 custom-scrollbar">
            {/* Header */}
            <div className="mb-6 flex items-center gap-4">
                <Link href="/">
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
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-card p-6 rounded-2xl border border-border/50 glow-card">
                    <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" /> Risk Score
                    </div>
                    <div className={`text-4xl font-mono font-bold ${isBlocked ? 'text-destructive glow-text' : 'text-primary'}`}>
                        {supplier.currentScore}/100
                    </div>
                </div>
                <div className="bg-card p-6 rounded-2xl border border-border/50 glow-card">
                    <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" /> Total Financed Volume
                    </div>
                    <div className="text-3xl font-mono font-bold text-foreground">
                        $1.25M
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
                            <AreaChart data={MOCK_SCORE_HISTORY} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                        <div className="w-full flex justify-between items-center relative z-10 px-4 mt-8">
                            <div className="p-3 bg-card border border-border rounded-lg text-xs font-mono text-center">
                                Supplier Alpha
                                <div className="text-[10px] text-muted-foreground mt-1">T2</div>
                            </div>
                            <div className="h-0.5 flex-1 bg-destructive mx-2 relative">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-destructive text-destructive-foreground text-[10px] px-1 rounded font-bold">CAROUSEL</div>
                            </div>
                            <div className="p-3 bg-destructive/10 border-2 border-destructive rounded-lg text-xs font-mono font-bold text-destructive text-center glow-card shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                                Sub-supplier Y
                                <div className="text-[10px] text-destructive/80 mt-1">T3 (Focus)</div>
                            </div>
                            <div className="h-0.5 flex-1 bg-destructive mx-2"></div>
                            <div className="p-3 bg-card border border-border rounded-lg text-xs font-mono text-center">
                                Sub-supplier Z
                                <div className="text-[10px] text-muted-foreground mt-1">T3</div>
                            </div>
                        </div>

                        <div className="mt-8 text-xs text-muted-foreground text-center px-4">
                            Highly isolated node with singular dependency chain back to Supplier Alpha. Indicates potential shell company structure.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
