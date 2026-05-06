"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart3, Trophy, Shield, Swords } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/clasificacion", label: "Ranking", icon: BarChart3 },
  { href: "/resultados", label: "Resultados", icon: Trophy },
  { href: "/mi-club", label: "Mi Club", icon: Shield },
  { href: "/versus", label: "Versus", icon: Swords },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="nav-bottom" aria-label="Navegación principal">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all duration-150 no-underline ${isActive ? "text-gold" : "text-text-muted"}`}
          >
            <item.icon size={19} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
            <span className={isActive ? "font-semibold" : ""}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
