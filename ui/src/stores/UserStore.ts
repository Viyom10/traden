import { create } from "zustand";

type WhopUser = {
  [key: string]: unknown;
};

interface UserState {
  whopUser: WhopUser | null;
  userId: string | null;
  accessLevel: "admin" | "customer" | "no_access" | null;
  experienceId: string | null;
  setWhopUser: (user: WhopUser) => void;
  setUserId: (userId: string) => void;
  setAccessLevel: (accessLevel: "admin" | "customer" | "no_access") => void;
  setExperienceId: (experienceId: string) => void;
  clearWhopUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  whopUser: null,
  userId: null,
  accessLevel: null,
  experienceId: null,
  setWhopUser: (user) => set({ whopUser: user }),
  setUserId: (userId) => set({ userId }),
  setAccessLevel: (accessLevel) => set({ accessLevel }),
  setExperienceId: (experienceId: string) => set({ experienceId }),
  clearWhopUser: () => set({ whopUser: null, userId: null, accessLevel: null, experienceId: null }),
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