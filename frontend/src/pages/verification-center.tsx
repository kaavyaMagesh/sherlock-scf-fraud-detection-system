import { useState } from "react";
import { SemanticComparison } from "@/components/dashboard/semantic-comparison";
import { FraudDnaCard } from "@/components/dashboard/fraud-dna-card";
import { InvoiceQueue } from "@/components/dashboard/invoice-queue";
import { CounterfactualPanel } from "@/components/dashboard/counterfactual-panel";
import { ForensicClassificationList } from "@/components/dashboard/forensic-classification-list";
import { ExpandableWrapper } from "@/components/ui/expandable-wrapper";
import { useInvoiceDetail } from "@/hooks/use-dashboard-data";
import { useExplainData } from "@/hooks/use-explain-data";
import { ShieldCheck, FileStack, Binary } from "lucide-react";

export default function VerificationCenterPage() {
    // selectedId = display string (e.g. "INV-0042"), selectedDbId = numeric PK for API calls
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedDbId, setSelectedDbId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'queue' | 'forensics'>('queue');

    // Invoice detail — used for metadata (status, risk_score) and semantic comparison
    const { data: details, isLoading: isLoadingDetail } = useInvoiceDetail(selectedId);

    // Layer 7 Explainability Engine
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
                    <p className="text-muted-foreground mt-1 font-mono text-sm uppercase tracking-widest opacity-70">Forensic Investigation & Semantic Audit Suite</p>
                </div>

                {/* View Switcher */}
                <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50 self-start md:self-auto">
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'queue' ? 'bg-primary/10 text-primary border border-primary/30 shadow-[0_0_15px_rgba(54,255,143,0.1)]' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <FileStack className="w-4 h-4" />
                        Standard Ledger
                    </button>
                    <button
                        onClick={() => setActiveTab('forensics')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'forensics' ? 'bg-primary/10 text-primary border border-primary/30 shadow-[0_0_15px_rgba(54,255,143,0.1)]' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Binary className="w-4 h-4" />
                        Forensic Alerts
                    </button>
                </div>
            </header>

            {/* AI Analysis Row — Fraud DNA + Semantic */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="min-h-[400px] h-full">
                    <ExpandableWrapper>
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

            {/* Tabbed List View */}
            <div className="pb-12 h-full">
                <div className="min-h-[500px] h-[75vh] animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {activeTab === 'queue' ? (
                        <InvoiceQueue
                            raw={true}
                            onSelectInvoice={(dbId) => {
                                setSelectedDbId(dbId);
                                setSelectedId(dbId ? String(dbId) : null);
                            }}
                        />
                    ) : (
                        <ForensicClassificationList
                            onSelectAlert={(dbId) => {
                                setSelectedDbId(dbId);
                                setSelectedId(String(dbId));
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
