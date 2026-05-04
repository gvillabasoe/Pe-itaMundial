"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@/lib/data";
import { fetchUserById, loginAsync } from "@/lib/users";

// ════════════════════════════════════════════════════════════
// AuthProvider
//
// Antes los usuarios vivían en una lista local en `lib/users.ts`.
// Ahora viven en la BBDD. Los componentes consumidores siguen
// usando `login(username, password)` síncrono y reciben un boolean
// inmediato (devuelve `false` mientras se resuelve la promesa).
//
// Si quieres feedback completo (texto del error backend), usa
// `loginAsync` directamente con `useAsyncLogin()`.
// ════════════════════════════════════════════════════════════

interface AuthContextType {
  user: User | null;
  /**
   * Login síncrono: devuelve `false` inicialmente y dispara el login asíncrono.
   * El estado se actualiza cuando termina la petición. Para feedback completo
   * con mensajes de error del backend, usa `loginAsync` desde `@/lib/users`.
   */
  login: (username: string, password: string) => boolean;
  /**
   * Login asíncrono: devuelve `Promise<boolean>` y actualiza el estado.
   * Recomendado para flujos donde puedas usar await.
   */
  loginAsync: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  favorites: string[];
  toggleFavorite: (teamId: string) => void;
  /** True mientras se hidrata el usuario desde localStorage al cargar. */
  isHydrating: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => false,
  loginAsync: async () => false,
  logout: () => {},
  favorites: [],
  toggleFavorite: () => {},
  isHydrating: true,
});

const STORAGE_KEY_USER = "penita_user";
const STORAGE_KEY_FAVS = "penita_favs";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // noop
  }
}

function safeRemove(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // noop
  }
}

function loadFavoritesFor(userId: string): string[] {
  const raw = safeGet(`${STORAGE_KEY_FAVS}_${userId}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);

  // Evita doble hidratación si el efecto se dispara dos veces en dev (StrictMode)
  const hydratedRef = useRef(false);

  // Hidratación inicial: si hay un id guardado, validamos contra el backend.
  // Si la BBDD ya no tiene ese usuario (porque borraste demos), limpiamos.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const savedId = safeGet(STORAGE_KEY_USER);
    if (!savedId) {
      setIsHydrating(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const found = await fetchUserById(savedId);
      if (cancelled) return;
      if (found) {
        setUser(found);
        setFavorites(loadFavoritesFor(found.id));
      } else {
        // El id de localStorage ya no existe en BBDD: limpiamos sesión.
        safeRemove(STORAGE_KEY_USER);
      }
      setIsHydrating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loginAsyncFn = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      const result = await loginAsync(username, password);
      if (!result.ok) return false;

      setUser(result.user);
      safeSet(STORAGE_KEY_USER, result.user.id);
      setFavorites(loadFavoritesFor(result.user.id));
      return true;
    },
    []
  );

  // Versión síncrona para mantener compatibilidad con el código existente
  // (el LoginView de mi-club espera boolean inmediato). Devuelve `false`
  // optimistamente y dispara la promesa; el estado se reflejará cuando
  // termine. El componente puede observar `user` en el siguiente render.
  const login = useCallback(
    (username: string, password: string): boolean => {
      void loginAsyncFn(username, password);
      // Devolvemos siempre false para no engañar al caller. Los consumidores
      // que necesiten feedback real deben usar loginAsync.
      return false;
    },
    [loginAsyncFn]
  );

  const logout = useCallback(() => {
    setUser(null);
    setFavorites([]);
    safeRemove(STORAGE_KEY_USER);
  }, []);

  const toggleFavorite = useCallback(
    (teamId: string) => {
      setFavorites((prev) => {
        const next = prev.includes(teamId)
          ? prev.filter((id) => id !== teamId)
          : [...prev, teamId];
        if (user) {
          safeSet(`${STORAGE_KEY_FAVS}_${user.id}`, JSON.stringify(next));
        }
        return next;
      });
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginAsync: loginAsyncFn,
        logout,
        favorites,
        toggleFavorite,
        isHydrating,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
