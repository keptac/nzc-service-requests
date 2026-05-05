"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  PlusCircle,
  Settings
} from "lucide-react";

const icons = {
  dashboard: LayoutDashboard,
  requests: ClipboardList,
  create: PlusCircle,
  reports: BarChart3,
  admin: Settings
} as const;

export type NavIcon = keyof typeof icons;

type NavLinkProps = {
  href: string;
  label: string;
  icon: NavIcon;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href || pathname === "/";
  if (href === "/requests/new") return pathname === href;
  if (href === "/requests") return pathname === href || (pathname.startsWith("/requests/") && pathname !== "/requests/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink({ href, label, icon: Icon }: NavLinkProps) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);
  const IconComponent = icons[Icon];

  return (
    <Link className={`nav-link ${active ? "active" : ""}`} href={href} aria-current={active ? "page" : undefined}>
      <IconComponent size={18} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
