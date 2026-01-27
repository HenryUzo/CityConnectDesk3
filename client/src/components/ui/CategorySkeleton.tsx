export default function CategorySkeleton({ className }: { className?: string }) {
  return (
    <div className={`flex h-[150px] w-[190px] flex-col items-center justify-center rounded-[24px] border border-[#e6eef0] bg-white/60 text-center text-sm font-semibold text-[#101828] p-4 ${className || ""}`}>
      <div className="h-10 w-10 rounded-full bg-gray-200 mb-3 animate-pulse" />
      <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}
