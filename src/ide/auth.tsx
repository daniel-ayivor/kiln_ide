import { createContext, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";

export type DemoUser = { name: string; email: string; role: string };

type AccountState = {
  user: DemoUser | null;
  signIn: () => void;
  signOut: () => void;
  updateUser: (updates: Partial<DemoUser>) => void;
};

const AccountContext = createContext<AccountState | null>(null);
const DEMO: DemoUser = { name: "Ada Developer", email: "ada@kiln.dev", role: "Pro (demo)" };

/** Dummy, in-memory account. Nothing is stored or sent anywhere. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(DEMO);

  const updateUser = (updates: Partial<DemoUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
    toast.success("Profile updated");
  };

  return (
    <AccountContext.Provider
      value={{
        user,
        signIn: () => {
          setUser(DEMO);
          toast.success(`Signed in as ${DEMO.name}`);
        },
        signOut: () => {
          setUser(null);
          toast("Signed out of the demo account");
        },
        updateUser,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const v = useContext(AccountContext);
  if (!v) throw new Error("AccountProvider is required");
  return v;
}