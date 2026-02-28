import { useKPI } from "@/hooks/use-dashboard-data";
import { Wallet, Ban, BellRing, ShieldCheck } from "lucide-react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function KpiWidgets() {
  const { data: kpi, isLoading } = useKPI();

  if (isLoading || !kpi) return <div className="h-32 flex items-center justify-center text-primary glow-text font-mono">INITIALIZING TELEMETRY...</div>;

  const healthData = [{ name: "Health", value: kpi.healthScore, fill: "hsl(var(--primary))" }];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Portfolio Exposure */}
      <div className="bg-card rounded-2xl p-6 glow-card flex flex-col justify-between border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Total Exposure</h3>
          <div className="p-2 bg-primary/10 rounded-lg">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-3xl lg:text-4xl font-mono font-bold text-foreground glow-text">
            {formatCurrency(kpi.totalExposure)}
          </span>
        </div>
      </div>

      {/* Health Score Gauge */}
      <div className="bg-card rounded-2xl p-6 glow-card border border-border/50 relative overflow-hidden flex items-center">
        <div className="flex-1 z-10 relative">
          <h3 className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-2">Health Score</h3>
          <div className="text-4xl font-mono font-bold text-primary glow-text flex items-center gap-2">
            {kpi.healthScore}%
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Network Integrity</p>
        </div>
        <div className="h-[140px] w-[140px] absolute -right-4 -bottom-4 opacity-80 pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%" cy="50%" innerRadius="65%" outerRadius="100%"
              barSize={8} data={healthData} startAngle={180} endAngle={0}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={10} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Blocked Today */}
      <div className="bg-card rounded-2xl p-6 glow-card border border-destructive/30 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <div className="flex items-center justify-between mb-4 relative z-10">
          <h3 className="text-sm text-destructive font-medium uppercase tracking-wider">Blocked Today</h3>
          <div className="p-2 bg-destructive/10 rounded-lg">
            <Ban className="w-5 h-5 text-destructive" />
          </div>
        </div>
        <div className="flex items-end justify-between relative z-10">
          <span className="text-4xl font-mono font-bold text-destructive glow-text" style={{ textShadow: '0 0 10px rgba(220, 38, 38, 0.5)' }}>
            {kpi.blockedToday}
          </span>
          <span className="text-sm text-muted-foreground">Invoices</span>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="bg-card rounded-2xl p-6 glow-card border border-warning/30 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-warning/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <div className="flex items-center justify-between mb-4 relative z-10">
          <h3 className="text-sm text-warning font-medium uppercase tracking-wider">Active Alerts</h3>
          <div className="p-2 bg-warning/10 rounded-lg">
            <BellRing className="w-5 h-5 text-warning" />
          </div>
        </div>
        <div className="flex items-end justify-between relative z-10">
          <span className="text-4xl font-mono font-bold text-warning glow-text" style={{ textShadow: '0 0 10px rgba(234, 179, 8, 0.5)' }}>
            {kpi.alertsCount}
          </span>
          <span className="text-sm text-muted-foreground">Unresolved flags</span>
        </div>
      </div>

    </div>
  );
}
