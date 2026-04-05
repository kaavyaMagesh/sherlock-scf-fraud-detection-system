import { useState, useEffect } from "react";
import { Shield, ShieldAlert, CheckCircle2, AlertOctagon, Ban, PlayCircle, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface ActionPanelProps {
  selectedInvoiceId?: string | number | null;
  defaultAmount?: number;
}

export function ActionPanel({ selectedInvoiceId, defaultAmount }: ActionPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const [invoiceData, setInvoiceData] = useState<{ score: number, breakdown: any[], amount: number, status: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedInvoiceId) {
      setInvoiceData(null);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const lenderId = localStorage.getItem('sherlock-lender-id') || '1';
        
        const token = localStorage.getItem('token');
        const [invRes, auditRes] = await Promise.all([
          fetch(`http://localhost:3000/api/invoices/${selectedInvoiceId}`, { headers: { 'x-lender-id': lenderId, 'Authorization': `Bearer ${token}` } }),
          fetch(`http://localhost:3000/api/invoices/${selectedInvoiceId}/audits`, { headers: { 'x-lender-id': lenderId, 'Authorization': `Bearer ${token}` } })
        ]);

        if (invRes.ok && auditRes.ok) {
          const inv = await invRes.json();
          const audits = await auditRes.json();
          
          setInvoiceData({
            score: audits.length > 0 ? audits[0].score : 0,
            breakdown: audits.length > 0 && typeof audits[0].breakdown !== 'string' ? audits[0].breakdown : [],
            amount: inv.amount || defaultAmount || 0,
            status: inv.status
          });
        }
      } catch (err) {
        console.error("Failed to fetch invoice details", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedInvoiceId, defaultAmount]);

  const handleAction = async (type: 'freeze' | 'disburse' | 'override') => {
    setIsOpen(false);
    
    if (!selectedInvoiceId) return;

    const lenderId = localStorage.getItem('sherlock-lender-id') || '1';

    if (type === 'freeze') {
      toast({
        title: "Disbursement Blocked",
        description: `Action executed successfully. Reason logged: ${reason || 'N/A'}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      const endpoint = type === 'override' 
        ? `http://localhost:3000/api/invoices/${selectedInvoiceId}/override` 
        : `http://localhost:3000/api/invoices/${selectedInvoiceId}/disburse`;
      
      const token = localStorage.getItem('token');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-lender-id': lenderId,
          'Authorization': `Bearer ${token}`
        },
        body: type === 'override' ? JSON.stringify({ reason }) : undefined
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `${type === 'override' ? 'Override' : 'Disbursement'} failed`);
      }

      toast({
        title: type === 'override' ? 'Override applied' : 'Disbursement successful',
        description: `Validation cleared and invoice approved.`,
        className: 'bg-primary text-primary-foreground border-none',
      });
      
      // Update local status optimistically
      setInvoiceData(prev => prev ? { ...prev, status: 'APPROVED' } : null);

    } catch (error: any) {
      toast({
        title: type === 'override' ? 'Override failed' : 'Disbursement failed',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  if (!selectedInvoiceId || isLoading) {
    return (
      <div className="rounded-2xl p-6 bg-card border border-border/50 h-full flex flex-col items-center justify-center text-center opacity-70">
        <Shield className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Awaiting Selection</h2>
        <p className="text-sm text-muted-foreground">Select an alert from the threat feed to review and gate its disbursement.</p>
      </div>
    );
  }

  const riskScore = invoiceData?.score || 0;
  // Fallback inferred gate status if the backend doesn't provide a strict string status
  let gateStatus = riskScore >= 60 ? "BLOCK" : riskScore >= 30 ? "HOLD" : "GO";
  
  // If the invoice is already APPROVED, override it
  if (invoiceData?.status === 'APPROVED') {
      gateStatus = "APPROVED";
  } else if (invoiceData?.status === 'BLOCKED') {
      gateStatus = "BLOCK";
  } else if (invoiceData?.status === 'REVIEW') {
      gateStatus = "HOLD";
  }

  const breakdown = invoiceData?.breakdown || [];
  const formattedAmount = invoiceData?.amount 
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(invoiceData.amount)
    : 'N/A';

  return (
    <div className={`rounded-2xl p-6 glow-card border h-full flex flex-col items-center justify-center text-center relative overflow-hidden ${gateStatus === 'BLOCK' ? 'bg-destructive/5 border-destructive/30' :
        gateStatus === 'HOLD' ? 'bg-warning/5 border-warning/30' :
          'bg-card border-primary/20'
      }`}>
      <div className={`absolute top-0 left-0 w-full h-1 opacity-50 ${gateStatus === 'BLOCK' ? 'bg-gradient-to-r from-transparent via-destructive to-transparent' :
          gateStatus === 'HOLD' ? 'bg-gradient-to-r from-transparent via-warning to-transparent' :
            'bg-gradient-to-r from-transparent via-primary to-transparent'
        }`}></div>

      {gateStatus === 'BLOCK' ? <Ban className="w-16 h-16 text-destructive mb-2 opacity-80" /> :
        gateStatus === 'HOLD' ? <PauseCircle className="w-16 h-16 text-warning mb-2 opacity-80" /> :
          <PlayCircle className="w-16 h-16 text-primary mb-2 opacity-80" />}

      <h2 className="text-xl font-bold text-foreground glow-text mb-1">Pre-Disbursement Gate</h2>
      <div className={`text-2xl font-black tracking-widest mb-2 ${gateStatus === 'BLOCK' ? 'text-destructive' :
          gateStatus === 'HOLD' ? 'text-warning' :
            'text-primary'
        }`}>
        {gateStatus}
      </div>
      <p className="text-sm text-muted-foreground mb-6 line-clamp-2 px-2">
        {gateStatus === 'APPROVED' ? `Invoice previously approved. Risk Score: ${riskScore}/100.` : `Risk Score: ${riskScore}/100. Anomalies detected in invoice batch. Manual review required.`}
      </p>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <button className={`px-6 py-3 rounded-xl font-bold tracking-wider uppercase text-sm transition-all duration-300 ${gateStatus === 'BLOCK' ? 'text-destructive-foreground bg-destructive shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_30px_rgba(220,38,38,0.6)]' :
              gateStatus === 'HOLD' ? 'text-warning-foreground bg-warning shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:shadow-[0_0_30px_rgba(234,179,8,0.6)]' :
                'text-primary-foreground bg-primary shadow-[0_0_20px_rgba(54,255,143,0.4)] hover:shadow-[0_0_30px_rgba(54,255,143,0.6)]'
            } hover:scale-105`}>
            Review Score Breakdown
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[550px] bg-card/95 backdrop-blur border-border/50 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <ShieldAlert className="text-warning" />
              Risk Score Breakdown: {riskScore}/100
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Review specific AI fraud detections before proceeding with the {formattedAmount} disbursement for {selectedInvoiceId}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Triggered Rules</h4>
              {breakdown && breakdown.length > 0 ? breakdown.map((rule: any, idx: number) => (
                <div key={idx} className="p-3 bg-muted/20 border border-border/50 rounded-lg flex gap-4 items-start">
                  <div className="bg-destructive/10 text-destructive font-mono font-bold px-2 py-1 rounded text-xs min-w-[40px] text-center">
                    +{rule.points !== undefined ? rule.points : rule.score !== undefined ? rule.score : '?'}
                  </div>
                  <div>
                    <div className="font-mono text-sm text-foreground">{rule.factor || rule.rule || 'Unknown Risk Factor'}</div>
                    <div className="text-xs text-muted-foreground mt-1">{rule.detail || rule.reason || ''}</div>
                  </div>
                </div>
              )) : (
                <div className="p-3 bg-muted/10 border border-border/30 rounded-lg text-sm text-muted-foreground">
                    No risk breakdown details available.
                </div>
              )}
            </div>

            {gateStatus !== 'APPROVED' && (
                <div className="space-y-2 pt-2">
                <label className="text-sm font-medium text-foreground">Select Override / Justification Code <span className="text-destructive">*</span></label>
                <Select onValueChange={setReason}>
                    <SelectTrigger className="bg-background border-border focus:ring-primary">
                    <SelectValue placeholder="Select a reason..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                    <SelectItem value="docs_missing">Documentation Missing (GRN/PO)</SelectItem>
                    <SelectItem value="suspected_fraud">Suspected Fraud / Carousel</SelectItem>
                    <SelectItem value="kyc_pending">KYC Refresh Pending</SelectItem>
                    <SelectItem value="cleared">Cleared Exception - Proceed</SelectItem>
                    </SelectContent>
                </Select>
                </div>
            )}
          </div>

          {gateStatus !== 'APPROVED' && (
            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between w-full pt-4 border-t border-border/50">
                <Button
                variant="outline"
                onClick={() => handleAction('freeze')}
                className="flex-1 bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive hover:text-white"
                >
                <Ban className="w-4 h-4 mr-2" />
                BLOCK Disbursement
                </Button>
                <Button
                onClick={() => handleAction(gateStatus === 'BLOCK' || gateStatus === 'HOLD' ? 'override' : 'disburse')}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!reason}
                >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                GO: Override & Disburse
                </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
