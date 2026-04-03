import { useState } from "react";
import { LogIn, Shield, Database, Users } from "lucide-react";
import { useLocation } from "wouter";

export default function LoginPage() {
    const [, setLocation] = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("http://localhost:3000/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Login failed");
            }

            // Save token and user details
            localStorage.setItem("token", data.token);
            localStorage.setItem("userRole", data.user.role);
            localStorage.setItem("userId", data.user.id.toString());
            localStorage.setItem("companyId", data.user.company_id ? data.user.company_id.toString() : "");
            localStorage.setItem("sherlock-lender-id", data.user.lender_id ? data.user.lender_id.toString() : "1");

            if (data.user.role === 'LENDER') {
                setLocation("/");
            } else {
                setLocation("/erp-portal");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full items-center justify-center bg-background relative overflow-hidden">
            {/* Ambient background glow effect */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] pointer-events-none rounded-full" />
            
            <div className="w-full max-w-md p-8 bg-card rounded-2xl glow-card border border-border/50 relative z-10">
                <div className="flex flex-col items-center mb-8">
                    <Shield className="w-12 h-12 text-primary mb-4 animate-pulse" />
                    <h1 className="text-3xl font-bold text-foreground glow-text tracking-tight text-center">Sherlock Portal Access</h1>
                    <p className="text-muted-foreground mt-2 font-mono text-sm uppercase text-center tracking-widest">Identify to proceed</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg text-center font-mono">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground uppercase font-mono tracking-wider ml-1 flex items-center gap-2">
                            <Users className="w-3 h-3" /> User Email
                        </label>
                        <input 
                            type="email" 
                            className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-foreground focus:ring-1 focus:ring-primary focus:outline-none font-mono text-sm transition-all shadow-inner"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground uppercase font-mono tracking-wider ml-1 flex items-center gap-2">
                            <Database className="w-3 h-3" /> Security Hash
                        </label>
                        <input 
                            type="password" 
                            className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-foreground focus:ring-1 focus:ring-primary focus:outline-none font-mono text-sm transition-all shadow-inner"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 text-primary border border-primary/30 rounded-xl hover:bg-primary/20 transition-all font-bold tracking-widest uppercase group disabled:opacity-50"
                    >
                        <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        {loading ? "Authenticating..." : "Enter Terminal"}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-border/20 text-xs font-mono text-muted-foreground flex flex-col gap-2">
                    <p className="uppercase text-primary/70 mb-1">Demo Accounts (Password: password123):</p>
                    <p onClick={() => { setEmail("buyer@tatamotors.com"); setPassword(""); }} className="cursor-pointer hover:text-primary transition-colors">• buyer@tatamotors.com</p>
                    <p onClick={() => { setEmail("supplier@boschindia.com"); setPassword(""); }} className="cursor-pointer hover:text-primary transition-colors">• supplier@boschindia.com</p>
                    <p onClick={() => { setEmail("lender1@hdfc.com"); setPassword(""); }} className="cursor-pointer hover:text-primary transition-colors">• lender1@hdfc.com</p>
                </div>
            </div>
        </div>
    );
}
