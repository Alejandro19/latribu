"use client";

import { useEffect, useState } from "react";

type ImageFieldProps = {
  id: string;
  label: string;
  onFileChange: (file: File | null) => void;
};

export default function ImageField({ id, label, onFileChange }: ImageFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    onFileChange(file);
  }

  return (
    <div style={{ position: "relative" }}>
      <label
        htmlFor={id}
        className="mb-1.5 block font-mono text-[10px] font-normal uppercase tracking-[0.16em]"
        style={{ color: "var(--eph-muted)" }}
      >
        {label}
      </label>
      {previewUrl ? (
        <label htmlFor={id} style={{ position: "relative", display: "block", borderRadius: 0, border: "1px solid var(--eph-line)", overflow: "hidden", aspectRatio: "16 / 9", cursor: "pointer" }}>
          <img src={previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <span
            className="font-mono text-[10px] font-normal uppercase tracking-[0.1em]"
            style={{
              position: "absolute", bottom: 8, right: 8, borderRadius: "999px", padding: "4px 12px",
              background: "rgba(8,8,7,.7)", color: "var(--eph-text)",
            }}
          >
            Cambiar foto
          </span>
        </label>
      ) : (
        <label
          htmlFor={id}
          className="flex items-center justify-center font-mono text-[10px] font-normal uppercase tracking-[0.16em]"
          style={{
            aspectRatio: "16 / 9", borderRadius: 0, border: "1px solid var(--eph-line-2)",
            backgroundImage: "var(--eph-hatch)",
            color: "var(--eph-muted)", cursor: "pointer",
          }}
        >
          Elegir foto…
        </label>
      )}
      <input id={id} type="file" accept="image/jpeg,image/png" onChange={handleChange} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }} />
      <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--eph-faint)" }}>
        JPG o PNG · relación 16:9 (horizontal) · mínimo 1200×675px · máx. 5MB. Evitá fotos verticales (se recortan mal)
        y texto superpuesto (el título ya se muestra debajo).
      </p>
    </div>
  );
}
