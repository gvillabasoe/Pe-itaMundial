"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, Shield } from "lucide-react";

function getErrorMessage(value: string | null) {
  if (!value) return "";
  return value.trim() || "No se ha podido iniciar sesión";
}

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [clientError, setClientError] = useState("");
  const [serverError, setServerError] = useState("");
  const [showServerError, setShowServerError] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setServerError(getErrorMessage(params.get("error")));
    setShowServerError(true);
  }, []);

  const error = clientError || (showServerError ? serverError : "");

  const handleChangeUsername = (value: string) => {
    setUsername(value);
    setClientError("");
    setShowServerError(false);
    setSubmitting(false);
  };

  const handleChangePassword = (value: string) => {
    setPassword(value);
    setClientError("");
    setShowServerError(false);
    setSubmitting(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!username.trim() || !password) {
      event.preventDefault();
      setSubmitting(false);
      setClientError("Completa los campos");
      return;
    }

    setClientError("");
    setShowServerError(false);
    setSubmitting(true);
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

        <form className="admin-login-card" action="/api/admin/login" method="post" onSubmit={handleSubmit}>
          <input type="hidden" name="redirectTo" value="/admin" />

          <div className="admin-login-icon">
            <Shield size={24} />
          </div>

          <div className="space-y-4">
            <label className="admin-field-block">
              <span className="admin-field-label">Usuario</span>
              <input
                className="input-field"
                name="username"
                autoComplete="username"
                placeholder="@canallita"
                value={username}
                onChange={(event) => handleChangeUsername(event.target.value)}
              />
            </label>

            <label className="admin-field-block">
              <span className="admin-field-label">Contraseña</span>
              <div className="relative">
                <input
                  className="input-field !pr-11"
                  name="password"
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => handleChangePassword(event.target.value)}
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

          <button type="submit" className="btn btn-primary mt-5 w-full !py-3.5" disabled={submitting}>
            <LockKeyhole size={16} />
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
