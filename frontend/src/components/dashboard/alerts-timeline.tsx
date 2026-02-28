import { useAlerts } from "@/hooks/use-dashboard-data";
import { AlertTriangle, Clock, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AlertsPanel() {
  const { data, isLoading } = useAlerts();

  if (isLoading || !data) return <div className="h-64 animate-pulse bg-muted/20 rounded-xl" />;

  return (
    <div className="bg-card rounded-2xl p-6 glow-card border border-border/50 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground glow-text flex items-center gap-2">
            <ServerCrash className="w-5 h-5 text-destructive" />
            Duplicate & Threat Alerts
          </h2>
          <p className="text-sm text-muted-foreground">Automated systemic flags</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {data.map((alert) => (
          <div 
            key={alert.id} 
            className={`p-4 rounded-xl border flex flex-col gap-2 transition-all hover:translate-x-1 ${
              alert.priority === 'critical' ? 'bg-destructive/10 border-destructive/50 shadow-[0_0_10px_rgba(220,38,38,0.1)]' : 
              alert.priority === 'high' ? 'bg-warning/10 border-warning/50' : 
              'bg-background border-border'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${
                  alert.priority === 'critical' ? 'text-destructive animate-pulse' : 
                  alert.priority === 'high' ? 'text-warning' : 'text-primary'
                }`} />
                <span className="font-mono text-sm font-bold tracking-wide">{alert.fingerprint}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                 alert.priority === 'critical' ? 'bg-destructive text-destructive-foreground' : 
                 alert.priority === 'high' ? 'bg-warning text-warning-foreground' : 
                 'bg-primary/20 text-primary'
              }`}>
                {alert.priority}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-mono">
                Exposure: <span className="text-foreground">${Number(alert.amount).toLocaleString()}</span>
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(alert.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CashTimeline() {
  const steps = [
    { label: "PO Issued", status: "complete" },
    { label: "Goods Shipped", status: "complete" },
    { label: "GRN Matched", status: "complete" },
    { label: "Disbursement", status: "pending", active: true },
    { label: "Buyer Payment", status: "upcoming" },
  ];

  return (
    <div className="bg-card rounded-2xl p-6 glow-card border border-border/50">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">Transaction Lifecycle</h2>
      
      <div className="relative flex items-center justify-between w-full">
        {/* Connecting Line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-muted rounded-full z-0"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full z-0 transition-all duration-1000 glow-line" style={{ width: '60%' }}></div>

        {steps.map((step, i) => (
          <div key={i} className="relative z-10 flex flex-col items-center gap-3">
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-500
              ${step.status === 'complete' ? 'bg-primary border-primary glow-text' : 
                step.active ? 'bg-background border-primary animate-pulse shadow-[0_0_15px_rgba(54,255,143,0.5)]' : 
                'bg-background border-muted'}
            `}>
              {step.status === 'complete' && <div className="w-2 h-2 bg-background rounded-full"></div>}
              {step.active && <div className="w-2 h-2 bg-primary rounded-full"></div>}
            </div>
            <span className={`text-xs font-mono font-medium ${step.active ? 'text-primary glow-text' : step.status === 'complete' ? 'text-foreground' : 'text-muted-foreground'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
