import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { getOpsToken, OPS_AUTH_CHANGED_EVENT } from "./api/client";
import { AppLayout } from "./layouts/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ChatbotPage } from "./pages/ChatbotPage";
import { LoginPage } from "./pages/LoginPage";
import { MerchantsPage } from "./pages/MerchantsPage";
import { MonitorPage } from "./pages/MonitorPage";
import { PostsPage } from "./pages/PostsPage";
import { ProfileSettingsPage } from "./pages/ProfileSettingsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { OpenSkillTasksPage } from "./pages/OpenSkillTasksPage";
import { TrendNailsPage } from "./pages/TrendNailsPage";
import { UsersPage } from "./pages/UsersPage";

function RequireAuth() {
  const [token, setToken] = useState(() => getOpsToken());

  useEffect(() => {
    const syncToken = () => setToken(getOpsToken());
    window.addEventListener(OPS_AUTH_CHANGED_EVENT, syncToken);
    window.addEventListener("storage", syncToken);
    return () => {
      window.removeEventListener(OPS_AUTH_CHANGED_EVENT, syncToken);
      window.removeEventListener("storage", syncToken);
    };
  }, []);

  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Refine
      routerProvider={routerProvider}
      resources={[
        { name: "dashboard", list: "/dashboard" },
        { name: "monitor", list: "/monitor" },
        { name: "users", list: "/users" },
        { name: "merchants", list: "/merchants" },
        { name: "posts", list: "/posts" },
        { name: "trend-nails", list: "/trend-nails" },
        { name: "reports", list: "/reports/ops" },
        { name: "xhs-reports", list: "/reports/xhs" },
        { name: "chatbot", list: "/chatbot" },
        { name: "openclaw-schedules", list: "/openclaw/schedules" },
        { name: "profile", list: "/profile/settings" },
      ]}
      options={{ syncWithLocation: true }}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/merchant-users" element={<Navigate to="/merchants" replace />} />
            <Route path="/merchants" element={<MerchantsPage />} />
            <Route path="/posts" element={<PostsPage />} />
            <Route path="/trend-nails" element={<TrendNailsPage />} />
            <Route path="/coupons" element={<Navigate to="/dashboard" replace />} />
            <Route path="/reports" element={<Navigate to="/reports/ops" replace />} />
            <Route path="/reports/ops" element={<ReportsPage panel="ops" />} />
            <Route path="/reports/xhs" element={<ReportsPage panel="xhs" />} />
            <Route path="/chatbot" element={<ChatbotPage />} />
            <Route path="/openclaw/schedules" element={<OpenSkillTasksPage />} />
            <Route path="/profile" element={<Navigate to="/profile/settings" replace />} />
            <Route path="/profile/settings" element={<ProfileSettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={getOpsToken() ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </Refine>
  );
}
