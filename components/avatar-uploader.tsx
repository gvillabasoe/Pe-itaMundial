"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { InitialsAvatar } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";

// ════════════════════════════════════════════════════════════
// Subida de foto de perfil. Elige un JPG/PNG, lo redimensiona y comprime
// EN EL NAVEGADOR a un cuadrado de 128px (JPEG ~calidad 0.82) antes de
// enviarlo, para no inflar la base de datos. Luego lo guarda vía
// /api/auth/avatar y actualiza el estado de Auth para reflejarlo al
// instante en toda la app.
// ════════════════════════════════════════════════════════════

const TARGET_SIZE = 128;
const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8 MB de archivo original

async function fileToCompressedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  // Recorte cuadrado centrado
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function AvatarUploader({ name, size = 56 }: { name: string; size?: number }) {
  const { user, updateAvatar } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handlePick = () => {
    setError(null);
    inputRef.current?.click();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("Solo JPG o PNG.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("La imagen es demasiado grande (máx. 8 MB).");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const res = await fetch("/api/auth/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, avatarUrl: dataUrl }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || `Error ${res.status}`);
      updateAvatar(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido subir la foto");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, avatarUrl: null }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || `Error ${res.status}`);
      updateAvatar(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido quitar la foto");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handlePick}
        disabled={busy}
        className="relative bg-transparent border-none cursor-pointer flex-shrink-0"
        style={{ width: size, height: size, padding: 0, borderRadius: "50%" }}
        aria-label="Cambiar foto de perfil"
        title="Cambiar foto de perfil"
      >
        <InitialsAvatar name={name} size={size} avatarUrl={user.avatarUrl ?? null} />
        <span
          className="absolute flex items-center justify-center rounded-full"
          style={{
            right: -2,
            bottom: -2,
            width: 22,
            height: 22,
            background: "rgb(var(--accent-participante))",
            border: "2px solid rgb(var(--bg-1))",
          }}
        >
          {busy ? <Loader2 size={11} className="animate-spin" style={{ color: "#fff" }} /> : <Camera size={11} style={{ color: "#fff" }} />}
        </span>
      </button>

      <div className="min-w-0">
        <p className="text-[10px] text-text-muted leading-tight">Foto de perfil</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePick}
            disabled={busy}
            className="text-[11px] font-semibold text-accent-participante bg-transparent border-none cursor-pointer p-0"
          >
            {user.avatarUrl ? "Cambiar" : "Subir foto"}
          </button>
          {user.avatarUrl && (
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={busy}
              className="text-[11px] text-text-muted bg-transparent border-none cursor-pointer p-0 inline-flex items-center gap-1"
            >
              <Trash2 size={11} /> Quitar
            </button>
          )}
        </div>
        {error && <p className="text-[10px] text-danger" style={{ margin: "2px 0 0" }}>{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
