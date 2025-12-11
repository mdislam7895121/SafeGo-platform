import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface MediaItem {
  id: string;
  url: string;
  type: string;
  category: string;
  displayOrder: number;
}

interface GalleryModalProps {
  media: MediaItem[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

const categoryLabels: Record<string, string> = {
  food: "Food",
  ambience: "Ambience",
  team: "Team",
  kitchen: "Kitchen",
  other: "Other",
};

export default function GalleryModal({ media, initialIndex = 0, isOpen, onClose }: GalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Reset index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setSelectedCategory(null);
    }
  }, [isOpen, initialIndex]);

  // Filter media by category if selected
  const filteredMedia = selectedCategory
    ? media.filter((item) => item.category === selectedCategory)
    : media;

  const currentImage = filteredMedia[currentIndex];

  // Get unique categories
  const categories = Array.from(new Set(media.map((item) => item.category)));

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : filteredMedia.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < filteredMedia.length - 1 ? prev + 1 : 0));
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredMedia.length]);

  // Handle touch swipe on mobile
  useEffect(() => {
    if (!isOpen) return;

    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleSwipe = () => {
      const swipeThreshold = 50;
      if (touchStartX - touchEndX > swipeThreshold) {
        // Swipe left - next image
        goToNext();
      } else if (touchEndX - touchStartX > swipeThreshold) {
        // Swipe right - previous image
        goToPrevious();
      }
    };

    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isOpen, currentIndex, filteredMedia.length]);

  if (!currentImage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-full h-screen p-0 bg-black/95"
        data-testid="gallery-modal"
      >
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
          onClick={onClose}
          data-testid="button-close-gallery"
        >
          <X className="h-6 w-6" />
        </Button>

        {/* Category filters */}
        {categories.length > 1 && (
          <div className="absolute top-4 left-4 z-50 flex flex-wrap gap-2">
            <Badge
              variant={selectedCategory === null ? "default" : "outline"}
              className="cursor-pointer bg-white/20 hover:bg-white/30 text-white border-white/40"
              onClick={() => {
                setSelectedCategory(null);
                setCurrentIndex(0);
              }}
              data-testid="badge-category-all"
            >
              All ({media.length})
            </Badge>
            {categories.map((cat) => {
              const count = media.filter((item) => item.category === cat).length;
              return (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  className="cursor-pointer bg-white/20 hover:bg-white/30 text-white border-white/40"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setCurrentIndex(0);
                  }}
                  data-testid={`badge-category-${cat}`}
                >
                  {categoryLabels[cat] || cat} ({count})
                </Badge>
              );
            })}
          </div>
        )}

        {/* Main image */}
        <div className="relative w-full h-full flex items-center justify-center p-4">
          <img
            src={currentImage.url}
            alt={`${categoryLabels[currentImage.category] || currentImage.category} photo`}
            className="max-w-full max-h-full object-contain"
            data-testid="img-gallery-current"
          />

          {/* Navigation arrows */}
          {filteredMedia.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                onClick={goToPrevious}
                data-testid="button-previous"
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                onClick={goToNext}
                data-testid="button-next"
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}
        </div>

        {/* Image counter and category */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
          <div className="text-white text-sm bg-black/60 px-4 py-2 rounded-full" data-testid="text-counter">
            {currentIndex + 1} / {filteredMedia.length}
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white border-white/40" data-testid="badge-current-category">
            {categoryLabels[currentImage.category] || currentImage.category}
          </Badge>
        </div>

        {/* Thumbnail strip (mobile hidden) */}
        {filteredMedia.length > 1 && (
          <div className="absolute bottom-20 left-0 right-0 z-40 hidden md:block">
            <div className="flex justify-center gap-2 px-4 overflow-x-auto scrollbar-hide">
              {filteredMedia.slice(0, 10).map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === currentIndex
                      ? "border-white scale-110"
                      : "border-white/40 opacity-60 hover:opacity-100"
                  }`}
                  data-testid={`button-thumbnail-${idx}`}
                >
                  <img
                    src={item.url}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
              {filteredMedia.length > 10 && (
                <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-white/20 flex items-center justify-center text-white text-xs">
                  +{filteredMedia.length - 10}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
