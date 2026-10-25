"use client";

import { useEffect, useRef } from "react";

export default function ArtworkLightbox({
  isOpen,
  onClose,
  slides = [],
  currentIndex = 0,
  onNavigate
}) {
  const touchStartXRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onNavigate) {
        onNavigate(currentIndex === 0 ? slides.length - 1 : currentIndex - 1);
      }
      if (e.key === "ArrowRight" && onNavigate) {
        onNavigate(currentIndex === slides.length - 1 ? 0 : currentIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, slides.length, onClose, onNavigate]);

  if (!isOpen || !slides || slides.length === 0) return null;

  const currentSlide = slides[currentIndex] || slides[0];

  const handlePrev = (e) => {
    e?.stopPropagation();
    if (onNavigate) {
      onNavigate(currentIndex === 0 ? slides.length - 1 : currentIndex - 1);
    }
  };

  const handleNext = (e) => {
    e?.stopPropagation();
    if (onNavigate) {
      onNavigate(currentIndex === slides.length - 1 ? 0 : currentIndex + 1);
    }
  };

  // Mobile Touch Swipe Handling
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartXRef.current;
    touchStartXRef.current = null;

    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        handlePrev(); // swiped right -> previous
      } else {
        handleNext(); // swiped left -> next
      }
    }
  };

  return (
    <div
      className="xp-lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen Artwork View"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Lightbox Chrome Header */}
      <div className="xp-lightbox-header" onClick={(e) => e.stopPropagation()}>
        <div className="xp-lightbox-title">
          <span className="fs-badge">FULLSCREEN</span>
          <span className="fs-text">
            [{currentIndex + 1 < 10 ? `0${currentIndex + 1}` : currentIndex + 1} /{" "}
            {slides.length < 10 ? `0${slides.length}` : slides.length}] —{" "}
            {currentSlide.title || "Artwork"}
          </span>
        </div>
        <button
          className="xp-lightbox-close"
          onClick={onClose}
          aria-label="Close fullscreen view (Escape)"
          title="Close (Esc)"
        >
          ✕ CLOSE
        </button>
      </div>

      {/* Main Fullscreen Stage */}
      <div className="xp-lightbox-stage" onClick={(e) => e.stopPropagation()}>
        {slides.length > 1 && (
          <button
            className="xp-lightbox-arrow prev"
            onClick={handlePrev}
            aria-label="Previous artwork"
            title="Previous (Left Arrow)"
          >
            ◀
          </button>
        )}

        <div className="xp-lightbox-img-wrap" onClick={onClose}>
          <img
            key={currentSlide.url}
            src={currentSlide.url}
            alt={currentSlide.title || "Artwork"}
            className="xp-lightbox-img"
            draggable={false}
          />
        </div>

        {slides.length > 1 && (
          <button
            className="xp-lightbox-arrow next"
            onClick={handleNext}
            aria-label="Next artwork"
            title="Next (Right Arrow)"
          >
            ▶
          </button>
        )}
      </div>

      {/* Mobile Swipe / Controls Hint */}
      <div className="xp-lightbox-footer" onClick={(e) => e.stopPropagation()}>
        <span className="fs-hint">
          {slides.length > 1
            ? "Swipe or use arrows to navigate • Tap anywhere outside to close"
            : "Tap anywhere to close"}
        </span>
      </div>
    </div>
  );
}
