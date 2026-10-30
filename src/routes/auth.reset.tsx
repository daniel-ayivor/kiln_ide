import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export const Route = createFileRoute("/auth/reset")({
  head: () => ({ meta: [
    { title: "Reset password — Kiln" }, { name: "description", content: "Securely reset your Kiln account password." },
    { property: "og:title", content: "Reset password — Kiln" }, { property: "og:description", content: "Securely reset your Kiln account password." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: ResetPassword,
});
function ResetPassword() {
  const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setReady(true); }); return () => data.subscription.unsubscribe(); }, []);
  return <main className="flex h-screen items-center justify-center bg-background p-6"><form className="w-full max-w-sm space-y-4" onSubmit={async e => { e.preventDefault(); setBusy(true); const { error } = await supabase.auth.updateUser({ password }); setMessage(error ? error.message : "Password updated. You can return to Kiln."); setBusy(false); }}><h1 className="text-xl font-semibold">Reset your password</h1><Input type="password" aria-label="New password" placeholder="New password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /><Button type="submit" disabled={!ready || busy}>Update password</Button><p role="status" className="text-muted-foreground">{message || (!ready ? "Open the password reset link from your email." : "")}</p><a href="/" className="text-primary">Return to Kiln</a></form></main>;
}