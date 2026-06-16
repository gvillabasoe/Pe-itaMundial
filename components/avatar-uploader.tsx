"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, SyntheticEvent, WheelEvent as ReactWheelEvent } from "react";
import { Camera, Loader2, Trash2, ZoomIn, ZoomOut, X } from "lucide-react";
import { InitialsAvatar } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";

// ════════════════════════════════════════════════════════════
// Subida de foto de perfil con editor de encuadre (estilo WhatsApp/Instagram).
//
// Flujo: el usuario elige un JPG/PNG → se abre un editor con marco circular
// donde puede HACER ZOOM (slider o rueda) y ARRASTRAR para encuadrar la foto.
// Al confirmar, se recorta EN EL NAVEGADOR exactamente lo que se ve, a un
// cuadrado de 256px (JPEG ~0.85) y se guarda vía /api/auth/avatar. Así la
// base de datos no se infla y la foto se ve nítida en los avatares grandes.
// ════════════════════════════════════════════════════════════

const TARGET_SIZE = 256; // resolución final del avatar (px)
const VIEWPORT = 260; // tamaño del área de recorte en pantalla (px)
const MAX_ZOOM = 4;
const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8 MB de archivo original
const MAX_DATA_URL = 190_000; // margen bajo el límite del servidor (200 KB)

// Exporta el recorte visible a un data URL JPEG, bajando calidad si hiciera
// falta para no pasarse del límite que acepta el endpoint.
function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  let q = 0.85;
  let url = canvas.toDataURL("image/jpeg", q);
  while (url.length > MAX_DATA_URL && q > 0.4) {
    q -= 0.1;
    url = canvas.toDataURL("image/jpeg", q);
  }
  return url;
}

// ─── Editor de encuadre ───────────────────────────────────────
function AvatarCropper({
  src,
  busy,
  onCancel,
  onConfirm,
}: {
  src: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef({ startX: 0, startY: 0, ox: 0, oy: 0, active: false });

  const baseScale = nat ? VIEWPORT / Math.min(nat.w, nat.h) : 1;
  const scale = baseScale * zoom;
  const dw = nat ? nat.w * scale : 0;
  const dh = nat ? nat.h * scale : 0;

  // Mantiene la imagen siempre cubriendo el marco (sin huecos), como Instagram.
  const clamp = useCallback(
    (x: number, y: number, z: number) => {
      if (!nat) return { x, y };
      const s = baseScale * z;
      const w = nat.w * s;
      const h = nat.h * s;
      return {
        x: Math.min(0, Math.max(VIEWPORT - w, x)),
        y: Math.min(0, Math.max(VIEWPORT - h, y)),
      };
    },
    [nat, baseScale]
  );

  const onImgLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    const s = VIEWPORT / Math.min(w, h);
    setNat({ w, h });
    setZoom(1);
    setPos({ x: (VIEWPORT - w * s) / 2, y: (VIEWPORT - h * s) / 2 });
  };

  // Zoom manteniendo fijo el centro del marco.
  const applyZoom = (next: number) => {
    const nz = Math.min(MAX_ZOOM, Math.max(1, next));
    if (!nat) {
      setZoom(nz);
      return;
    }
    const sOld = baseScale * zoom;
    const sNew = baseScale * nz;
    const cx = (VIEWPORT / 2 - pos.x) / sOld;
    const cy = (VIEWPORT / 2 - pos.y) / sOld;
    setZoom(nz);
    setPos(clamp(VIEWPORT / 2 - cx * sNew, VIEWPORT / 2 - cy * sNew, nz));
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, ox: pos.x, oy: pos.y, active: true };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current.active) return;
    setPos(
      clamp(
        drag.current.ox + (e.clientX - drag.current.startX),
        drag.current.oy + (e.clientY - drag.current.startY),
        zoom
      )
    );
  };
  const endDrag = (e: ReactPointerEvent) => {
    drag.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };
  const onWheel = (e: ReactWheelEvent) => {
    e.preventDefault();
    applyZoom(zoom - e.deltaY * 0.0015);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img || !nat) return;
    const sx = (0 - pos.x) / scale;
    const sy = (0 - pos.y) / scale;
    const sWH = VIEWPORT / scale;
    const canvas = document.createElement("canvas");
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sWH, sWH, 0, 0, TARGET_SIZE, TARGET_SIZE);
    onConfirm(canvasToDataUrl(canvas));
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[340px] rounded-2xl p-4"
        style={{ background: "rgb(var(--bg-1))", border: "1px solid rgb(var(--border-subtle))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-text-warm">Ajusta tu foto</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 cursor-pointer text-text-muted bg-bg-2 border-none"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div
          className="relative mx-auto select-none"
          style={{
            width: VIEWPORT,
            height: VIEWPORT,
            maxWidth: "100%",
            borderRadius: 14,
            overflow: "hidden",
            touchAction: "none",
            cursor: "grab",
            background: "#0b0e13",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onWheel={onWheel}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            onLoad={onImgLoad}
            draggable={false}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: dw || undefined,
              height: dh || undefined,
              maxWidth: "none",
              userSelect: "none",
              willChange: "left, top, width, height",
            }}
          />
          {/* Máscara circular: oscurece fuera del círculo y marca el encuadre */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
              border: "2px solid rgba(255,255,255,0.85)",
              pointerEvents: "none",
            }}
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => applyZoom(zoom - 0.25)}
            className="rounded-lg p-1.5 cursor-pointer text-text-muted bg-bg-2 border-none flex-shrink-0"
            aria-label="Alejar"
          >
            <ZoomOut size={16} />
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            className="flex-1"
            aria-label="Zoom"
          />
          <button
            type="button"
            onClick={() => applyZoom(zoom + 0.25)}
            className="rounded-lg p-1.5 cursor-pointer text-text-muted bg-bg-2 border-none flex-shrink-0"
            aria-label="Acercar"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn btn-ghost flex-1 !py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !nat}
            className="btn btn-primary flex-1 !py-2 text-sm inline-flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export function AvatarUploader({ name, size = 56 }: { name: string; size?: number }) {
  const { user, updateAvatar } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);

  // Limpia el object URL del editor al desmontar.
  useEffect(() => {
    return () => {
      if (editorSrc) URL.revokeObjectURL(editorSrc);
    };
  }, [editorSrc]);

  if (!user) return null;

  const handlePick = () => {
    setError(null);
    inputRef.current?.click();
  };

  const closeEditor = () => {
    if (editorSrc) URL.revokeObjectURL(editorSrc);
    setEditorSrc(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = (file: File | undefined) => {
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
    // Abre el editor de encuadre con la imagen elegida.
    setEditorSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (dataUrl: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, avatarUrl: dataUrl }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || `Error ${res.status}`);
      updateAvatar(dataUrl);
      closeEditor();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido subir la foto");
    } finally {
      setBusy(false);
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
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {editorSrc && (
        <AvatarCropper
          src={editorSrc}
          busy={busy}
          onCancel={closeEditor}
          onConfirm={(dataUrl) => void handleCropConfirm(dataUrl)}
        />
      )}
    </div>
  );
}
