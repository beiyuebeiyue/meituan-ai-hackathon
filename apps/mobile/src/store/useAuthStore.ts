import { create } from "zustand";
import { User } from "../types/api";
import { clearStoredValues, getStoredValue, setStoredValue } from "../utils/sessionStorage";

const AUTH_STORAGE_KEYS = ["nailtry_token", "nailtry_user"] as const;

type AuthState = {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  setSession: (token: string, user: User) => Promise<void>;
  clearSession: () => Promise<void>;
  setUser: (user: User) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  setSession: async (token, user) => {
    await setStoredValue("nailtry_token", token);
    await setStoredValue("nailtry_user", JSON.stringify(user));
    set({ token, user, hydrated: true });
  },
  clearSession: async () => {
    set({ token: null, user: null, hydrated: true });
    await clearStoredValues([...AUTH_STORAGE_KEYS]);
  },
  setUser: (user) => set({ user }),
}));

export async function bootstrapAuth() {
  const token = await getStoredValue("nailtry_token");
  const user = await getStoredValue("nailtry_user");
  useAuthStore.setState({
    token,
    user: user ? (JSON.parse(user) as User) : null,
    hydrated: true,
  });
}
