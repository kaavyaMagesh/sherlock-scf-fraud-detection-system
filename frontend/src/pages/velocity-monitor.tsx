import { VerificationChart, VelocityChart } from "@/components/dashboard/charts";
import { ExpandableWrapper } from "@/components/ui/expandable-wrapper";
import { Activity } from "lucide-react";

export default function VelocityMonitorPage() {
    return (
        <div className="flex-1 overflow-auto bg-transparent p-4 md:p-8 custom-scrollbar flex flex-col space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground glow-text tracking-tight flex items-center gap-3">
                        <Activity className="w-8 h-8 text-primary" />
                        Velocity Monitor
                    </h1>
                    <p className="text-muted-foreground mt-1 font-mono text-sm">Tracking invoice submission velocity and verification trends.</p>
                </div>
            </header>

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                <div className="min-h-[500px]">
                    <ExpandableWrapper>
                        <VerificationChart />
                    </ExpandableWrapper>
                </div>
                <div className="min-h-[500px]">
                    <ExpandableWrapper>
                        <VelocityChart />
                    </ExpandableWrapper>
                </div>
            </div>
        </div>
    );
}
