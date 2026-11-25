import { useEffect, useState } from "react";
import { useAccount } from "../auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfilePage() {
  const { user, signIn, updateUser } = useAccount();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  // Sync form if user signs in/out while the tab is open
  useEffect(() => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
  }, [user]);

  if (!user) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">You are currently signed out.</p>
        <Button onClick={signIn}>Sign in with demo account</Button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateUser({ name: name.trim(), email: email.trim() });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl space-y-6 px-8 py-6">
        <div className="border-b pb-4">
          <h1 className="text-lg font-semibold text-foreground">Edit Profile</h1>
          <p className="text-[13px] text-muted-foreground">
            Demo only — changes last until you reload.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 rounded px-3 py-2.5 hover:bg-ide-hover">
            <Label htmlFor="p-name" className="text-[13px] font-semibold text-foreground">
              Display name
            </Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 border border-border bg-input text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
              required
            />
          </div>

          <div className="space-y-2 rounded px-3 py-2.5 hover:bg-ide-hover">
            <Label htmlFor="p-email" className="text-[13px] font-semibold text-foreground">
              Email
            </Label>
            <Input
              id="p-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-8 border border-border bg-input text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
              required
            />
          </div>

          <div className="space-y-2 rounded px-3 py-2.5">
            <Label htmlFor="p-role" className="text-[13px] font-semibold text-foreground">
              Plan / Role
            </Label>
            <Input
              id="p-role"
              value={user.role}
              disabled
              className="h-8 border border-border bg-input/60 text-[13px] text-muted-foreground opacity-80"
            />
          </div>

          <div className="px-3 pt-2">
            <Button type="submit">Save profile</Button>
          </div>
        </form>
      </div>
    </div>
  );
}