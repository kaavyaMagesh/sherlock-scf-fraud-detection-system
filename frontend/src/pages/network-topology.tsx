import { NetworkGraph } from "@/components/dashboard/network-graph";
import { CascadeTreeView } from "@/components/dashboard/cascade-tree-view";
import { ContagionImpactView } from "@/components/dashboard/contagion-impact-view";
import { ExpandableWrapper } from "@/components/ui/expandable-wrapper";
import { Network } from "lucide-react";

export default function NetworkTopologyPage() {
    return (
        <div className="flex-1 overflow-auto bg-transparent p-4 md:p-8 custom-scrollbar flex flex-col space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground glow-text tracking-tight flex items-center gap-3">
                        <Network className="w-8 h-8 text-primary" />
                        Network Topology
                    </h1>
                    <p className="text-muted-foreground mt-1 font-mono text-sm">Deep-tier supply chain mapping and contagion tracking.</p>
                </div>
            </header>

            {/* Main Main View */}
            <div className="min-h-[600px] w-full shrink-0">
                <NetworkGraph />
            </div>

            {/* Detail Views */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                <div className="min-h-[500px] h-full">
                    <ExpandableWrapper>
                        <CascadeTreeView />
                    </ExpandableWrapper>
                </div>
                <div className="min-h-[500px] h-full">
                    <ExpandableWrapper>
                        <ContagionImpactView />
                    </ExpandableWrapper>
                </div>
            </div>
        </div>
    );
}
