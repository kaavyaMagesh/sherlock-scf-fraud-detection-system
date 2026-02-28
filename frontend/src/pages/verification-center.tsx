import { SemanticComparison } from "@/components/dashboard/semantic-comparison";
import { FraudDnaCard } from "@/components/dashboard/fraud-dna-card";
import { InvoiceQueue } from "@/components/dashboard/invoice-queue";
import { ExpandableWrapper } from "@/components/ui/expandable-wrapper";
import { ShieldCheck } from "lucide-react";

export default function VerificationCenterPage() {
    return (
        <div className="flex-1 overflow-auto bg-transparent p-4 md:p-8 custom-scrollbar flex flex-col space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground glow-text tracking-tight flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-primary" />
                        Verification Center
                    </h1>
                    <p className="text-muted-foreground mt-1 font-mono text-sm">Semantic document analysis and fraud typology matching.</p>
                </div>
            </header>

            {/* AI Analysis Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="min-h-[400px] h-full">
                    <ExpandableWrapper>
                        <FraudDnaCard />
                    </ExpandableWrapper>
                </div>
                <div className="min-h-[400px] h-full">
                    <ExpandableWrapper>
                        <SemanticComparison />
                    </ExpandableWrapper>
                </div>
            </div>

            {/* Queue */}
            <div className="pb-8">
                <div className="min-h-[500px] h-[70vh]">
                    <InvoiceQueue />
                </div>
            </div>
        </div>
    );
}
