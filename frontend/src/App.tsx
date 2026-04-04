import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import NetworkTopologyPage from "@/pages/network-topology";
import VerificationCenterPage from "@/pages/verification-center";
import AnomalyAlertsPage from "@/pages/anomaly-alerts";
import VelocityMonitorPage from "@/pages/velocity-monitor";
import SupplierProfilePage from "@/pages/supplier-profile";
import DataIngestionPage from "@/pages/data-ingestion";
import { AppSidebar } from "@/components/layout/sidebar";

function Router() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {/* Ambient background glow effect */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] pointer-events-none rounded-full" />
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/topology" component={NetworkTopologyPage} />
          <Route path="/verification" component={VerificationCenterPage} />
          <Route path="/alerts" component={AnomalyAlertsPage} />
          <Route path="/velocity" component={VelocityMonitorPage} />
          <Route path="/ingestion" component={DataIngestionPage} />
          <Route path="/supplier/:id" component={SupplierProfilePage} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
