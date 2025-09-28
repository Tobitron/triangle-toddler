export default function Loading() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse h-20 rounded-lg bg-gray-100" />
      ))}
    </div>
  );
}

