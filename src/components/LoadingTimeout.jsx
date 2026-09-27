import { RefreshCw } from 'lucide-react';

// Full-screen fallback shown when a loading state exceeds its maximum wait.
// Default retry reloads the page so the auth client re-initializes cleanly.
export default function LoadingTimeout({ onRetry, title = 'Taking a while…', message = "We couldn't finish loading. Please try again." }) {
  const retry = onRetry || (() => window.location.reload());
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <p className="text-gray-500 text-sm mt-2 max-w-xs">{message}</p>
      <button
        onClick={retry}
        className="mt-6 inline-flex items-center gap-2 bg-black text-white px-5 py-3 rounded-full font-semibold text-sm hover:bg-gray-800 active:scale-95 transition-all"
      >
        <RefreshCw size={16} /> Retry
      </button>
    </div>
  );
}