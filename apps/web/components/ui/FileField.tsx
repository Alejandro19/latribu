"use client";

type FileFieldProps = {
  id: string;
  label: string;
  accept?: string;
  disabled?: boolean;
  uploading?: boolean;
  invalid?: boolean;
  helper?: string;
  fileName?: string | null;
  onFileChange: (file: File | null) => void;
};

function AttachIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function UploadArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-bounce">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

export default function FileField({ id, label, accept, disabled, uploading, invalid, helper, fileName, onFileChange }: FileFieldProps) {
  const inactive = disabled || uploading;
  return (
    <div style={{ position: "relative" }}>
      <div
        className="mb-2 flex items-center font-mono text-[10px] font-normal uppercase tracking-[0.16em]"
        style={{ color: "var(--eph-muted)" }}
      >
        <span aria-hidden style={{ marginRight: 6, color: "var(--eph-accent)", display: "inline-flex" }}><AttachIcon /></span>
        {label}
      </div>
      <label
        htmlFor={id}
        aria-busy={uploading || undefined}
        className="flex items-center justify-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap text-center text-[13px]"
        style={{
          height: 64,
          borderRadius: 0,
          border: uploading
            ? "1px solid var(--eph-accent)"
            : invalid
              ? "1px solid var(--eph-danger)"
              : "1px solid var(--eph-line-2)",
          background: uploading
            ? "rgba(201,164,106,.08)"
            : fileName
              ? "transparent"
              : "var(--eph-hatch)",
          fontWeight: 400,
          color: uploading ? "var(--eph-accent)" : fileName ? "var(--eph-text)" : "var(--eph-muted)",
          cursor: inactive ? "not-allowed" : "pointer",
          padding: "0 14px",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {uploading ? (
          <>
            <UploadArrowIcon />
            Subiendo…
          </>
        ) : (
          <>
            <span aria-hidden style={{ display: "inline-flex", flexShrink: 0, color: "var(--eph-accent)" }}>
              <AttachIcon />
            </span>
            {fileName || "Elegir archivo…"}
          </>
        )}
      </label>
      <input
        id={id}
        type="file"
        aria-label={label}
        accept={accept}
        disabled={inactive}
        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
      />
      {invalid && <p role="alert" className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--eph-danger)" }}>Este campo es obligatorio.</p>}
      {!invalid && helper && <p className="mt-1.5 text-xs" style={{ color: "var(--eph-muted)" }}>{helper}</p>}
    </div>
  );
}
