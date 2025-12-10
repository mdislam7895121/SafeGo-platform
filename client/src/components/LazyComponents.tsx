import { Suspense, lazy, ComponentType, memo } from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = memo(function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );
});

const MapLoadingPlaceholder = memo(function MapLoadingPlaceholder() {
  return (
    <div className="w-full h-full min-h-[300px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading map...</p>
      </div>
    </div>
  );
});

export function withSuspense<P extends object>(
  Component: ComponentType<P>,
  fallback: JSX.Element = <LoadingSpinner />
) {
  const Wrapped = memo(function SuspenseWrapper(props: P) {
    return (
      <Suspense fallback={fallback}>
        <Component {...props} />
      </Suspense>
    );
  });
  Wrapped.displayName = `withSuspense(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped;
}

export const LazyMap = lazy(() => 
  import('@/components/maps/GoogleMapWrapper').catch(() => ({
    default: () => <div className="w-full h-full bg-gray-200 flex items-center justify-center">Map unavailable</div>
  }))
);

export const LazyLeafletMap = lazy(() =>
  import('react-leaflet').then(module => ({
    default: module.MapContainer
  })).catch(() => ({
    default: () => <div className="w-full h-full bg-gray-200 flex items-center justify-center">Map unavailable</div>
  }))
);

export const LazyChart = lazy(() =>
  import('recharts').then(module => ({
    default: module.ResponsiveContainer
  }))
);

export function SuspenseMap({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<MapLoadingPlaceholder />}>
      {children}
    </Suspense>
  );
}

export { LoadingSpinner, MapLoadingPlaceholder };
