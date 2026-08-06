"use client";

import { useState, type FormEvent } from "react";
import { registerRequest, saveSession } from "../../lib/api-client";

type RegisterFormProps = {
  isNight: boolean;
  onSuccess?: (result: Awaited<ReturnType<typeof registerRequest>>) => void;
  onError?: (message: string) => void;
};

export default function RegisterForm({
  isNight,
  onSuccess,
  onError,
}: RegisterFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      const msg = "Las contraseñas no coinciden.";
      setError(msg);
      onError?.(msg);
      return;
    }

    if (password.length < 6) {
      const msg = "La contraseña debe tener al menos 6 caracteres.";
      setError(msg);
      onError?.(msg);
      return;
    }

    setIsLoading(true);

    try {
      const result = await registerRequest(name, email, password);
      if (!result.success || !result.token) {
        const msg = result.error || "Error al registrarse.";
        setError(msg);
        onError?.(msg);
        return;
      }
      saveSession(result.token);
      onSuccess?.(result);
    } catch {
      const msg = "Error de conexión. Intenta de nuevo.";
      setError(msg);
      onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const inputClasses = isNight
    ? "bg-[#F4F1EA] border border-[#E4D4B7] text-zinc-900 placeholder:text-zinc-400 focus:border-[#C4B497] focus:ring-4 focus:ring-amber-500/10"
    : "bg-zinc-900/40 border border-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-amber-200/40 focus:ring-4 focus:ring-amber-500/5";

  const labelClasses = isNight ? "text-[#8A8377]" : "text-[#B0A599]";

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="register-name"
          className={`block text-sm font-medium transition-colors duration-200 ${labelClasses}`}
        >
          Nombre completo
        </label>
        <input
          id="register-name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre completo"
          className={`block w-full h-11 rounded-xl px-4 text-sm transition-all duration-200 ease-in-out outline-none ${inputClasses}`}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="register-email"
          className={`block text-sm font-medium transition-colors duration-200 ${labelClasses}`}
        >
          Email
        </label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tucorreo@ejemplo.com"
          className={`block w-full h-11 rounded-xl px-4 text-sm transition-all duration-200 ease-in-out outline-none ${inputClasses}`}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="register-password"
          className={`block text-sm font-medium transition-colors duration-200 ${labelClasses}`}
        >
          Contraseña
        </label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          className={`block w-full h-11 rounded-xl px-4 text-sm transition-all duration-200 ease-in-out outline-none ${inputClasses}`}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="register-confirm-password"
          className={`block text-sm font-medium transition-colors duration-200 ${labelClasses}`}
        >
          Confirmar contraseña
        </label>
        <input
          id="register-confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repite tu contraseña"
          className={`block w-full h-11 rounded-xl px-4 text-sm transition-all duration-200 ease-in-out outline-none ${inputClasses}`}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="relative inline-flex w-full items-center justify-center h-11 rounded-xl bg-[#E4D4B7] text-zinc-900 font-semibold tracking-wide shadow-[0_4px_12px_rgba(228,212,183,0.15)] hover:bg-[#D9C8A8] hover:shadow-[0_6px_20px_rgba(228,212,183,0.25)] transition-all duration-200 ease-out active:scale-[0.98] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 gap-2"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin text-zinc-700"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            Creando cuenta…
          </span>
        ) : (
          "Crear cuenta"
        )}
      </button>
    </form>
  );
}