import { create } from "zustand";

type WhopUser = {
  [key: string]: unknown;
};

interface UserState {
  whopUser: WhopUser | null;
  accessLevel: "admin" | "customer" | "no_access" | null;
  experienceId: string | null;
  setWhopUser: (user: WhopUser) => void;
  setAccessLevel: (accessLevel: "admin" | "customer" | "no_access") => void;
  setExperienceId: (experienceId: string) => void;
  clearWhopUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  whopUser: null,
  accessLevel: null,
  experienceId: null,
  setWhopUser: (user) => set({ whopUser: user }),
  setAccessLevel: (accessLevel) => set({ accessLevel }),
  setExperienceId: (experienceId: string) => set({ experienceId }),
  clearWhopUser: () => set({ whopUser: null, accessLevel: null }),
}));

// Extend the Window interface to include 'store'
declare global {
  interface Window {
    store: typeof useUserStore;
  }
}

if (typeof window !== "undefined") {
  window.store = useUserStore;
}