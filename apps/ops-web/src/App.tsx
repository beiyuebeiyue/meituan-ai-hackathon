import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { getOpsToken } from "./api/client";
import { AppLayout } from "./layouts/AppLayout";
import { CouponsPage } from "./pages/CouponsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ChatbotPage } from "./pages/ChatbotPage";
import { LoginPage } from "./pages/LoginPage";
import { MerchantUsersPage } from "./pages/MerchantUsersPage";
import { MerchantsPage } from "./pages/MerchantsPage";
import { MonitorPage } from "./pages/MonitorPage";
import { ProfileSettingsPage } from "./pages/ProfileSettingsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { UsersPage } from "./pages/UsersPage";

function RequireAuth() {
  if (!getOpsToken()) return <Navigate to="/login" replace />;
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
        { name: "merchant-users", list: "/merchant-users" },
        { name: "merchants", list: "/merchants" },
        { name: "coupons", list: "/coupons" },
        { name: "reports", list: "/reports" },
        { name: "chatbot", list: "/chatbot" },
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
            <Route path="/merchant-users" element={<MerchantUsersPage />} />
            <Route path="/merchants" element={<MerchantsPage />} />
            <Route path="/coupons" element={<CouponsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/chatbot" element={<ChatbotPage />} />
            <Route path="/profile" element={<Navigate to="/profile/settings" replace />} />
            <Route path="/profile/settings" element={<ProfileSettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={getOpsToken() ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </Refine>
  );
}
