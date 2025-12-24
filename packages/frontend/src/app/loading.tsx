import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

export default function Loading(): React.ReactNode {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Header skeleton */}
      <div className="py-8 text-center">
        <Skeleton className="mx-auto h-12 w-64" />
        <Skeleton className="mx-auto mt-6 h-6 w-96" />
      </div>

      {/* Stats skeleton */}
      <div className="mt-12">
        <Skeleton className="mb-2 h-6 w-32" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="h-24" />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="mt-12">
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
