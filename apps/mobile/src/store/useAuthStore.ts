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
  setUser: (user) => {
    set({ user });
    void setStoredValue("nailtry_user", JSON.stringify(user));
  },
}));

export async function hydrateAuthFromStorage() {
  const token = await getStoredValue("nailtry_token");
  if (!token) {
    useAuthStore.setState({ token: null, user: null, hydrated: true });
    return;
  }

  const storedUser = await getStoredValue("nailtry_user");
  let parsedUser: User | null = null;
  try {
    parsedUser = storedUser ? (JSON.parse(storedUser) as User) : null;
  } catch {
    parsedUser = null;
  }

  useAuthStore.setState({ token, user: parsedUser, hydrated: true });
}
