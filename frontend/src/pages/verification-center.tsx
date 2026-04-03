import { useState } from "react";
import { SemanticComparison } from "@/components/dashboard/semantic-comparison";
import { FraudDnaCard } from "@/components/dashboard/fraud-dna-card";
import { InvoiceQueue } from "@/components/dashboard/invoice-queue";
import { CounterfactualPanel } from "@/components/dashboard/counterfactual-panel";
import { ExpandableWrapper } from "@/components/ui/expandable-wrapper";
import { useInvoiceDetail } from "@/hooks/use-dashboard-data";
import { useExplainData } from "@/hooks/use-explain-data";
import { ShieldCheck } from "lucide-react";

export default function VerificationCenterPage() {
    // selectedId = display string (e.g. "INV-0042"), selectedDbId = numeric PK for API calls
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedDbId, setSelectedDbId] = useState<number | null>(null);

    // Invoice detail — used for metadata (status, risk_score) and semantic comparison
    const { data: details, isLoading: isLoadingDetail } = useInvoiceDetail(selectedId);

    // Layer 7 Explainability Engine — the correct source for DNA, counterfactual, and impatience signal
    const {
        data: explainData,
        isLoading: isLoadingExplain,
        isError: isExplainError,
        error: explainError,
    } = useExplainData(selectedDbId);

    const isLoading = isLoadingDetail || isLoadingExplain;

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

            {/* AI Analysis Row — Fraud DNA + Semantic */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="min-h-[400px] h-full">
                    <ExpandableWrapper>
                        {/* Fraud DNA and impatience signal sourced from the Layer 7 /api/explain/:id engine */}
                        <FraudDnaCard
                            dna={explainData?.fraudDNA}
                            isLoading={isLoading}
                            isError={isExplainError}
                            error={explainError instanceof Error ? explainError : null}
                            breakdown={explainData?.factorBreakdown}
                            impatienceSignal={explainData?.impatienceSignal}
                            hasSelection={!!selectedId}
                        />
                    </ExpandableWrapper>
                </div>
                <div className="min-h-[400px] h-full">
                    <ExpandableWrapper>
                        {/* Semantic data still sourced from invoice detail (no explain equivalent) */}
                        <SemanticComparison
                            data={details?.semanticData}
                            isLoading={isLoadingDetail}
                            breakdown={details?.breakdown}
                            hasSelection={!!selectedId}
                        />
                    </ExpandableWrapper>
                </div>
            </div>

            {/* Counterfactual AI Row */}
            <div className="grid grid-cols-1 gap-6">
                <div className="min-h-[300px] h-full">
                    <ExpandableWrapper>
                        {/* Counterfactual sourced from Layer 7 engine; status/score from invoice detail */}
                        <CounterfactualPanel
                            counterfactual={explainData?.counterfactual}
                            invoiceStatus={details?.status}
                            riskScore={details?.risk_score}
                            isLoading={isLoading}
                            isError={isExplainError}
                            error={explainError instanceof Error ? explainError : null}
                            hasSelection={!!selectedId}
                        />
                    </ExpandableWrapper>
                </div>
            </div>

            {/* Queue */}
            <div className="pb-8">
                <div className="min-h-[500px] h-[70vh]">
                    <InvoiceQueue
                        onSelectInvoice={(dbId) => {
                            setSelectedDbId(dbId);           // numeric PK → useExplainData
                            setSelectedId(dbId ? String(dbId) : null); // string → useInvoiceDetail
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
