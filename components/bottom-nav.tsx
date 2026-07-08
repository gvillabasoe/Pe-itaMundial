"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart3, Trophy, Shield, Swords, Crown } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/clasificacion", label: "Ranking", icon: BarChart3 },
  { href: "/resultados", label: "Resultados", icon: Trophy },
  { href: "/mi-club", label: "Mi Club", icon: Shield },
  { href: "/versus", label: "Versus", icon: Swords },
  { href: "/copa", label: "Copa", icon: Crown },
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
            className={`relative flex flex-col items-center gap-1 px-2 pt-2 pb-1 text-[10px] transition-colors duration-150 no-underline ${isActive ? "text-gold" : "text-text-muted"}`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-0 left-1/2 h-[3px] w-6 rounded-full bg-gold transition-opacity duration-150 ${isActive ? "opacity-100" : "opacity-0"}`}
              style={{ transform: "translate(-50%, -8px)" }}
            />
            <item.icon size={20} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden="true" />
            <span className={isActive ? "font-semibold" : "font-medium"}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
