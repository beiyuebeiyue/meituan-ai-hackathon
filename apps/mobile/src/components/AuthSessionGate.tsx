import { useQuery } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";
import { api } from "../api/client";
import { useAuthStore } from "../store/useAuthStore";

type AuthSessionGateProps = {
  children: ReactNode;
};

export function AuthSessionGate({ children }: AuthSessionGateProps) {
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);

  const meQuery = useQuery({
    queryKey: ["me", token],
    queryFn: api.getMe,
    enabled: hydrated && Boolean(token),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, setUser]);

  useEffect(() => {
    if (meQuery.error instanceof Error && meQuery.error.message.includes("登录状态已失效")) {
      void clearSession();
    }
  }, [clearSession, meQuery.error]);

  return children;
}
