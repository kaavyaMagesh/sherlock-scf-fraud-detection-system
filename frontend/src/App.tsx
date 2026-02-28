import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import PlaceholderPage from "@/pages/placeholder";
import { AppSidebar } from "@/components/layout/sidebar";

function Router() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-hidden relative">
        {/* Ambient background glow effect */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] pointer-events-none rounded-full"></div>
        <Switch>
          <Route path="/" component={Dashboard}/>
          <Route path="/topology" component={() => <PlaceholderPage title="Network Topology" />}/>
          <Route path="/verification" component={() => <PlaceholderPage title="Verification Center" />}/>
          <Route path="/alerts" component={() => <PlaceholderPage title="Anomaly Alerts" />}/>
          <Route path="/velocity" component={() => <PlaceholderPage title="Velocity Monitor" />}/>
          <Route path="/settings" component={() => <PlaceholderPage title="System Config" />}/>
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
