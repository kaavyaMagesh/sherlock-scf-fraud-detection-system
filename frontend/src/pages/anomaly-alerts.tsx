import { AlertsPanel, CashTimeline } from "@/components/dashboard/alerts-timeline";
import { ActionPanel } from "@/components/dashboard/action-panel";
import { CounterfactualPanel } from "@/components/dashboard/counterfactual-panel";
import { ExpandableWrapper } from "@/components/ui/expandable-wrapper";
import { BellRing } from "lucide-react";

export default function AnomalyAlertsPage() {
    return (
        <div className="flex-1 overflow-auto bg-transparent p-4 md:p-8 custom-scrollbar flex flex-col space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground glow-text tracking-tight flex items-center gap-3">
                        <BellRing className="w-8 h-8 text-destructive" />
                        Anomaly Alerts
                    </h1>
                    <p className="text-muted-foreground mt-1 font-mono text-sm">Real-time threat feed and disbursement gating.</p>
                </div>
            </header>

            {/* Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">

                {/* Main Alert Feed & Timeline */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="flex-1 min-h-[500px]">
                        <AlertsPanel />
                    </div>
                    <CashTimeline />
                </div>

                {/* Action Controls */}
                <div className="flex flex-col gap-6">
                    <div className="min-h-[280px] h-full">
                        <ActionPanel />
                    </div>
                    <div className="min-h-[380px] h-full">
                        <ExpandableWrapper>
                            <CounterfactualPanel />
                        </ExpandableWrapper>
                    </div>
                </div>
            </div>
        </div>
    );
}
