"use client";

type GoogleSignInButtonProps = {
  isLoading?: boolean;
  onClick?: () => void;
};

export default function GoogleSignInButton({
  isLoading = false,
  onClick,
}: GoogleSignInButtonProps) {
  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={onClick}
      className="relative inline-flex w-full items-center justify-center h-11 rounded-xl bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/80 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700/80 hover:text-white text-xs font-medium transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 gap-3 shadow-inner shadow-white/5"
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg
            className="h-4 w-4 animate-spin text-zinc-400"
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
          Conectando…
        </span>
      ) : (
        <>
          {/* Google logo SVG */}
          <svg
            className="h-4 w-4 flex-shrink-0"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continuar con Google
        </>
      )}
    </button>
  );
}