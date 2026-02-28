import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Maximize2 } from "lucide-react";
import type { ReactNode } from "react";

interface ExpandableWrapperProps {
    children: ReactNode;
}

export function ExpandableWrapper({ children }: ExpandableWrapperProps) {
    return (
        <Dialog>
            <div className="relative h-full w-full group">
                {/* The underlying component */}
                {children}

                {/* The Expand Button overlay */}
                <DialogTrigger asChild>
                    <button
                        className="absolute top-4 right-4 p-2 rounded-lg bg-background/80 backdrop-blur border border-border/50 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-40"
                        title="Expand to window"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </DialogTrigger>
            </div>

            <DialogContent className="max-w-[85vw] w-full h-[85vh] p-0 border-border/50 bg-background overflow-hidden flex flex-col outline-none">
                {/* Re-render the child inside the massive modal, injecting h-full so it fills the modal */}
                <div className="flex-1 w-full h-full overflow-auto custom-scrollbar p-6">
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    );
}
