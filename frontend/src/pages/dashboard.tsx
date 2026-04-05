import { KpiWidgets } from "@/components/dashboard/kpi-widgets";
import { UnifiedSimulator } from "@/components/demo/unified-simulator";
import { LenderSwitcher } from "@/components/dashboard/lender-switcher";
import { FlaskConical } from "lucide-react";

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
          <LenderSwitcher />
        </div>
      </header>

      {/* KPIs */}
      <KpiWidgets />

      {/* Unified Simulation Studio */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground glow-text tracking-tight uppercase">Risk Simulation Studio</h2>
        </div>
        <div className="min-h-[600px]">
          <UnifiedSimulator />
        </div>
      </div>
    </div>
  );
}
