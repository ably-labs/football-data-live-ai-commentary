export function LoadingScreen() {
  return (
    <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400 mx-auto mb-4"></div>
        <p className="text-xl">Connecting to match server...</p>
        <p className="text-gray-400 mt-2">Preparing AI commentary system</p>
      </div>
    </div>
  );
}