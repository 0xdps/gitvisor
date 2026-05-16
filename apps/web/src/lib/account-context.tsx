"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { AccountInstallation } from "./api-client";

interface AccountContextValue {
  /**
   * The currently selected account. `null` means "all accounts" (no scope
   * filter applied — same as the pre-account-switcher behaviour).
   */
  selected: AccountInstallation | null;
  select: (account: AccountInstallation | null) => void;
}

const AccountContext = createContext<AccountContextValue>({
  selected: null,
  select: () => {},
});

const STORAGE_KEY = "gitvisor-selected-account";

export function AccountProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<AccountInstallation | null>(null);

  // Hydrate from localStorage once on mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSelected(JSON.parse(raw) as AccountInstallation);
    } catch {
      // Corrupt storage — ignore.
    }
  }, []);

  function select(account: AccountInstallation | null) {
    setSelected(account);
    if (account) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <AccountContext.Provider value={{ selected, select }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  return useContext(AccountContext);
}
