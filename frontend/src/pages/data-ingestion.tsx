import { useState, useEffect, useRef } from "react";
import { UploadCloud, FileText, Server, Database, Terminal, Loader2, Search, ChevronDown, Plus } from "lucide-react";
import { useCompanies, useCreateCompany } from "@/hooks/use-dashboard-data";

export default function DataIngestionPage() {
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete'>('idle');
    const [logs, setLogs] = useState<string[]>(['> SYSTEM STANDBY...', '> Waiting for payload ingestion on endpoint /api/v1/invoices', '----------------------------------------']);
    const logsEndRef = useRef<HTMLDivElement>(null);
    
    // Entity selection state
    const { companies, isLoadingCompanies, companiesError, refetchCompanies } = useCompanies();
    const createCompanyMutation = useCreateCompany();
    const [senderId, setSenderId] = useState<string>("");
    const [receiverId, setReceiverId] = useState<string>("");
    const [showAddPartner, setShowAddPartner] = useState(false);
    const [newPartnerName, setNewPartnerName] = useState("");

    // Auto-scroll logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const processRetailData = async (data: any[]) => {
        setStatus('processing');
        setLogs(prev => [...prev, '> RETAIL PAYLOAD RECEIVED, SENDING TO BACKEND...', '> POST /api/retail/ingest']);

        try {
            const token = localStorage.getItem('token');
            const lenderId = localStorage.getItem('sherlock-lender-id');

            const response = await fetch('http://localhost:3000/api/retail/ingest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-lender-id': lenderId || '1'
                },
                body: JSON.stringify({ transactions: data })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            const result = await response.json();

            // Animate logs from the backend
            let i = 0;
            const messages = result.logs || [];

            const interval = setInterval(() => {
                if (i < messages.length) {
                    setLogs(prev => [...prev, messages[i]]);
                    i++;
                } else {
                    clearInterval(interval);
                    setStatus('complete');
                }
            }, 300);

        } catch (error: any) {
            setLogs(prev => [...prev, '> FATAL: BACKEND REJECTED INGESTION.', `> DETAILS: ${error.message || error.toString()}`]);
            setStatus('idle');
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setStatus('uploading');
        setLogs(prev => [...prev, `> INITIATING SECURE TRANSFER: ${file.name}`]);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                processRetailData(data);
            } catch (error) {
                setLogs(prev => [...prev, '> ERROR: INVALID JSON FORMAT']);
                setStatus('idle');
            }
        };
        reader.readAsText(file);
    };

    const handleSimulation = (e: React.FormEvent) => {
        e.preventDefault();

        const form = e.target as HTMLFormElement;
        const senderObj = companies?.find((c: any) => c.id.toString() === senderId);
        const receiverObj = companies?.find((c: any) => c.id.toString() === receiverId);
        
        if (!senderObj || !receiverObj) {
            setLogs(prev => [...prev, '> ERROR: SENDER AND RECEIVER MUST BE SELECTED']);
            return;
        }

        const amount = parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value || '0');
        const narration = (form.elements.namedItem('narration') as HTMLSelectElement).value || 'Transfer';

        const invoicePayload = {
            supplierId: senderId,
            buyerId: receiverId,
            poId: `PO-${Math.floor(Math.random() * 10000)}`,
            grnId: `GRN-${Math.floor(Math.random() * 10000)}`,
            invoiceNumber: `INV-${Math.floor(Math.random() * 10000)}`,
            invoiceAmount: amount,
            invoiceDate: new Date().toISOString(),
            // Mapping to snake_case format for the Node backend to process correctly
            supplier_id: senderId,
            buyer_id: receiverId,
            po_id: `PO-${Math.floor(Math.random() * 10000)}`,
            grn_id: `GRN-${Math.floor(Math.random() * 10000)}`,
            invoice_number: `INV-${Math.floor(Math.random() * 10000)}`,
            amount: amount,
            expected_payment_date: new Date().toISOString(),
            goods_category: narration
        };

        const submitInvoiceForm = async () => {
            setStatus('processing');
            setLogs(prev => [...prev, '> INVOICE DATA RECEIVED, SENDING TO BACKEND...', '> POST /api/invoices']);

            try {
                const token = localStorage.getItem('token');
                const lenderId = localStorage.getItem('sherlock-lender-id') || '1';

                const response = await fetch('http://localhost:3000/api/invoices', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'x-lender-id': lenderId
                    },
                    body: JSON.stringify(invoicePayload)
                });

                if (!response.ok) {
                    const text = await response.text();
                    try {
                        const err = JSON.parse(text);
                        throw new Error(err.error || text);
                    } catch {
                        throw new Error(`HTTP ${response.status}: ${text}`);
                    }
                }

                const result = await response.json();
                setLogs(prev => [...prev, '> SYSTEM: INVOICE SUCCESSFULLY PROCESSED', `> Status: ${result.status}`, `> Risk Score: ${result.riskScore}`]);
                setStatus('complete');

            } catch (error: any) {
                setLogs(prev => [...prev, '> FATAL: BACKEND REJECTED INVOICE.', `> DETAILS: ${error.message || error.toString()}`]);
                setStatus('idle');
            }
        };

        submitInvoiceForm();
    };

    const handleAddPartner = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPartnerName.trim()) return;

        try {
            await createCompanyMutation.mutateAsync({ name: newPartnerName });
            setLogs(prev => [...prev, `> NEW PARTNER CREATED: ${newPartnerName}`]);
            setNewPartnerName("");
            setShowAddPartner(false);
            refetchCompanies();
        } catch (err: any) {
            setLogs(prev => [...prev, `> ERROR CREATING PARTNER: ${err.message}`]);
        }
    };

    return (
        <div className="flex-1 overflow-auto bg-transparent p-4 md:p-8 custom-scrollbar flex flex-col space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground glow-text tracking-tight flex items-center gap-3">
                        <Database className="w-8 h-8 text-primary" />
                        Data Ingestion Portal
                    </h1>
                    <p className="text-muted-foreground mt-1 font-mono text-sm">Upload bulk files or manually enter records into the validation pipeline.</p>
                </div>
            </header>

            {/* Main Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8 flex-1">

                {/* Left Column: Upload & Manual Entry */}
                <div className="flex flex-col gap-6">
                    {/* Drag and Drop */}
                    <div
                        className={`bg-card rounded-2xl p-6 glow-card border border-border/50 relative overflow-hidden flex flex-col group transition-all h-64
                            ${(status === 'idle' || status === 'complete') ? 'cursor-pointer hover:border-primary/50' : 'opacity-80'}`}
                    >
                        {/* Hidden File Input */}
                        {(status === 'idle' || status === 'complete') && (
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                        )}

                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                            {status === 'idle' || status === 'complete' ? (
                                <>
                                    <div className="p-4 bg-muted/30 rounded-full group-hover:bg-primary/20 transition-colors">
                                        <UploadCloud className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-foreground">Secure System Upload</h3>
                                        <p className="text-sm text-muted-foreground mt-1 max-w-[250px] mx-auto">Click to browse and upload `retail_transactions.json`.</p>
                                    </div>
                                </>
                            ) : status === 'uploading' ? (
                                <>
                                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                    <h3 className="text-lg font-bold text-primary animate-pulse">Uploading Extract...</h3>
                                </>
                            ) : (
                                <>
                                    <Server className="w-12 h-12 text-warning animate-pulse" />
                                    <h3 className="text-lg font-bold text-warning glow-text">Engine Processing Batch</h3>
                                    <p className="text-sm text-muted-foreground">Running validation pipelines...</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Manual Entry Form */}
                    <div className="bg-card rounded-2xl p-6 glow-card border border-border/50 flex-1 relative">
                        {status === 'processing' && <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-10 rounded-2xl" />}

                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                <h2 className="text-xl font-bold text-foreground glow-text uppercase tracking-wider">Single Invoice Entry</h2>
                            </div>
                            <button 
                                onClick={() => setShowAddPartner(!showAddPartner)}
                                className="text-[10px] text-primary hover:underline uppercase font-bold tracking-widest bg-primary/5 px-2 py-1 rounded border border-primary/20"
                            >
                                {showAddPartner ? "Back to Entry" : "+ Add Partner"}
                            </button>
                        </div>

                        {showAddPartner ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <p className="text-[10px] text-muted-foreground uppercase font-mono">Create new entity in ecosystem</p>
                                <form onSubmit={handleAddPartner} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs text-muted-foreground uppercase font-mono">Partner Name</label>
                                        <input 
                                            type="text" 
                                            value={newPartnerName}
                                            onChange={(e) => setNewPartnerName(e.target.value)}
                                            placeholder="e.g. Reliance Logistics"
                                            className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary focus:outline-none font-mono"
                                        />
                                    </div>
                                    <button 
                                        type="submit" 
                                        disabled={createCompanyMutation.isPending}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-xl hover:bg-primary/30 transition-all font-bold tracking-wide uppercase group"
                                    >
                                        {createCompanyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        Register Entity
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <form className="space-y-4 font-mono text-sm" onSubmit={handleSimulation}>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs text-muted-foreground uppercase">Sender (Supplier)</label>
                                    <div className="relative">
                                        <select 
                                            value={senderId}
                                            onChange={(e) => setSenderId(e.target.value)}
                                            required
                                            className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary focus:outline-none appearance-none disabled:opacity-50"
                                            disabled={isLoadingCompanies}
                                        >
                                            <option value="">{isLoadingCompanies ? "Loading Partners..." : companiesError ? "Error Loading Data" : "Select Entity..."}</option>
                                            {companies?.map((c: any) => (
                                                <option key={c.id} value={c.id}>{c.name} ({c.tier})</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs text-muted-foreground uppercase">Receiver (Buyer)</label>
                                    <div className="relative">
                                        <select 
                                            value={receiverId}
                                            onChange={(e) => setReceiverId(e.target.value)}
                                            required
                                            className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary focus:outline-none appearance-none disabled:opacity-50"
                                            disabled={isLoadingCompanies}
                                        >
                                            <option value="">{isLoadingCompanies ? "Loading Partners..." : companiesError ? "Error Loading Data" : "Select Entity..."}</option>
                                            {companies?.map((c: any) => (
                                                <option key={c.id} value={c.id}>{c.name} ({c.tier})</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs text-muted-foreground uppercase">Narration</label>
                                <div className="relative">
                                    <select name="narration" className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary focus:outline-none appearance-none">
                                        <option value="Salary Credit">Salary Credit</option>
                                        <option value="Personal Transfer">Personal Transfer</option>
                                        <option value="Loan Repayment">Loan Repayment (Carousel Risk)</option>
                                        <option value="Consulting Fee">Consulting Fee (Carousel Risk)</option>
                                        <option value="Vendor Payment">Vendor Payment (Loop Signal)</option>
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs text-muted-foreground uppercase">Amount (INR)</label>
                                    <input type="number" name="amount" defaultValue={45000} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-foreground focus:ring-1 focus:ring-primary focus:outline-none" />
                                </div>
                                <div className="space-y-1.5 flex flex-col justify-end">
                                    <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded border border-border/50 h-full flex items-center">
                                        <span><span className="font-bold text-primary">Engine Logic:</span> Selecting 'Mule' entities or 'Carousel' narrations will trigger automated quarantine.</span>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 text-primary border border-primary/30 rounded-xl hover:bg-primary/20 transition-all font-bold tracking-wide uppercase group disabled:opacity-50" disabled={status === 'processing' || status === 'uploading'}>
                                <Server className="w-4 h-4 group-hover:animate-pulse" />
                                Submit to Pipeline
                            </button>
                        </form>
                    )}
                </div>
            </div>

                {/* Right Column: Processing Terminal */}
                <div className="bg-black/90 rounded-2xl p-6 border border-primary/20 flex flex-col h-full font-mono relative overflow-hidden shadow-[0_0_30px_rgba(54,255,143,0.05)]">
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-primary/20">
                        <Terminal className="w-5 h-5 text-primary" />
                        <span className="text-primary font-bold tracking-wider uppercase text-sm">Validation Engine Pipeline</span>
                        <div className="ml-auto flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-destructive/80"></div>
                            <div className="w-3 h-3 rounded-full bg-warning/80"></div>
                            <div className="w-3 h-3 rounded-full bg-primary/80"></div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar text-xs leading-relaxed space-y-2 text-muted-foreground pr-2">
                        {logs.map((logItem, index) => {
                            const log = String(logItem || '');
                            return (
                                <div key={index} className={
                                    log.includes('CRITICAL') || log.includes('BLOCKED') ? 'text-destructive font-bold' :
                                        log.includes('WARNING') ? 'text-warning font-bold' :
                                            log.includes('OK') || log.includes('CLEAN') || log.includes('APPROVED') ? 'text-primary' :
                                                ''
                                }>
                                    {log}
                                </div>
                            );
                        })}
                        {status === 'processing' && <div className="text-primary animate-pulse">_</div>}
                        {status === 'idle' && <div className="text-primary animate-pulse mt-4">&gt; Ready.</div>}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
}
