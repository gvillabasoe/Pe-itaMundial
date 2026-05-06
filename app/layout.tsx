import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider } from "@/components/toast-provider";

export const metadata: Metadata = {
  title: "Peñita Mundial · IV Edición",
  description: "Porra del Mundial 2026",
  icons: { icon: "/Logo_Porra_Mundial_2026.webp" },
};

export const viewport: Viewport = {
  themeColor: "#FAFAF7",
  width: "device-width",
  initialScale: 1,
};

// Anti-flash: aplica .dark si el usuario lo guardó. Light es el default.
const themeInitScript = `(function(){try{var t=localStorage.getItem('penita-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ThemeToggle />
              <main className="pb-24">{children}</main>
              <BottomNav />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
