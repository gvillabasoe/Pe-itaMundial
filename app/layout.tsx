import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Peñita Mundial · IV Edición",
  description: "Porra premium del Mundial 2026 con ranking, resultados, Mi Club y Versus.",
  icons: {
    icon: "/Logo_Porra_Mundial_2026.webp",
  },
};

export const viewport: Viewport = {
  themeColor: "#050608",
  width: "device-width",
  initialScale: 1,
};

const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('penita-theme');
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    }
  } catch (error) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ThemeToggle />
            <main className="app-shell">{children}</main>
            <BottomNav />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
