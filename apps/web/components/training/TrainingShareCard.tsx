"use client";

import { useState, useRef, useEffect } from "react";
import { drawInstagramCard } from "../../lib/training-card";
import { shareCanvasAsImage } from "../../lib/share-card";
import { showToast } from "../layout/AppShell";
import { IconCamera } from "../ui/icons";

type TrainingShareCardProps = {
  streakWeeks: number;
  phrase: string | null;
};

export default function TrainingShareCard({ streakWeeks, phrase }: TrainingShareCardProps) {
  const [generating, setGenerating] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pre-load the font for canvas rendering (same as legacy: Fraunces from Google Fonts)
  useEffect(() => {
    if (fontsReady) return;
    const t = setTimeout(() => setFontsReady(true), 500);
    return () => clearTimeout(t);
  }, [fontsReady]);

  const handleShare = async () => {
    if (!canvasRef.current) return;
    setGenerating(true);
    try {
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) throw new Error("Canvas no disponible.");
      drawInstagramCard(ctx, { streakWeeks, phrase });
      await shareCanvasAsImage(canvasRef.current, `ephirox-workout-s${streakWeeks}.png`);
      showToast("¡Tarjeta lista para compartir!", "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al generar la tarjeta.";
      if ((e as Error).name !== "AbortError") showToast(msg, "error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      {/* Hidden canvas for rendering the 1080×1920 card */}
      <canvas
        ref={canvasRef}
        width={1080}
        height={1920}
        style={{ display: "none" }}
      />

      <button
        onClick={handleShare}
        disabled={generating || !fontsReady}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          borderRadius: "9999px",
          background: "var(--eph-accent)",
          color: "var(--eph-ink)",
          border: "none",
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 600,
          cursor: generating ? "not-allowed" : "pointer",
          opacity: generating ? 0.7 : 1,
          transition: "filter 0.2s ease",
        }}
        onMouseEnter={(e) => {
          if (!generating) e.currentTarget.style.filter = "brightness(0.95)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = "none";
        }}
      >
        {generating ? (
          <>
            <span
              style={{
                width: 14,
                height: 14,
                border: "2px solid color-mix(in srgb, var(--eph-ink) 30%, transparent)",
                borderTopColor: "var(--eph-ink)",
                borderRadius: "50%",
                animation: "spin 0.6s linear infinite",
                display: "inline-block",
              }}
            />
            Generando…
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </>
        ) : (
          <>
            <IconCamera size={15} /> Compartir en Instagram
          </>
        )}
      </button>
    </>
  );
}
