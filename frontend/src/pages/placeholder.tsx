import { ShieldCheck } from "lucide-react";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full text-center p-8">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
        <ShieldCheck className="w-24 h-24 text-primary relative z-10 opacity-80" />
      </div>
      <h1 className="text-3xl font-bold text-foreground glow-text mb-2">{title} Module</h1>
      <p className="text-muted-foreground max-w-md font-mono text-sm">
        This sub-system is currently active but dedicated views are restricted in the current clearance level.
        Return to the main dashboard for aggregated telemetry.
      </p>
    </div>
  );
}
