import { Brand } from "./Brand";
import { LanguagePreferenceSelect } from "./LanguagePreferenceSelect";
import { NavLink } from "./NavLink";
import { LogoutButton } from "./LogoutButton";
import { canAccessCreateRequest, canManageAdmin } from "@/lib/permissions";
import type { AuthUser } from "@/lib/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" as const },
  { href: "/requests/new", label: "Create Request", icon: "create" as const, canShow: canAccessCreateRequest },
  { href: "/requests", label: "Requests", icon: "requests" as const },
  { href: "/reports", label: "Reports", icon: "reports" as const },
  { href: "/admin", label: "Admin", icon: "admin" as const, canShow: canManageAdmin }
];

export function AppShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const items = navItems.filter((item) => !item.canShow || item.canShow(user));

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand />
        </div>
        <nav className="nav-list" aria-label="Primary navigation">
          {items.map((item) => (
            <NavLink href={item.href} icon={item.icon} key={item.href} label={item.label} />
          ))}
        </nav>
        <div className="sidebar-footer">
          <LanguagePreferenceSelect value={user.preferredLanguage} compact />
          <div className="user-chip">
            <div className="avatar small">{user.name.slice(0, 2).toUpperCase()}</div>
            <strong>{user.name}</strong>
            <span className="muted">{user.roleName}</span>
            <span className="muted">{user.email}</span>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <Brand compact />
          <div className="topbar-actions">
            <LanguagePreferenceSelect value={user.preferredLanguage} compact />
            <LogoutButton />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
