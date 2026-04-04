import { useState, useEffect } from "react";
import { Package, Truck, FileText, Database, ShieldAlert, Plus, CheckCircle2, Shield, Loader2, DollarSign, AlertCircle, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanies } from "@/hooks/use-dashboard-data";

interface AuthUser {
    id: string;
    role: "BUYER" | "SUPPLIER" | "LENDER";
    company_id: string;
    lender_id: string;
}

export default function ERPPortalPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [activeTab, setActiveTab] = useState<string>("");

    useEffect(() => {
        const token = localStorage.getItem("token");
        const role = (localStorage.getItem("userRole") || "").toUpperCase();
        const companyId = localStorage.getItem("companyId");
        if (!token || !role || role === 'LENDER') {
            // Lenders handled externally
        } else {
            setUser({
                id: localStorage.getItem("userId") || "",
                role: role as "BUYER" | "SUPPLIER" | "LENDER",
                company_id: companyId || "",
                lender_id: localStorage.getItem("sherlock-lender-id") || ""
            });
            if (role === "BUYER") setActiveTab("POs");
            if (role === "SUPPLIER") setActiveTab("MyPOs");
        }
    }, []);

    if (!user) {
        return <div className="flex h-full w-full items-center justify-center bg-background text-muted-foreground font-mono">Unauthorized access. Please login with correct persona.</div>;
    }

    return (
        <div className="flex flex-col h-full w-full bg-background p-6 md:p-10 custom-scrollbar overflow-auto relative">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] pointer-events-none rounded-full" />

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground glow-text tracking-tight flex items-center gap-3">
                        <Database className="w-8 h-8 text-primary" />
                        ERP Partner Portal
                    </h1>
                    <p className="text-muted-foreground mt-1 font-mono text-sm uppercase tracking-widest flex items-center gap-2">
                        <span className="text-primary font-bold">{user.role}</span> TERMINAL / {user.company_id}
                    </p>
                </div>
            </header>

            {user.role === "BUYER" && <BuyerDashboard activeTab={activeTab} setActiveTab={setActiveTab} />}
            {user.role === "SUPPLIER" && <SupplierDashboard activeTab={activeTab} setActiveTab={setActiveTab} />}
        </div>
    );
}

function BuyerDashboard({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
    const queryClient = useQueryClient();
    const { companies } = useCompanies();
    const suppliers = companies?.filter(c => c.tier === 2 || c.name.toLowerCase().includes('supplier') || c.id > 3) || []; // Based on seed logic

    const fetchApi = async (endpoint: string) => {
        const res = await fetch(`http://localhost:3000/api/erp/${endpoint}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (!res.ok) throw new Error("Failed");
        return res.json();
    };

    const postApi = async ({ endpoint, payload }: { endpoint: string, payload: any }) => {
        const res = await fetch(`http://localhost:3000/api/erp/${endpoint}`, {
            method: 'POST',
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Failed to submit");
        return res.json();
    };

    const { data: pos, isLoading: loadingPos } = useQuery({ queryKey: ["buyer-pos"], queryFn: () => fetchApi('purchase-orders') });
    const { data: grns, isLoading: loadingGrns } = useQuery({ queryKey: ["buyer-grns"], queryFn: () => fetchApi('goods-receipts') });
    const { data: deliveries, isLoading: loadingDeliveries } = useQuery({ queryKey: ["buyer-deliveries"], queryFn: () => fetchApi('deliveries') });
    const { data: invoices, isLoading: loadingInvoices } = useQuery({ queryKey: ["buyer-invoices"], queryFn: () => fetchApi('buyer-invoices') });

    const mutation = useMutation({
        mutationFn: postApi,
        onSuccess: (data, variables) => {
            if (variables.endpoint === 'purchase-orders') queryClient.invalidateQueries({ queryKey: ["buyer-pos"] });
            if (variables.endpoint === 'goods-receipts') queryClient.invalidateQueries({ queryKey: ["buyer-grns"] });
            if (variables.endpoint === 'deliveries') queryClient.invalidateQueries({ queryKey: ["buyer-deliveries"] });
            if (variables.endpoint === 'disputes') queryClient.invalidateQueries({ queryKey: ["buyer-invoices"] });
            setShowForm(false);
            setShowDisputeModal(null);
        }
    });

    const [showForm, setShowForm] = useState(false);
    const [showDisputeModal, setShowDisputeModal] = useState<string | null>(null);

    // Form states
    const [poForm, setPoForm] = useState({ supplier_id: '', amount: '', quantity: '', goods_category: '', po_date: new Date().toISOString().split('T')[0], parent_po_id: '' });
    const [grnForm, setGrnForm] = useState({ po_id: '', amount_received: '', quantity: '', goods_category: '', receipt_date: new Date().toISOString().split('T')[0] });
    const [delForm, setDelForm] = useState({ grn_id: '', confirmed_by: '', delivery_status: 'DELIVERED', notes: '', delivery_date: new Date().toISOString().split('T')[0] });
    const [disputeForm, setDisputeForm] = useState({ dispute_reason: 'GOODS_RETURNED', dispute_notes: '' });

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (activeTab === 'POs') mutation.mutate({ endpoint: 'purchase-orders', payload: poForm });
        if (activeTab === 'GRNs') mutation.mutate({ endpoint: 'goods-receipts', payload: grnForm });
        if (activeTab === 'Deliveries') mutation.mutate({ endpoint: 'deliveries', payload: delForm });
    };

    return (
        <div className="flex-1 flex flex-col space-y-6">
            <div className="flex space-x-2 border-b border-border/50 pb-2">
                {['POs', 'GRNs', 'Deliveries', 'Invoices'].map((tab) => (
                    <button key={tab} onClick={() => { setActiveTab(tab); setShowForm(false); }} className={`px-4 py-2 font-mono text-sm tracking-wider uppercase transition-all rounded-lg ${activeTab === tab ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-foreground hover:bg-muted/50'}`}>
                        {tab === 'POs' && <FileText className="w-4 h-4 inline mr-2" />}
                        {tab === 'GRNs' && <Package className="w-4 h-4 inline mr-2" />}
                        {tab === 'Deliveries' && <Truck className="w-4 h-4 inline mr-2" />}
                        {tab === 'Invoices' && <ShieldAlert className="w-4 h-4 inline mr-2" />}
                        {tab}
                    </button>
                ))}
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-lg glow-card flex-1 flex flex-col relative transition-all">
                <div className="flex justify-between items-center mb-6 border-b border-border/20 pb-4">
                    <h2 className="text-xl font-bold glow-text tracking-wide">{activeTab === 'POs' ? 'Purchase Orders' : activeTab === 'GRNs' ? 'Goods Receipts' : activeTab === 'Deliveries' ? 'Delivery Confirmations' : 'Supplier Invoices'}</h2>
                    {activeTab !== 'Invoices' && (
                        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold font-mono uppercase bg-primary/10 text-primary border border-primary/30 rounded shadow hover:bg-primary/20 transition-all">
                            {showForm ? 'Cancel Entry' : '+ Add New'}
                        </button>
                    )}
                </div>

                {showForm && (
                    <div className="mb-8 p-6 bg-muted/20 border border-primary/20 rounded-xl">
                        <form onSubmit={handleFormSubmit} className="space-y-4 font-mono text-sm">
                            {/* PO FORM */}
                            {activeTab === 'POs' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Supplier</label>
                                        <select required value={poForm.supplier_id} onChange={e => setPoForm({ ...poForm, supplier_id: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary">
                                            <option value="">Select Supplier...</option>
                                            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Amount</label>
                                        <input required type="number" value={poForm.amount} onChange={e => setPoForm({ ...poForm, amount: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Quantity</label>
                                        <input required type="number" value={poForm.quantity} onChange={e => setPoForm({ ...poForm, quantity: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Goods Category</label>
                                        <input required type="text" placeholder="e.g. Auto Parts" value={poForm.goods_category} onChange={e => setPoForm({ ...poForm, goods_category: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">PO Date</label>
                                        <input required type="date" value={poForm.po_date} onChange={e => setPoForm({ ...poForm, po_date: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Parent PO ID (Optional)</label>
                                        <select value={poForm.parent_po_id} onChange={e => setPoForm({ ...poForm, parent_po_id: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary">
                                            <option value="">None (Root PO)</option>
                                            {pos?.map((p: any) => <option key={p.id} value={p.id}>PO-{p.id} | ${p.amount}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* GRN FORM */}
                            {activeTab === 'GRNs' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Target Purchase Order</label>
                                        <select required value={grnForm.po_id} onChange={e => setGrnForm({ ...grnForm, po_id: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary">
                                            <option value="">Select PO...</option>
                                            {pos?.map((p: any) => <option key={p.id} value={p.id}>PO-{p.id} | {p.supplier_name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Amount Received Value ($)</label>
                                        <input required type="number" value={grnForm.amount_received} onChange={e => setGrnForm({ ...grnForm, amount_received: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Units Received (Quantity)</label>
                                        <input required type="number" value={grnForm.quantity} onChange={e => setGrnForm({ ...grnForm, quantity: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Goods Category / Description</label>
                                        <input type="text" placeholder="e.g. Scraps or Steel" value={grnForm.goods_category} onChange={e => setGrnForm({ ...grnForm, goods_category: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Receipt Date</label>
                                        <input required type="date" value={grnForm.receipt_date} onChange={e => setGrnForm({ ...grnForm, receipt_date: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary" />
                                    </div>
                                </div>
                            )}

                            {/* DELIVERY FORM */}
                            {activeTab === 'Deliveries' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Target GRN</label>
                                        <select required value={delForm.grn_id} onChange={e => setDelForm({ ...delForm, grn_id: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary">
                                            <option value="">Select GRN...</option>
                                            {grns?.map((g: any) => <option key={g.id} value={g.id}>GRN-{g.id} against PO-{g.po_id}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Status</label>
                                        <select required value={delForm.delivery_status} onChange={e => setDelForm({ ...delForm, delivery_status: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary border-l-4 border-l-primary">
                                            <option value="DELIVERED">DELIVERED (Full)</option>
                                            <option value="PARTIAL">PARTIAL</option>
                                            <option value="REJECTED">REJECTED (Issue)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Confirmed By</label>
                                        <input required type="text" placeholder="e.g. Warehouse Lead" value={delForm.confirmed_by} onChange={e => setDelForm({ ...delForm, confirmed_by: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Notes</label>
                                        <input type="text" value={delForm.notes} onChange={e => setDelForm({ ...delForm, notes: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-muted-foreground text-xs uppercase tracking-wider">Delivery Date</label>
                                        <input required type="date" value={delForm.delivery_date} onChange={e => setDelForm({ ...delForm, delivery_date: e.target.value })} className="w-full bg-background border border-border/50 rounded p-2 text-foreground focus:ring-primary focus:border-primary" />
                                    </div>
                                </div>
                            )}
                            <button type="submit" disabled={mutation.isPending} className="mt-4 px-6 py-2 bg-primary/20 text-primary border border-primary/40 rounded shadow font-bold tracking-widest hover:bg-primary/30 transition-colors">
                                {mutation.isPending ? 'Submitting...' : 'SAVE ENTRY'}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'POs' && <TableLayout data={pos} loading={loadingPos} columns={["id", "supplier_name", "amount", "quantity", "goods_category", "po_date"]} />}
                {activeTab === 'GRNs' && <TableLayout data={grns} loading={loadingGrns} columns={["id", "po_id", "amount_received", "quantity", "grn_date"]} />}
                {activeTab === 'Deliveries' && <TableLayout data={deliveries} loading={loadingDeliveries} columns={["id", "po_id", "grn_id", "confirmed_by", "delivery_status", "delivery_date"]} />}
                {activeTab === 'Invoices' && (
                    <div className="space-y-4">
                        <TableLayout
                            data={invoices}
                            loading={loadingInvoices}
                            columns={["id", "supplier_name", "amount", "goods_category", "invoice_date", "status"]}
                            actions={(row) => (
                                <button
                                    onClick={() => {
                                        setShowDisputeModal(row.id);
                                        setDisputeForm({ dispute_reason: 'GOODS_RETURNED', dispute_notes: '' });
                                    }}
                                    disabled={row.status === 'DISPUTED'}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold border transition-all ${row.status === 'DISPUTED' ? 'bg-muted text-muted-foreground border-border' : 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20'}`}
                                >
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                    {row.status === 'DISPUTED' ? 'DISPUTED' : 'RAISE DISPUTE'}
                                </button>
                            )}
                        />
                    </div>
                )}

                {/* Dispute Modal */}
                {showDisputeModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-card border border-border/50 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-border/20">
                                <h3 className="text-xl font-bold glow-text flex items-center gap-2">
                                    <AlertCircle className="w-6 h-6 text-destructive" />
                                    Raise Formal Dispute
                                </h3>
                                <p className="text-muted-foreground text-xs font-mono mt-1 uppercase tracking-tight">Invoice System Reference #{showDisputeModal}</p>
                            </div>
                            <form className="p-6 space-y-4 font-mono text-sm" onSubmit={(e) => {
                                e.preventDefault();
                                mutation.mutate({
                                    endpoint: 'disputes',
                                    payload: {
                                        invoice_id: showDisputeModal,
                                        ...disputeForm
                                    }
                                });
                            }}>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Reason for Dispute</label>
                                    <select required value={disputeForm.dispute_reason} onChange={e => setDisputeForm({ ...disputeForm, dispute_reason: e.target.value })} className="w-full p-2.5 bg-background border border-border/50 rounded-lg focus:border-primary outline-none appearance-none">
                                        <option value="GOODS_RETURNED">GOODS_RETURNED (Dilution)</option>
                                        <option value="QUALITY_ISSUE">QUALITY_ISSUE (Dilution)</option>
                                        <option value="QUANTITY_MISMATCH">QUANTITY_MISMATCH</option>
                                        <option value="FRAUDULENT">FRAUDULENT (Direct Signal)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Detailed Notes</label>
                                    <textarea
                                        required
                                        rows={3}
                                        placeholder="Provide evidence or details regarding the dispute..."
                                        value={disputeForm.dispute_notes}
                                        onChange={e => setDisputeForm({ ...disputeForm, dispute_notes: e.target.value })}
                                        className="w-full p-2.5 bg-background border border-border/50 rounded-lg focus:border-primary outline-none resize-none"
                                    />
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button type="button" onClick={() => setShowDisputeModal(null)} className="flex-1 py-2.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded-xl transition-all font-bold tracking-widest text-xs uppercase">Cancel</button>
                                    <button type="submit" disabled={mutation.isPending} className="flex-1 py-2.5 bg-destructive/20 text-destructive border border-destructive/40 hover:bg-destructive/30 rounded-xl transition-all font-bold tracking-widest text-xs uppercase flex items-center justify-center gap-2">
                                        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                                        SUBMIT DISPUTE
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function SupplierDashboard({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
    const fetchApi = async (endpoint: string) => {
        const res = await fetch(`http://localhost:3000/api/erp/${endpoint}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (!res.ok) throw new Error("Failed");
        return res.json();
    };

    const submitInvoice = async (payload: any) => {
        const res = await fetch(`http://localhost:3000/api/invoices`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
                "x-lender-id": localStorage.getItem("sherlock-lender-id") || "1"
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to submit invoice");
        }
        return res.json();
    };

    const { data: pos, isLoading: loadingPos } = useQuery({ queryKey: ["supplier-pos"], queryFn: () => fetchApi('my-purchase-orders') });

    const [invForm, setInvForm] = useState({
        po_id: '',
        invoice_number: '',
        amount: '',
        goods_category: '',
        invoice_date: new Date().toISOString().split('T')[0]
    });
    const [invResult, setInvResult] = useState<{ status: string, riskScore: number } | null>(null);
    const [invError, setInvError] = useState('');

    const mutation = useMutation({
        mutationFn: submitInvoice,
        onSuccess: (data) => {
            setInvResult({ status: data.status, riskScore: data.riskScore });
            setInvError('');
            setInvForm({ po_id: '', invoice_number: '', amount: '', goods_category: '', invoice_date: new Date().toISOString().split('T')[0] });
        },
        onError: (err: any) => {
            setInvError(err.message);
            setInvResult(null);
        }
    });

    const handleInvoiceSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Find mapped PO logic!
        const selectedPo = pos?.find((p: any) => p.id.toString() === invForm.po_id);
        if (!selectedPo) {
            setInvError("Invalid PO Selected");
            return;
        }

        const payload = {
            po_id: parseInt(invForm.po_id, 10),
            supplier_id: parseInt(selectedPo.supplier_id, 10),
            buyer_id: parseInt(selectedPo.buyer_id, 10),
            invoice_number: invForm.invoice_number,
            amount: parseFloat(invForm.amount),
            invoice_date: invForm.invoice_date,
            expected_payment_date: new Date().toISOString(),
            goods_category: invForm.goods_category || selectedPo.goods_category || "Unclassified"
        };
        mutation.mutate(payload);
    };

    return (
        <div className="flex-1 flex flex-col space-y-6">
            <div className="flex space-x-2 border-b border-border/50 pb-2">
                {['MyPOs', 'SubmitInvoice'].map((tab) => (
                    <button key={tab} onClick={() => { setActiveTab(tab); setInvResult(null); }} className={`px-4 py-2 font-mono text-sm tracking-wider uppercase transition-all rounded-lg ${activeTab === tab ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-foreground hover:bg-muted/50'}`}>
                        {tab === 'MyPOs' && <FileText className="w-4 h-4 inline mr-2" />}
                        {tab === 'SubmitInvoice' && <Plus className="w-4 h-4 inline mr-2" />}
                        {tab.replace('MyPOs', 'My Purchase Orders').replace('SubmitInvoice', 'Submit Invoice against PO')}
                    </button>
                ))}
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-lg glow-card flex-1">
                {activeTab === 'MyPOs' && (
                    <TableLayout data={pos} loading={loadingPos} columns={["id", "buyer_name", "amount", "quantity", "goods_category", "po_date"]} />
                )}
                {activeTab === 'SubmitInvoice' && (
                    <div className="max-w-2xl mx-auto mt-6">
                        <div className="flex items-center gap-3 mb-6 bg-primary/5 p-4 rounded-xl border border-primary/20">
                            <ShieldAlert className="w-6 h-6 text-primary" />
                            <div>
                                <h3 className="font-bold text-sm tracking-wide glow-text">Automated Sherlock Validation</h3>
                                <p className="text-xs text-muted-foreground">Upon submission, this invoice will automatically cross-reference underlying POs, Goods Receipts, deliveries, and anomalous behavioral patterns.</p>
                            </div>
                        </div>

                        {invError && <div className="mb-4 p-3 bg-destructive/10 text-destructive border border-destructive/20 text-xs font-mono rounded">{invError}</div>}
                        {invResult && (
                            <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-xl space-y-2">
                                <div className="flex items-center gap-2 text-primary font-bold"><CheckCircle2 className="w-5 h-5" /> INVOICE SUBMITTED & PROCESSED</div>
                                <div className="grid grid-cols-2 gap-4 mt-2 font-mono text-sm">
                                    <div className="bg-background/50 p-2 rounded">Status: <span className="text-secondary glow-text">{invResult.status}</span></div>
                                    <div className="bg-background/50 p-2 rounded">Risk Score: <span className="text-warning glow-text">{invResult.riskScore}</span></div>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleInvoiceSubmit} className="space-y-5 font-mono text-sm bg-muted/10 p-6 rounded-2xl border border-border/50 shadow-inner">
                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-wider text-muted-foreground">Select Purchase Order</label>
                                <select required value={invForm.po_id} onChange={e => setInvForm({ ...invForm, po_id: e.target.value })} className="w-full p-2.5 bg-background border border-border/50 rounded focus:border-primary outline-none">
                                    <option value="">Choose an open PO...</option>
                                    {pos?.map((p: any) => <option key={p.id} value={p.id}>PO-{p.id} | {p.buyer_name} | ${p.amount}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-wider text-muted-foreground">Invoice Reference Number</label>
                                <input required type="text" placeholder="e.g. INV-8822" value={invForm.invoice_number} onChange={e => setInvForm({ ...invForm, invoice_number: e.target.value })} className="w-full p-2.5 bg-background border border-border/50 rounded focus:border-primary outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Invoice Amount</label>
                                    <input required type="number" value={invForm.amount} onChange={e => setInvForm({ ...invForm, amount: e.target.value })} className="w-full p-2.5 bg-background border border-border/50 rounded focus:border-primary outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Goods Description (Optional)</label>
                                    <input type="text" placeholder="Overrides PO Category" value={invForm.goods_category} onChange={e => setInvForm({ ...invForm, goods_category: e.target.value })} className="w-full p-2.5 bg-background border border-border/50 rounded focus:border-primary outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Invoice Date</label>
                                    <input required type="date" value={invForm.invoice_date} onChange={e => setInvForm({ ...invForm, invoice_date: e.target.value })} className="w-full p-2.5 bg-background border border-border/50 rounded focus:border-primary outline-none" />
                                </div>
                            </div>
                            <button type="submit" disabled={mutation.isPending} className="w-full py-3 bg-primary/20 text-primary border border-primary/40 rounded-xl hover:bg-primary/30 transition-all font-bold tracking-widest mt-4">
                                {mutation.isPending ? 'VALIDATING...' : 'SUBMIT INVOICE'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}

function TableLayout({ data, loading, columns, actions }: { data: any[], loading: boolean, columns: string[], actions?: (row: any) => React.ReactNode }) {
    if (loading) return <div className="flex p-4 gap-2 items-center text-primary"><Loader2 className="w-5 h-5 animate-spin" /> Loading Data...</div>
    if (!data || data.length === 0) return <div className="p-4 text-muted-foreground uppercase text-xs tracking-widest font-mono">No records found. Fill forms to construct chain.</div>

    return (
        <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-xs uppercase font-mono tracking-wider text-muted-foreground">
                    <tr>
                        {columns.map(c => <th key={c} className="px-6 py-3">{c.replace('_', ' ')}</th>)}
                        {actions && <th className="px-6 py-3 text-right">Actions</th>}
                    </tr>
                </thead>
                <tbody className="font-mono divide-y divide-border/20">
                    {data.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                            {columns.map(c => (
                                <td key={c} className="px-6 py-4">
                                    {c === 'delivery_status' ? (
                                        <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${row[c] === 'DELIVERED' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>{row[c]}</span>
                                    ) : (c.includes('amount') || c === 'quantity') ? (
                                        <span className={c === 'quantity' ? "text-secondary" : "text-primary"}>{c === 'quantity' ? row[c] : '$' + Number(row[c]).toLocaleString()}</span>
                                    ) : c.includes('date') ? (
                                        new Date(row[c]).toLocaleDateString()
                                    ) : c === 'id' ? (
                                        <span className="opacity-50">#{row[c]}</span>
                                    ) : row[c]}
                                </td>
                            ))}
                            {actions && (
                                <td className="px-6 py-4 text-right">
                                    {actions(row)}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}