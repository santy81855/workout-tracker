"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [["/", "Today"], ["/program", "Program"], ["/history", "History"], ["/progress", "Progress"], ["/settings", "Settings"]] as const;

export function BottomNavigation() {
  const pathname = usePathname();
  return <nav className="bottom-nav" aria-label="Primary navigation">{items.map(([href, label]) => <Link aria-current={pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) ? "page" : undefined} href={href} key={href}>{label}</Link>)}</nav>;
}
