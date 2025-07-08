'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('Application error:', error)
  
  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-8">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <pre className="bg-gray-800 p-4 rounded-lg mb-4 max-w-2xl overflow-x-auto">
        <code>{error.message}</code>
      </pre>
      <button
        onClick={() => reset()}
        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
      >
        Try again
      </button>
    </div>
  )
}