import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

type AuthState = { user: User | null; ready: boolean; openAccount: () => void };
const AuthContext = createContext<AuthState | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) { setUser(data.session?.user ?? null); setReady(true); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      setUser(session?.user ?? null);
      setReady(true);
      if (event === "SIGNED_IN") { setOpen(false); setPassword(""); }
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  const openAccount = () => { setError(""); setOpen(true); };
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      if (user) {
        const { error } = await supabase.auth.updateUser({ data: { display_name: name.trim() } });
        if (error) throw error;
        toast.success("Profile updated"); setOpen(false);
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/auth/reset" });
        if (error) throw error;
        toast.success("Check your email for a password reset link");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) toast.success("Check your email to confirm your account");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setOpen(false);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update your account."); }
    finally { setBusy(false); }
  }
  return <AuthContext.Provider value={{ user, ready, openAccount }}>
    {children}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{user ? "Your account" : mode === "signup" ? "Create your Kiln account" : mode === "reset" ? "Reset password" : "Sign in to Kiln"}</DialogTitle>
          <DialogDescription>{user ? user.email : "Your conversations, in your workspace."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {(user || mode === "signup") && <div className="space-y-2"><Label htmlFor="account-name">Display name</Label><Input id="account-name" value={name} placeholder={user?.user_metadata?.['display_name'] ?? "Your name"} onChange={e => setName(e.target.value)} required /></div>}
          {!user && <div className="space-y-2"><Label htmlFor="account-email">Email</Label><Input id="account-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>}
          {!user && mode !== "reset" && <div className="space-y-2"><Label htmlFor="account-password">Password</Label><Input id="account-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></div>}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <Button disabled={busy} className="w-full" type="submit">{busy ? "Please wait…" : user ? "Save profile" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}</Button>
        </form>
        {!user && <>
          {mode !== "reset" && <Button variant="outline" disabled={busy} onClick={async () => {
            setBusy(true); setError("");
            try { const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin }); if (result.error) setError(result.error.message); }
            catch { setError("Google sign-in could not start."); }
            finally { setBusy(false); }
          }}>Continue with Google</Button>}
          <div className="flex justify-between"><Button size="sm" variant="link" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}>{mode === "signup" ? "Already have an account?" : "Create an account"}</Button><Button size="sm" variant="link" onClick={() => { setMode(mode === "reset" ? "signin" : "reset"); setError(""); }}>{mode === "reset" ? "Back to sign in" : "Forgot password?"}</Button></div>
        </>}
        {user && <Button variant="outline" onClick={async () => { const { error } = await supabase.auth.signOut(); if (error) { setError(error.message); return; } setOpen(false); }}>Sign out</Button>}
      </DialogContent>
    </Dialog>
  </AuthContext.Provider>;
}
export function useAccount() { const value = useContext(AuthContext); if (!value) throw new Error("AccountProvider is required"); return value; }