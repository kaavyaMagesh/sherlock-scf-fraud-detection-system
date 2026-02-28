import { useDiscrepancies, useVelocity } from "@/hooks/use-dashboard-data";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from "recharts";
import { ShieldCheck, ShieldAlert } from "lucide-react";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/90 backdrop-blur border border-border p-4 rounded-xl shadow-xl">
        <p className="text-foreground font-semibold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-mono flex items-center justify-between gap-4">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="font-bold text-foreground">
              {entry.name.includes('Velocity') ? entry.value.toFixed(1) : `$${Number(entry.value).toLocaleString()}`}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function VerificationChart() {
  const { data, isLoading } = useDiscrepancies();

  if (isLoading || !data) return <div className="h-64 animate-pulse bg-muted/20 rounded-xl" />;

  return (
    <div className="bg-card rounded-2xl p-6 glow-card border border-border/50 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground glow-text">Verification Center</h2>
          <p className="text-sm text-muted-foreground">Tri-party document matching</p>
        </div>
      </div>
      
      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="companyName" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            <Bar dataKey="invoiceValue" name="Invoice" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="poValue" name="PO" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="grnValue" name="GRN" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        {data.slice(0,2).map(d => (
          <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/30">
            {d.matchStatus ? 
              <ShieldCheck className="text-primary w-5 h-5" /> : 
              <ShieldAlert className="text-destructive w-5 h-5" />
            }
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{d.companyName}</p>
              <p className="text-xs font-mono text-muted-foreground">Match: {d.matchStatus ? 'VERIFIED' : 'FAILED'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VelocityChart() {
  const { data, isLoading } = useVelocity();

  if (isLoading || !data) return <div className="h-64 animate-pulse bg-muted/20 rounded-xl" />;

  // Format dates for X-axis
  const formattedData = data.map(d => ({
    ...d,
    displayDate: new Date(d.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }));

  return (
    <div className="bg-card rounded-2xl p-6 glow-card border border-border/50 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground glow-text">Velocity Anomaly Monitor</h2>
          <p className="text-sm text-muted-foreground">Transaction frequency across tiers</p>
        </div>
        <div className="px-3 py-1 bg-primary/10 text-primary text-xs font-mono rounded-full border border-primary/20 animate-pulse">
          LIVE MONITORING
        </div>
      </div>
      
      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
             <defs>
              <linearGradient id="colorT3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="displayDate" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            
            <Line type="monotone" dataKey="tier1Velocity" name="T1 Velocity" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="tier2Velocity" name="T2 Velocity" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
            <Line type="step" dataKey="tier3Velocity" name="T3 Velocity (High Risk)" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--destructive))' }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
