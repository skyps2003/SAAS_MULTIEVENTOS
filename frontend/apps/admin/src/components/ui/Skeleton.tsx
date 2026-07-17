
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-700/50 rounded-md ${className}`}
    />
  );
}

export function TableSkeleton({ columns = 4, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <div className="w-full">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 py-4 border-b border-slate-100 dark:border-slate-700/50">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className={`h-4 ${j === 0 ? 'w-1/4' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-slate-800">
      <Skeleton className="h-48 w-full rounded-none" />
      <div className="p-5 flex-1 flex flex-col space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
