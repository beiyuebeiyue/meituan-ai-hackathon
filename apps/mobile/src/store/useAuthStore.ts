import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { User } from "../types/api";

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
    await SecureStore.setItemAsync("nailtry_token", token);
    await SecureStore.setItemAsync("nailtry_user", JSON.stringify(user));
    set({ token, user, hydrated: true });
  },
  clearSession: async () => {
    await SecureStore.deleteItemAsync("nailtry_token");
    await SecureStore.deleteItemAsync("nailtry_user");
    set({ token: null, user: null, hydrated: true });
  },
  setUser: (user) => set({ user }),
}));

export async function bootstrapAuth() {
  const token = await SecureStore.getItemAsync("nailtry_token");
  const user = await SecureStore.getItemAsync("nailtry_user");
  useAuthStore.setState({
    token,
    user: user ? (JSON.parse(user) as User) : null,
    hydrated: true,
  });
}
