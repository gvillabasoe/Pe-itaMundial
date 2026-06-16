"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, SyntheticEvent, WheelEvent as ReactWheelEvent } from "react";
import { createPortal } from "react-dom";
import { Camera, Loader2, Trash2, ZoomIn, ZoomOut, X } from "lucide-react";
import { InitialsAvatar } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";

// ════════════════════════════════════════════════════════════
// Subida de foto de perfil con editor de encuadre (estilo WhatsApp/Instagram).
//
// Flujo: el usuario elige un JPG/PNG → se abre un editor con marco circular
// donde puede HACER ZOOM (slider, botones, rueda o PELLIZCO en móvil) y
// ARRASTRAR para encuadrar. Al confirmar, se recorta EN EL NAVEGADOR justo
// lo que se ve, a un cuadrado de 256px (JPEG) y se guarda vía
// /api/auth/avatar. El editor se monta en un PORTAL sobre document.body para
// que no quede atrapado por el `transform` de las tarjetas animadas (que en
// móvil lo dejaba detrás del nombre de la porra).
// ════════════════════════════════════════════════════════════

const TARGET_SIZE = 256; // resolución final del avatar (px)
const VIEWPORT_MAX = 300; // ancho máx. del marco en pantalla (px); se adapta al móvil
const MAX_ZOOM = 4;
const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8 MB de archivo original
const MAX_DATA_URL = 190_000; // margen bajo el límite del servidor (200 KB)

function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  let q = 0.85;
  let url = canvas.toDataURL("image/jpeg", q);
  while (url.length > MAX_DATA_URL && q > 0.4) {
    q -= 0.1;
    url = canvas.toDataURL("image/jpeg", q);
  }
  return url;
}

function clampNum(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
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
  const areaRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [vp, setVp] = useState(0); // tamaño real del marco (medido), en px
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Gestos: arrastre con 1 dedo, pellizco (zoom) con 2.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef<{ lx: number; ly: number; px: number; py: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number; fx: number; fy: number; px: number; py: number } | null>(null);

  const k = nat && vp ? vp / Math.min(nat.w, nat.h) : 1; // escala "cubrir" a zoom 1
  const scale = k * zoom;
  const dw = nat ? nat.w * scale : 0;
  const dh = nat ? nat.h * scale : 0;

  // La imagen siempre cubre el marco (sin huecos).
  const clamp = useCallback(
    (x: number, y: number, z: number) => {
      if (!nat || !vp) return { x, y };
      const s = (vp / Math.min(nat.w, nat.h)) * z;
      return {
        x: clampNum(x, vp - nat.w * s, 0),
        y: clampNum(y, vp - nat.h * s, 0),
      };
    },
    [nat, vp]
  );

  // Mide el marco (es cuadrado) y se adapta al ancho disponible en móvil.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => setVp(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Bloquea el scroll del fondo mientras el editor está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Centra la imagen al cargarla o si cambia el tamaño del marco (rotación, etc.).
  useEffect(() => {
    if (!nat || !vp) return;
    const s = vp / Math.min(nat.w, nat.h);
    setZoom(1);
    setPos({ x: (vp - nat.w * s) / 2, y: (vp - nat.h * s) / 2 });
  }, [nat, vp]);

  const onImgLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    setNat({ w: el.naturalWidth, h: el.naturalHeight });
  };

  // Zoom anclando un punto del marco (centro para slider/rueda; foco del pellizco).
  const zoomAround = (nextZoom: number, fx: number, fy: number, basePx: number, basePy: number, baseZoom: number) => {
    const nz = clampNum(nextZoom, 1, MAX_ZOOM);
    if (!nat || !vp) {
      setZoom(nz);
      return;
    }
    const kk = vp / Math.min(nat.w, nat.h);
    const sOld = kk * baseZoom;
    const sNew = kk * nz;
    const srcX = (fx - basePx) / sOld;
    const srcY = (fy - basePy) / sOld;
    setZoom(nz);
    setPos(clamp(fx - srcX * sNew, fy - srcY * sNew, nz));
  };

  const zoomCentered = (nz: number) => zoomAround(nz, vp / 2, vp / 2, pos.x, pos.y, zoom);

  const localXY = (e: ReactPointerEvent) => {
    const r = areaRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    areaRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      const l = localXY(e);
      pan.current = { lx: l.x, ly: l.y, px: pos.x, py: pos.y };
      pinch.current = null;
    } else if (pointers.current.size === 2) {
      const a = [...pointers.current.values()];
      const dist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
      const r = areaRef.current?.getBoundingClientRect();
      const fx = (a[0].x + a[1].x) / 2 - (r?.left ?? 0);
      const fy = (a[0].y + a[1].y) / 2 - (r?.top ?? 0);
      pinch.current = { dist, zoom, fx, fy, px: pos.x, py: pos.y };
      pan.current = null;
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      const a = [...pointers.current.values()];
      const dist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
      const ratio = dist / pinch.current.dist;
      zoomAround(pinch.current.zoom * ratio, pinch.current.fx, pinch.current.fy, pinch.current.px, pinch.current.py, pinch.current.zoom);
    } else if (pan.current) {
      const l = localXY(e);
      setPos(clamp(pan.current.px + (l.x - pan.current.lx), pan.current.py + (l.y - pan.current.ly), zoom));
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    try {
      areaRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    pinch.current = null;
    pan.current = null;
    // Si queda un dedo, reanuda el arrastre con él.
    if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      const r = areaRef.current?.getBoundingClientRect();
      pan.current = {
        lx: p.x - (r?.left ?? 0),
        ly: p.y - (r?.top ?? 0),
        px: pos.x,
        py: pos.y,
      };
    }
  };

  const onWheel = (e: ReactWheelEvent) => {
    e.preventDefault();
    zoomCentered(zoom - e.deltaY * 0.0015);
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img || !nat || !vp) return;
    const sx = (0 - pos.x) / scale;
    const sy = (0 - pos.y) / scale;
    const sWH = vp / scale;
    const canvas = document.createElement("canvas");
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sWH, sWH, 0, 0, TARGET_SIZE, TARGET_SIZE);
    onConfirm(canvasToDataUrl(canvas));
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto p-4"
      style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)" }}
      onClick={onCancel}
    >
      <div
        className="my-auto w-full max-w-[340px] rounded-2xl p-4"
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
          ref={areaRef}
          className="relative mx-auto select-none"
          style={{
            width: "100%",
            maxWidth: VIEWPORT_MAX,
            aspectRatio: "1 / 1",
            borderRadius: 14,
            overflow: "hidden",
            touchAction: "none",
            cursor: "grab",
            background: "#0b0e13",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
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
            onClick={() => zoomCentered(zoom - 0.25)}
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
            onChange={(e) => zoomCentered(Number(e.target.value))}
            className="flex-1"
            aria-label="Zoom"
          />
          <button
            type="button"
            onClick={() => zoomCentered(zoom + 0.25)}
            className="rounded-lg p-1.5 cursor-pointer text-text-muted bg-bg-2 border-none flex-shrink-0"
            aria-label="Acercar"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] text-text-muted">Arrastra para mover · pellizca o usa el control para ampliar</p>

        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="btn btn-ghost flex-1 !py-2 text-sm">
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
    </div>,
    document.body
  );
}

export function AvatarUploader({ name, size = 56 }: { name: string; size?: number }) {
  const { user, updateAvatar } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);

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
