import { useEffect, useState } from "react";
import { AlertTriangle, Clock, ServerCrash, Zap } from "lucide-react";

interface Alert {
  id?: number | string;
  fingerprint?: string;
  priority?: "critical" | "high" | "medium";
  severity?: "CRITICAL" | "WARNING" | "INFO";
  amount?: number;
  date?: string;
  fraudType?: string;
  entityName?: string;
  invoiceId?: number;
  score?: number;
}

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Determine WS URL. Vite proxies default to backend, or use strict localhost:3000
    const wsUrl = `ws://localhost:3000`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'HISTORY') {
          setAlerts(data.alerts.reverse());
        } else if (data.type === 'ALERT') {
          setAlerts(prev => [data.alert, ...prev].slice(0, 50));
        }
      } catch (e) {
        console.error("WS Parse error", e);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  // Use mock data if empty
  const displayAlerts = alerts.length > 0 ? alerts : [
    { id: 1, invoiceId: 992, fingerprint: "INV-992-A8X", fraudType: "carousel_trade_detected", severity: "CRITICAL", amount: 125000, date: new Date().toISOString() },
    { id: 2, invoiceId: 104, fingerprint: "INV-104-B2Y", fraudType: "velocity_anomaly", severity: "WARNING", amount: 84000, date: new Date(Date.now() - 3600000).toISOString() },
  ];

  return (
    <div className="bg-card rounded-2xl p-6 glow-card border border-border/50 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground glow-text flex items-center gap-2">
            <ServerCrash className="w-5 h-5 text-destructive" />
            Live Threat Feed
          </h2>
          <p className="text-sm text-muted-foreground">Automated systemic flags</p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1 text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded-full border border-primary/20">
              <Zap className="w-3 h-3 animate-pulse" /> LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded-full border border-border">
              OFFLINE
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {displayAlerts.map((alert, idx) => {
          const isCritical = alert.severity === 'CRITICAL' || alert.priority === 'critical';
          const priorityLabel = alert.severity || alert.priority?.toUpperCase() || 'WARNING';

          return (
            <div
              key={alert.id || idx}
              className={`p-4 rounded-xl border flex flex-col gap-2 transition-all hover:translate-x-1 ${isCritical ? 'bg-destructive/10 border-destructive/50 shadow-[0_0_10px_rgba(220,38,38,0.1)]' :
                  'bg-warning/10 border-warning/50'
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${isCritical ? 'text-destructive animate-pulse' : 'text-warning'
                    }`} />
                  <span className="font-mono text-sm font-bold tracking-wide">
                    {alert.fingerprint || `INV-${alert.invoiceId}`}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wider ${isCritical ? 'bg-destructive text-destructive-foreground' :
                    'bg-warning text-warning-foreground'
                  }`}>
                  {priorityLabel}
                </span>
              </div>

              <div className="text-sm text-foreground/90 font-medium my-1">
                {alert.fraudType || "Network Anomaly Detected"}
                {alert.score && <span className="ml-2 font-mono text-muted-foreground">(Score: {alert.score})</span>}
              </div>

              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground font-mono">
                  {alert.entityName ? `Entity: ${alert.entityName}` : alert.amount ? `Exposure: $${Number(alert.amount).toLocaleString()}` : 'System Alert'}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(alert.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )
        })}
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
