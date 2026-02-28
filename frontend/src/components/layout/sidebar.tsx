import { Link, useLocation } from "wouter";
import {
  Activity,
  LayoutDashboard,
  Network,
  ShieldCheck,
  BellRing,
  Upload
} from "lucide-react";

export function AppSidebar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/ingestion", label: "Data Ingestion", icon: Upload },
    { href: "/topology", label: "Network Topology", icon: Network },
    { href: "/verification", label: "Verification Center", icon: ShieldCheck },
    { href: "/alerts", label: "Anomaly Alerts", icon: BellRing },
    { href: "/velocity", label: "Velocity Monitor", icon: Activity },
  ];

  return (
    <div className="w-64 h-screen bg-sidebar border-r border-sidebar-border hidden md:flex flex-col flex-shrink-0 z-50">
      <div className="p-6">
        <div className="flex items-center gap-3 text-primary glow-text font-bold text-xl tracking-wider">
          <ShieldCheck className="w-8 h-8" />
          <span>SHERLOCK</span>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-mono">
          Fraud Detection System
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                ${isActive
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(54,255,143,0.05)]'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }
              `}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'group-hover:text-sidebar-foreground'}`} />
              <span className="font-medium text-sm">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 m-4 rounded-xl bg-background border border-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_5px_rgba(54,255,143,1)]"></div>
          <span className="text-xs font-mono text-muted-foreground">SYSTEM STATUS</span>
        </div>
        <p className="text-sm font-semibold text-primary glow-text">ALL SYSTEMS OPTIMAL</p>
      </div>
    </div>
  );
}
