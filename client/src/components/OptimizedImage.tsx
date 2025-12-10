import { useState, useEffect, useRef, memo, ImgHTMLAttributes } from 'react';

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  priority?: boolean;
  aspectRatio?: string;
}

export const OptimizedImage = memo(function OptimizedImage({
  src,
  alt,
  fallbackSrc,
  priority = false,
  aspectRatio,
  className = '',
  ...props
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isInView, setIsInView] = useState(priority);

  useEffect(() => {
    if (priority || !imgRef.current) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => setLoaded(true);
  const handleError = () => {
    setError(true);
    if (fallbackSrc && imgRef.current) {
      imgRef.current.src = fallbackSrc;
    }
  };

  const webpSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  const hasWebp = webpSrc !== src;

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={aspectRatio ? { aspectRatio } : undefined}
      data-testid={`img-container-${alt.replace(/\s+/g, '-').toLowerCase()}`}
    >
      {!loaded && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-800 animate-pulse" />
      )}
      {isInView && (
        <picture>
          {hasWebp && <source srcSet={webpSrc} type="image/webp" />}
          <img
            src={error && fallbackSrc ? fallbackSrc : src}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            onLoad={handleLoad}
            onError={handleError}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
            {...props}
          />
        </picture>
      )}
    </div>
  );
});

export default OptimizedImage;
