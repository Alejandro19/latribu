'use client';

type AuthLoadingOverlayProps = {
  message?: string;
};

export default function AuthLoadingOverlay({
  message = 'Iniciando sesión...',
}: AuthLoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-10 py-8 shadow-2xl shadow-slate-200/60">
        <svg
          className="h-8 w-8 animate-spin text-slate-700"
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
        <p className="text-sm font-medium text-slate-600">{message}</p>
      </div>
    </div>
  );
}