import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export type DemoUser = { name: string; email: string; role: string };
type AccountState = {
  user: DemoUser | null;
  signIn: () => void;
  signOut: () => void;
  openProfile: () => void;
};
const AccountContext = createContext<AccountState | null>(null);
const DEMO: DemoUser = { name: "Ada Developer", email: "ada@kiln.dev", role: "Pro (demo)" };

/** Dummy, in-memory account. Nothing is stored or sent anywhere. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(DEMO);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(DEMO);
  const openProfile = () => { if (user) setDraft(user); setOpen(true); };
  return (
    <AccountContext.Provider value={{
      user,
      signIn: () => { setUser(DEMO); toast.success(`Signed in as ${DEMO.name}`); },
      signOut: () => { setUser(null); toast("Signed out of the demo account"); },
      openProfile,
    }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Demo only — changes last until you reload.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (!draft.name.trim()) return;
            setUser({ ...draft, name: draft.name.trim() });
            setOpen(false);
            toast.success("Profile updated");
          }}>
            <div className="space-y-2"><Label htmlFor="p-name">Display name</Label><Input id="p-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label htmlFor="p-email">Email</Label><Input id="p-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required /></div>
            <Button type="submit" className="w-full">Save profile</Button>
          </form>
        </DialogContent>
      </Dialog>
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const v = useContext(AccountContext);
  if (!v) throw new Error("AccountProvider is required");
  return v;
}
