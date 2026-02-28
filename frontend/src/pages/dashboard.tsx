import { KpiWidgets } from "@/components/dashboard/kpi-widgets";
import { NetworkGraph } from "@/components/dashboard/network-graph";
import { VerificationChart, VelocityChart } from "@/components/dashboard/charts";
import { AlertsPanel, CashTimeline } from "@/components/dashboard/alerts-timeline";
import { ActionPanel } from "@/components/dashboard/action-panel";
import { Bell } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="flex-1 overflow-auto bg-transparent p-4 md:p-8 custom-scrollbar">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground glow-text tracking-tight">Real-time SCF Overwatch</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">Deep-tier visibility & anomaly detection active.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-card border border-border/50 rounded-full flex items-center gap-3 shadow-lg">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(54,255,143,0.8)]"></div>
            <span className="text-sm font-mono text-muted-foreground">Live Telemetry</span>
          </div>
          <button className="p-2 rounded-full bg-card border border-border/50 hover:bg-muted transition-colors relative">
            <Bell className="w-5 h-5 text-foreground" />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-card"></span>
          </button>
        </div>
      </header>

      {/* KPIs */}
      <KpiWidgets />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Network Map - Takes up 2 columns */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="h-[450px]">
            <NetworkGraph />
          </div>
          <CashTimeline />
        </div>

        {/* Right Sidebar - Alerts & Action */}
        <div className="flex flex-col gap-6">
          <div className="h-[280px]">
            <ActionPanel />
          </div>
          <div className="flex-1 min-h-[250px]">
            <AlertsPanel />
          </div>
        </div>
      </div>

      {/* Bottom Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
        <div className="h-[350px]">
          <VerificationChart />
        </div>
        <div className="h-[350px]">
          <VelocityChart />
        </div>
      </div>
    </div>
  );
}
