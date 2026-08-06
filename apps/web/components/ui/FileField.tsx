"use client";

type FileFieldProps = {
  id: string;
  label: string;
  accept?: string;
  disabled?: boolean;
  helper?: string;
  fileName?: string | null;
  onFileChange: (file: File | null) => void;
};

export default function FileField({ id, label, accept, disabled, helper, fileName, onFileChange }: FileFieldProps) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600,
        color: "var(--ink-soft)", marginBottom: 8 }}>
        <span aria-hidden style={{ marginRight: 6, color: "#5B7A4E", fontSize: 14 }}>📎</span>
        {label}
      </div>
      <label
        htmlFor={id}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: 48, borderRadius: 12, border: "1px dashed #E7DFC9",
          background: disabled ? "#F5F1E9" : "#FFFFFF", fontSize: 13,
          color: fileName ? "#2B2621" : "#8A8377", cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "center", padding: "0 14px", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {fileName || "Elegir archivo…"}
      </label>
      <input
        id={id}
        type="file"
        aria-label={label}
        accept={accept}
        disabled={disabled}
        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
      />
      {helper && <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>{helper}</p>}
    </div>
  );
}
