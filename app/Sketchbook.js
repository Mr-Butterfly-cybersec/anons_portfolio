"use client";

import { useState, useEffect } from "react";

/* SLIDESHOW — clean, retro photo viewer for drawings.
   - Themed buttons (dark panel, line-strong border, theme green)
   - Zero glowing effects
   - Removed plate indicator box per user request
   - Pure, crisp retro aesthetic */

const SLIDES = [
  { url: "/art/riya-1.jpg", title: "Artwork #01 — Riyanshi Noir" },
  { url: "/art/riya-2.jpg", title: "Artwork #02 — Cyber Matrix" },
  { url: "/art/riya-3.jpg", title: "Artwork #03 — Street Art Study" },
  { url: "/art/riya-4.jpg", title: "Artwork #04 — Hacker Portrait" }
];

export default function Sketchbook() {
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => (c === 0 ? SLIDES.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === SLIDES.length - 1 ? 0 : c + 1));

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section id="art" className="art-slideshow-section" aria-label="Artwork Slideshow">
      <div className="xp-slideshow-window">
        {/* Title bar */}
        <div className="xp-slideshow-titlebar">
          <span className="xp-ttl-icon">
            <svg viewBox="0 0 20 20" width="16" height="16">
              <path d="M2 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H2zm1 2h14v7.5l-3.5-3.5-5 5-2.5-2.5L3 14V5z" fill="#F6C13A" stroke="#B8860B" strokeWidth=".5" />
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
          <span className="menu-label">File</span>
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
              <path d="M1 5.5c0-.8.7-1.5 1.5-1.5H8l1.6 2H17.5c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-15C1.7 18 1 17.3 1 16.5v-11z" fill="#F6C13A" stroke="#B8860B" strokeWidth=".5" />
            </svg>
            C:\World\Drawings_Viewer.exe
          </div>
        </div>

        {/* Toolbar with in-theme buttons (no plate indicator box, no XP icons) */}
        <div className="xp-slideshow-toolbar">
          <button className="xp-tool-btn" onClick={prev} title="Previous drawing (Left Arrow)">
            ◀ PREV
          </button>
          <button className="xp-tool-btn" onClick={next} title="Next drawing (Right Arrow)">
            NEXT ▶
          </button>
        </div>

        {/* Main Stage with in-theme arrow buttons (no glowing effects) */}
        <div className="xp-slideshow-stage">
          <button className="slide-nav-arrow prev" onClick={prev} aria-label="Previous drawing">
            ◀
          </button>

          <div className="slide-frame">
            <img
              key={current}
              src={SLIDES[current].url}
              alt={SLIDES[current].title}
              className="slide-img"
              draggable={false}
            />
            <div className="slide-scanlines" aria-hidden="true" />
          </div>

          <button className="slide-nav-arrow next" onClick={next} aria-label="Next drawing">
            ▶
          </button>
        </div>

        {/* Thumbnail preview bar */}
        <div className="xp-slideshow-dots">
          {SLIDES.map((slide, idx) => (
            <button
              key={slide.url}
              className={`slide-dot ${idx === current ? "active" : ""}`}
              onClick={() => setCurrent(idx)}
              aria-label={`Jump to drawing ${idx + 1}`}
            >
              <span className="dot-thumb">
                <img src={slide.url} alt="" />
              </span>
              <span className="dot-num">0{idx + 1}</span>
            </button>
          ))}
        </div>

        {/* Statusbar */}
        <div className="xp-statusbar">
          <div>{SLIDES.length} drawings loaded</div>
          <div className="xp-status-right">DRAWINGS_VIEWER.EXE — READY</div>
        </div>
      </div>
    </section>
  );
}
