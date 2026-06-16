export default function Loader() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
        <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-indigo-300 animate-spin animation-delay-150" style={{ animationDuration: "0.8s", animationDirection: "reverse" }} />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-gray-700">Analyzing your job poster…</p>
        <p className="text-sm text-gray-400 mt-1">AI is extracting job details. This may take a moment.</p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
