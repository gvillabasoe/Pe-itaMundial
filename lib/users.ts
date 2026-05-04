import type { User } from "@/lib/data";

// ════════════════════════════════════════════════════════════
// Cliente de usuarios — autenticación y consulta.
//
// Antes existía una lista local de usuarios demo. Ahora todos los
// usuarios viven en la BBDD (tabla `users` en Neon). Estas funciones
// son async y consultan los endpoints `/api/auth/*`.
//
// Nota: AuthProvider mantiene una API síncrona para minimizar cambios
// en componentes existentes. Internamente, AuthProvider hace el login
// async vía `loginAsync` y solo expone la función síncrona `login` que
// dispara la promesa y devuelve un boolean optimista.
// ════════════════════════════════════════════════════════════

interface LoginSuccess {
  ok: true;
  user: User;
}

interface LoginFailure {
  ok: false;
  error: string;
}

export type LoginResult = LoginSuccess | LoginFailure;

/**
 * Valida credenciales contra el backend. Devuelve el usuario si OK.
 */
export async function loginAsync(
  username: string,
  password: string
): Promise<LoginResult> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const payload = await response.json();

    if (!response.ok) {
      return { ok: false, error: payload?.error || "Credenciales incorrectas" };
    }

    return { ok: true, user: payload.user as User };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error de conexión",
    };
  }
}

/**
 * Recupera un usuario por id. Lo usa AuthProvider al hidratar desde
 * localStorage al recargar la página: si guardamos el id, al volver
 * pedimos los datos completos al backend.
 */
export async function fetchUserById(id: string): Promise<User | null> {
  try {
    const response = await fetch(`/api/auth/me?id=${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return (payload?.user as User | undefined) ?? null;
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════
// COMPATIBILIDAD: stubs síncronos para código que aún no migró.
// Devuelven null y registran un warning. Migrar gradualmente a las
// versiones async (loginAsync, fetchUserById).
// ════════════════════════════════════════════════════════════

export function findUserByCredentials(_username: string, _password: string): User | null {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(
      "[lib/users] findUserByCredentials() es síncrono y obsoleto. Usa loginAsync()."
    );
  }
  return null;
}

export function findUserById(_id: string): User | null {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(
      "[lib/users] findUserById() es síncrono y obsoleto. Usa fetchUserById()."
    );
  }
  return null;
}
