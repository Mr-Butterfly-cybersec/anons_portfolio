"use client";

import { useState, useEffect } from "react";
import AddDrawingModal from "./AddDrawingModal";

/* SLIDESHOW — clean, retro photo viewer for drawings.
   - Smooth 60fps crossfade transitions between slides
   - Preloaded slide images for instant, zero-flicker switching
   - Themed brutalist retro buttons (no XP icons, no glowing effects)
   - High-security SHA-1024 protected drawing importer modal
   - Uncropped contain presentation */

const INITIAL_SLIDES = [
  { id: "default-1", url: "/art/riya-1.jpg", title: "Artwork #01 — Riyanshi Noir" },
  { id: "default-2", url: "/art/riya-2.jpg", title: "Artwork #02 — Cyber Matrix" },
  { id: "default-3", url: "/art/riya-3.jpg", title: "Artwork #03 — Street Art Study" },
  { id: "default-4", url: "/art/riya-4.jpg", title: "Artwork #04 — Hacker Portrait" }
];

export default function Sketchbook() {
  const [slides, setSlides] = useState(INITIAL_SLIDES);
  const [current, setCurrent] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  const prev = () => setCurrent((c) => (c === 0 ? slides.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === slides.length - 1 ? 0 : c + 1));

  // Fetch dynamic drawings from API on mount
  useEffect(() => {
    fetch("/api/drawings")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.drawings) && data.drawings.length > 0) {
          setSlides(data.drawings);
        }
      })
      .catch(() => {});
  }, []);

  // Preload all slides in browser cache to eliminate switching flicker
  useEffect(() => {
    slides.forEach((slide) => {
      const img = new Image();
      img.src = slide.url;
    });
  }, [slides]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showAddModal) return; // don't navigate when typing in modal
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides, showAddModal]);

  const handleDrawingAdded = (newDrawing) => {
    setSlides((prevSlides) => {
      const updated = [...prevSlides, newDrawing];
      setCurrent(updated.length - 1); // jump to newly imported artwork
      return updated;
    });
  };

  return (
    <section id="art" className="art-slideshow-section" aria-label="Artwork Slideshow">
      <div className="xp-slideshow-window">
        {/* Title bar */}
        <div className="xp-slideshow-titlebar">
          <span className="xp-ttl-icon">
            <svg viewBox="0 0 20 20" width="16" height="16">
              <path
                d="M2 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H2zm1 2h14v7.5l-3.5-3.5-5 5-2.5-2.5L3 14V5z"
                fill="#F6C13A"
                stroke="#B8860B"
                strokeWidth=".5"
              />
            </svg>
          </span>
          <span className="xp-ttl-text">Drawings_Viewer.exe</span>
          <div className="win-btns">
            <div className="win-btn min">_</div>
            <div className="win-btn max">▢</div>
            <div className="win-btn close">✕</div>
          </div>
        </div>

        {/* Menu bar */}
        <div className="xp-menubar">
          <span
            className="menu-label menu-clickable"
            onClick={() => setShowAddModal(true)}
            title="Import artwork via secure SHA-1024 enclave"
          >
            File
          </span>
          <span className="menu-label">Edit</span>
          <span className="menu-label">View</span>
          <span className="menu-label">Image</span>
          <span className="menu-label">Help</span>
        </div>

        {/* Address bar */}
        <div className="xp-intro-address">
          <span className="xp-lbl">Address</span>
          <div className="xp-addr-input">
            <svg viewBox="0 0 20 20" width="14" height="14">
              <path
                d="M1 5.5c0-.8.7-1.5 1.5-1.5H8l1.6 2H17.5c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-15C1.7 18 1 17.3 1 16.5v-11z"
                fill="#F6C13A"
                stroke="#B8860B"
                strokeWidth=".5"
              />
            </svg>
            C:\World\Drawings_Viewer.exe
          </div>
        </div>

        {/* Toolbar with in-theme buttons */}
        <div className="xp-slideshow-toolbar">
          <button
            className="xp-tool-btn xp-tool-add-btn"
            onClick={() => setShowAddModal(true)}
            title="Import drawing (Requires master passphrase)"
          >
            + ADD DRAWING
          </button>
          <button className="xp-tool-btn" onClick={prev} title="Previous drawing (Left Arrow)">
            ◀ PREV
          </button>
          <button className="xp-tool-btn" onClick={next} title="Next drawing (Right Arrow)">
            NEXT ▶
          </button>
        </div>

        {/* Main Stage with smooth stacked crossfade transition */}
        <div className="xp-slideshow-stage">
          <button className="slide-nav-arrow prev" onClick={prev} aria-label="Previous drawing">
            ◀
          </button>

          <div className="slide-frame">
            {slides.map((slide, idx) => (
              <div
                key={slide.id || slide.url}
                className={`slide-item ${idx === current ? "active" : ""}`}
                aria-hidden={idx !== current}
              >
                <img
                  src={slide.url}
                  alt={slide.title}
                  className="slide-img"
                  draggable={false}
                />
              </div>
            ))}
          </div>

          <button className="slide-nav-arrow next" onClick={next} aria-label="Next drawing">
            ▶
          </button>
        </div>

        {/* Thumbnail preview bar */}
        <div className="xp-slideshow-dots">
          {slides.map((slide, idx) => (
            <button
              key={slide.id || slide.url}
              className={`slide-dot ${idx === current ? "active" : ""}`}
              onClick={() => setCurrent(idx)}
              aria-label={`Jump to drawing ${idx + 1}`}
            >
              <span className="dot-thumb">
                <img src={slide.url} alt="" />
              </span>
              <span className="dot-num">{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</span>
            </button>
          ))}
        </div>

        {/* Statusbar */}
        <div className="xp-statusbar">
          <div>{slides.length} drawings loaded</div>
          <div className="xp-status-right">DRAWINGS_VIEWER.EXE — READY</div>
        </div>
      </div>

      {/* Retro SHA-1024 Protected Modal */}
      <AddDrawingModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onDrawingAdded={handleDrawingAdded}
      />
    </section>
  );
}
