"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Shield } from "lucide-react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      setError("Completa los campos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Credenciales incorrectas");
      }

      window.location.replace("/admin");
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "No se ha podido iniciar sesión");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[100svh] max-w-[640px] items-center px-4 py-8">
      <div className="admin-login-shell w-full animate-fade-in">
        <div className="admin-login-brand">
          <span className="admin-login-badge">Panel de administración</span>
          <h1 className="font-display text-[34px] font-black leading-none tracking-[-0.05em] text-text-warm sm:text-[40px]">
            Admin
          </h1>
        </div>

        <div className="admin-login-card">
          <div className="admin-login-icon">
            <Shield size={24} />
          </div>

          <div className="space-y-4">
            <label className="admin-field-block">
              <span className="admin-field-label">Usuario</span>
              <input
                className="input-field"
                autoComplete="username"
                placeholder="@canallita"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>

            <label className="admin-field-block">
              <span className="admin-field-label">Contraseña</span>
              <div className="relative">
                <input
                  className="input-field !pr-11"
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleSubmit();
                    }
                  }}
                />
                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          </div>

          {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

          <button type="button" className="btn btn-primary mt-5 w-full !py-3.5" onClick={() => void handleSubmit()} disabled={loading}>
            <LockKeyhole size={16} />
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
