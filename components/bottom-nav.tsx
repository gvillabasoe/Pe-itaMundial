"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Shield, Swords, Trophy } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/clasificacion", label: "Ranking", icon: BarChart3 },
  { href: "/resultados", label: "Resultados", icon: Trophy },
  { href: "/mi-club", label: "Mi Club", icon: Shield },
  { href: "/versus", label: "Versus", icon: Swords },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="nav-bottom" aria-label="Navegación principal">
      {NAV_ITEMS.map((item) => {
        const isResultsAlias = item.href === "/resultados" && pathname.startsWith("/mundial-2026");
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href) || isResultsAlias;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-bottom__item ${isActive ? "is-active" : ""}`}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
