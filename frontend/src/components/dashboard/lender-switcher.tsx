import { useState, useEffect } from 'react';
import { Building2, ChevronDown } from 'lucide-react';

const LENDERS = [
  { id: '1', name: 'Global Alpha Bank' },
  { id: '2', name: 'Nexus Capital' },
  { id: '3', name: 'Apex Finance' },
  { id: '4', name: 'Summit Lending' },
  { id: '5', name: 'Horizon Trust' },
  { id: '6', name: 'Pinnacle Credit' },
];

export function LenderSwitcher() {
  const [activeId, setActiveId] = useState(localStorage.getItem('sherlock-lender-id') || '1');
  const [isOpen, setIsOpen] = useState(false);

  const activeLender = LENDERS.find(l => l.id === activeId) || LENDERS[0];

  const handleSwitch = (id: string) => {
    localStorage.setItem('sherlock-lender-id', id);
    setActiveId(id);
    setIsOpen(false);
    // Simple reload to refresh all hooks with new localStorage value
    window.location.reload();
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-card border border-border/50 rounded-full flex items-center gap-3 shadow-lg hover:border-primary/50 transition-all group"
      >
        <Building2 className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
        <div className="text-left">
          <div className="text-[10px] uppercase font-bold text-muted-foreground leading-none mb-0.5">Active Lender</div>
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            {activeLender.name}
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in zoom-in duration-200">
          <div className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border/30 mb-1">
            Choose Portfolio View
          </div>
          {LENDERS.map((lender) => (
            <button
              key={lender.id}
              onClick={() => handleSwitch(lender.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all ${
                activeId === lender.id 
                  ? 'bg-primary/10 text-primary font-bold border border-primary/20' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{lender.name}</span>
              {activeId === lender.id && <div className="w-1.5 h-1.5 rounded-full bg-primary glow-text" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
