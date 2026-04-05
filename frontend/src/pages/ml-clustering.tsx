import { useState, useEffect } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  Tooltip, ResponsiveContainer, Cell
} from "recharts";
import {
  BrainCircuit, ShieldCheck, AlertTriangle, Users,
  TrendingUp, Clock, Package, BarChart3, Loader2, Info
} from "lucide-react";

interface SupplierFeatures {
  avg_invoice_amount: number;
  invoice_frequency_per_month: number;
  avg_days_to_deliver: number;
  num_buyers: number;
  pct_invoices_disputed: number;
  relationship_age_months: number;
  total_volume: number;
}

interface Supplier {
  supplier_id: string;
  supplier_name: string;
  pca_x: number;
  pca_y: number;
  cluster_id: number;
  cluster_label: string;
  cluster_color: string;
  cluster_risk: string;
  features: SupplierFeatures;
}

interface ClusterSummary {
  cluster_id: number;
  label: string;
  color: string;
  risk: string;
  count: number;
  avg_invoice_amount: number;
  avg_dispute_rate: number;
  avg_relationship_age: number;
  avg_num_buyers: number;
  total_volume: number;
}

interface MLData {
  metadata: {
    model: string;
    features_used: string[];
    pca_variance_explained: number;
    total_suppliers: number;
  };
  cluster_summary: ClusterSummary[];
  suppliers: Supplier[];
}

const CLUSTER_ICONS: Record<string, React.ElementType> = {
  "Trusted Veteran": ShieldCheck,
  "New Entrant": Clock,
  "High Risk Actor": AlertTriangle,
};

const FEATURE_LABELS: Record<string, string> = {
  avg_invoice_amount: "Avg Invoice Amount",
  invoice_frequency_per_month: "Invoice Frequency / Month",
  avg_days_to_deliver: "Avg Delivery Days",
  num_buyers: "Number of Buyers",
  pct_invoices_disputed: "Dispute Rate (%)",
  relationship_age_months: "Relationship Age (months)",
  total_volume: "Total Volume",
};

const FEATURE_FORMAT: Record<string, (v: number) => string> = {
  avg_invoice_amount: (v) => `₹${Number(v).toLocaleString("en-IN")}`,
  invoice_frequency_per_month: (v) => `${v}/month`,
  avg_days_to_deliver: (v) => `${v} days`,
  num_buyers: (v) => `${v} buyers`,
  pct_invoices_disputed: (v) => `${v}%`,
  relationship_age_months: (v) => `${v} months`,
  total_volume: (v) => `₹${Number(v).toLocaleString("en-IN")}`,
};

const RISK_THRESHOLDS: Record<string, Record<string, [number, number]>> = {
  pct_invoices_disputed: {
    good: [0, 10],
    warn: [10, 40],
    bad: [40, 100],
  },
  avg_days_to_deliver: {
    good: [0, 12],
    warn: [12, 25],
    bad: [25, 100],
  },
};

function getBarColor(key: string, value: number): string {
  const thresholds = RISK_THRESHOLDS[key];
  if (!thresholds) return "#6366f1";
  if (value >= thresholds.bad[0]) return "#ef4444";
  if (value >= thresholds.warn[0]) return "#eab308";
  return "#22c55e";
}

const CustomDot = (props: any) => {
  const { cx, cy, payload, selectedId } = props;
  const isSelected = selectedId === payload.supplier_id;
  const r = isSelected ? 12 : 7;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={payload.cluster_color}
      stroke={isSelected ? "#fff" : "transparent"}
      strokeWidth={isSelected ? 2 : 0}
      style={{ cursor: "pointer", transition: "r 0.2s, opacity 0.2s", opacity: selectedId && !isSelected ? 0.4 : 1 }}
    />
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const s: Supplier = payload[0]?.payload;
  if (!s) return null;
  return (
    <div className="bg-card border border-border/60 rounded-xl p-3 shadow-xl text-xs font-mono max-w-[200px]">
      <div className="font-bold text-foreground mb-1">{s.supplier_name}</div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ background: s.cluster_color }} />
        <span className="text-muted-foreground">{s.cluster_label}</span>
      </div>
      <div className="text-muted-foreground">Dispute Rate: <span className={s.features.pct_invoices_disputed > 40 ? "text-destructive" : "text-primary"}>{s.features.pct_invoices_disputed}%</span></div>
      <div className="text-muted-foreground">Avg Amount: ₹{s.features.avg_invoice_amount.toLocaleString("en-IN")}</div>
    </div>
  );
};

export default function MLClusteringPage() {
  const [data, setData] = useState<MLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [activeCluster, setActiveCluster] = useState<number | null>(null);

  useEffect(() => {
    fetch("/clustered_results.json")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const displayedSuppliers = activeCluster !== null
    ? data?.suppliers.filter((s) => s.cluster_id === activeCluster) ?? []
    : data?.suppliers ?? [];

  const handleDotClick = (payload: any) => {
    if (payload?.activePayload?.[0]?.payload) {
      setSelected(payload.activePayload[0].payload);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Loader2 className="w-10 h-10 animate-spin" />
          <div className="font-mono text-sm tracking-widest uppercase">Loading ML Model Results...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground font-mono text-sm">
        Model data not found. Run <code className="mx-1 bg-muted px-1 rounded">python ml/train_model.py</code> first.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-auto custom-scrollbar p-6 md:p-8 space-y-6 relative">
      {/* Ambient glow */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary/5 blur-[120px] pointer-events-none rounded-full" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 glow-text">
            <BrainCircuit className="w-8 h-8 text-primary" />
            ML Supplier Risk Clustering
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-mono uppercase tracking-widest">
            K-Means (k=3) + PCA · {data.metadata.pca_variance_explained}% Variance Explained · {data.metadata.total_suppliers} Suppliers
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-xl text-xs font-mono text-primary">
          <Info className="w-4 h-4" />
          Pre-trained model · No live DB dependency
        </div>
      </div>

      {/* Cluster Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.cluster_summary.map((c) => {
          const Icon = CLUSTER_ICONS[c.label] ?? Users;
          const isActive = activeCluster === c.cluster_id;
          return (
            <button
              key={c.cluster_id}
              onClick={() => setActiveCluster(isActive ? null : c.cluster_id)}
              className={`text-left p-5 rounded-2xl border transition-all duration-300 ${isActive ? "ring-2 ring-offset-1 ring-offset-background scale-[1.02]" : "hover:scale-[1.01]"}`}
              style={{
                borderColor: isActive ? c.color : "rgba(255,255,255,0.08)",
                background: isActive ? `${c.color}15` : "hsl(var(--card))",
                boxShadow: isActive ? `0 0 30px ${c.color}22` : undefined,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="font-bold text-sm" style={{ color: c.color }}>{c.label}</span>
                </div>
                <Icon className="w-5 h-5" style={{ color: c.color }} />
              </div>
              <div className="text-3xl font-black text-foreground mb-1">{c.count}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Suppliers</div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Invoice</span>
                  <span>₹{c.avg_invoice_amount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dispute Rate</span>
                  <span style={{ color: c.avg_dispute_rate > 40 ? "#ef4444" : c.avg_dispute_rate > 15 ? "#eab308" : "#22c55e" }}>
                    {c.avg_dispute_rate}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Tenure</span>
                  <span>{c.avg_relationship_age} months</span>
                </div>
              </div>
              {isActive && (
                <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: c.color }}>
                  Click to deselect filter
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content: Scatter Plot + Profile Card */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-[520px]">

        {/* Scatter Plot */}
        <div className="flex-1 bg-card border border-border/50 rounded-2xl p-6 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.01] pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg glow-text flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              2D Supplier Behavioural Map
            </h2>
            <div className="flex gap-3 text-[10px] font-mono">
              {data.cluster_summary.map((c) => (
                <div key={c.cluster_id} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                  <span className="text-muted-foreground">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-mono mb-4">
            PCA-reduced from 7 dimensions. Click any dot to view supplier profile.
          </p>
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }} onClick={handleDotClick}>
              <XAxis
                dataKey="pca_x"
                type="number"
                name="PC1"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                label={{ value: "PC1 (77.3% variance)", position: "insideBottom", offset: -5, fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              />
              <YAxis
                dataKey="pca_y"
                type="number"
                name="PC2"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                label={{ value: "PC2 (20.7%)", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              />
              <ZAxis range={[60, 60]} />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "hsl(var(--border))" }} />
              <Scatter data={displayedSuppliers} isAnimationActive={true}>
                {displayedSuppliers.map((s) => (
                  <Cell
                    key={s.supplier_id}
                    fill={s.cluster_color}
                    opacity={selected && selected.supplier_id !== s.supplier_id ? 0.35 : 1}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Supplier Profile Card */}
        <div className="w-full lg:w-80 bg-card border border-border/50 rounded-2xl p-6 shadow-lg flex flex-col">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Users className="w-8 h-8 text-primary/60" />
              </div>
              <div>
                <div className="font-bold text-foreground mb-1">Select a Supplier</div>
                <div className="text-xs text-muted-foreground font-mono">Click any dot on the scatter plot to view its behavioral profile and cluster assignment.</div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 flex-1 animate-in fade-in slide-in-from-right-2 duration-300">
              {/* Header */}
              <div className="pb-4 border-b border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: selected.cluster_color }} />
                  <span className="text-xs font-mono font-bold uppercase tracking-widest" style={{ color: selected.cluster_color }}>
                    {selected.cluster_label}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground">{selected.supplier_name}</h3>
                <div className="text-xs text-muted-foreground font-mono">{selected.supplier_id}</div>
              </div>

              {/* Risk Badge */}
              <div
                className="px-4 py-2.5 rounded-xl text-center text-sm font-bold border"
                style={{
                  background: `${selected.cluster_color}15`,
                  borderColor: `${selected.cluster_color}40`,
                  color: selected.cluster_color,
                }}
              >
                {selected.cluster_risk === "High" ? "⚠️ High Risk — Enhanced Monitoring Required" :
                 selected.cluster_risk === "Medium" ? "🟡 Medium Risk — Standard Onboarding Protocols" :
                 "✅ Low Risk — Trusted Trade Partner"}
              </div>

              {/* Features */}
              <div className="space-y-3 flex-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Feature Breakdown</div>
                {Object.entries(selected.features).map(([key, value]) => {
                  const barColor = getBarColor(key, value);
                  const maxValues: Record<string, number> = {
                    avg_invoice_amount: 600000,
                    invoice_frequency_per_month: 7,
                    avg_days_to_deliver: 60,
                    num_buyers: 25,
                    pct_invoices_disputed: 100,
                    relationship_age_months: 80,
                    total_volume: 10000000,
                  };
                  const pct = Math.min((value / maxValues[key]) * 100, 100);
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-muted-foreground">{FEATURE_LABELS[key]}</span>
                        <span className="font-bold text-foreground">{FEATURE_FORMAT[key]?.(value) ?? value}</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setSelected(null)}
                className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-foreground transition-colors mt-2"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Supplier Table */}
      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2 glow-text">
          <Package className="w-5 h-5 text-primary" />
          All Supplier Profiles
          {activeCluster !== null && (
            <span className="ml-2 text-xs font-mono px-2 py-0.5 rounded border" style={{ color: data.cluster_summary.find(c=>c.cluster_id===activeCluster)?.color, borderColor: data.cluster_summary.find(c=>c.cluster_id===activeCluster)?.color }}>
              Filtered: {data.cluster_summary.find(c=>c.cluster_id===activeCluster)?.label}
            </span>
          )}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border/30">
          <table className="w-full text-xs font-mono">
            <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider">
              <tr>
                {["Supplier", "Cluster", "Avg Invoice", "Dispute %", "Buyers", "Delivery Days", "Tenure"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {displayedSuppliers.map((s) => (
                <tr
                  key={s.supplier_id}
                  onClick={() => setSelected(s)}
                  className={`hover:bg-muted/20 cursor-pointer transition-colors ${selected?.supplier_id === s.supplier_id ? "bg-primary/5" : ""}`}
                >
                  <td className="px-4 py-3 font-bold text-foreground">{s.supplier_name}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.cluster_color }} />
                      <span style={{ color: s.cluster_color }}>{s.cluster_label}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">₹{s.features.avg_invoice_amount.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${s.features.pct_invoices_disputed > 40 ? "text-destructive" : s.features.pct_invoices_disputed > 15 ? "text-warning" : "text-primary"}`}>
                      {s.features.pct_invoices_disputed}%
                    </span>
                  </td>
                  <td className="px-4 py-3">{s.features.num_buyers}</td>
                  <td className="px-4 py-3">{s.features.avg_days_to_deliver}d</td>
                  <td className="px-4 py-3">{s.features.relationship_age_months}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
