export interface ErrorFallbackProps {
  error: string | null;
  onRetry?: () => void;
}

export default function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md px-8 py-12 bg-white rounded-lg shadow-lg text-center">
        <div className="mb-4 text-6xl">⚠️</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Unable to Load</h1>
        <p className="text-slate-600 mb-4">
          We encountered an error connecting to the backend. Please check:
        </p>
        <ul className="text-left text-sm text-slate-700 bg-slate-50 p-4 rounded mb-6 space-y-2">
          <li>• Backend API is running</li>
          <li>• Network connection is stable</li>
          <li>• Check browser console for more details</li>
        </ul>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-6 text-left">
            <p className="text-xs font-mono text-red-900 break-words">{error}</p>
          </div>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
