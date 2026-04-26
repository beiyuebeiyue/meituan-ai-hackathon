import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/overview", label: "总览" },
  { to: "/reports", label: "报告" },
  { to: "/performance", label: "表现分析" },
  { to: "/jobs", label: "任务日志" },
];

export function AppLayout() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-badge">焕</span>
          <div>
            <h1>焕甲</h1>
            <p>运营控制台</p>
          </div>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "nav-link nav-link-active" : "nav-link")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
