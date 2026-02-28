import { useState } from "react";
import { Shield, ShieldAlert, CheckCircle2, AlertOctagon } from "lucide-react";
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

export function ActionPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  const handleAction = (type: 'freeze' | 'disburse') => {
    setIsOpen(false);
    toast({
      title: type === 'freeze' ? "Disbursement Frozen" : "Funds Disbursed",
      description: `Action executed successfully. Reason logged: ${reason || 'N/A'}`,
      variant: type === 'freeze' ? 'destructive' : 'default',
      className: type === 'freeze' ? '' : 'bg-primary text-primary-foreground border-none',
    });
  };

  return (
    <div className="bg-card rounded-2xl p-6 glow-card border border-primary/20 h-full flex flex-col items-center justify-center text-center relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
      
      <Shield className="w-16 h-16 text-primary mb-4 opacity-80" />
      
      <h2 className="text-xl font-bold text-foreground glow-text mb-2">Pre-Disbursement Control</h2>
      <p className="text-sm text-muted-foreground mb-8">
        AI heuristics detect anomalies in current batch. Manual review required before fund release.
      </p>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <button className="px-8 py-4 rounded-xl font-bold tracking-wider text-primary-foreground bg-primary shadow-[0_0_20px_rgba(54,255,143,0.4)] hover:shadow-[0_0_30px_rgba(54,255,143,0.6)] hover:scale-105 transition-all duration-300 uppercase text-sm">
            Review Early Warning Alerts
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] bg-card/95 backdrop-blur border-border/50 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <AlertOctagon className="text-warning" />
              Action Required
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Review network anomalies before proceeding with the $1.25M batch disbursement.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-4">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive font-mono">
              CRITICAL: Unverified gap detected between T2 (Supplier A) and T3 (Manuf. X).
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Select Justification Code</label>
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
          </div>

          <DialogFooter className="flex gap-2 sm:justify-between w-full">
            <Button 
              variant="outline" 
              onClick={() => handleAction('freeze')}
              className="flex-1 bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive hover:text-white"
            >
              <ShieldAlert className="w-4 h-4 mr-2" />
              Freeze Disbursement
            </Button>
            <Button 
              onClick={() => handleAction('disburse')}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!reason}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Disburse Funds
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
