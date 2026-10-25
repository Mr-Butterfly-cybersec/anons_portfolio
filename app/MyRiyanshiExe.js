"use client";

import { useEffect, useRef, useState } from "react";
import ArtworkLightbox from "./ArtworkLightbox";

/* MY_RIYANSHI.EXE — the intro card. A Windows XP folder window that
   shows artwork + a self-typing profile, same chrome as Field Console
   so the two sit side by side and read as one desktop. */

const PROFILE_LINES = [
  "Name: Riyanshi",
  "Gender: She/her",
  "Role: Test Subject",
  "Creator Name: Anonymous4140p"
];

export default function MyRiyanshiExe() {
  const [mounted, setMounted] = useState(false);
  const [typed, setTyped] = useState("");
  const [blink, setBlink] = useState(true);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const termRef = useRef(null);
  const timersRef = useRef([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // typewriter loop: type the profile, pause, erase, repeat
  useEffect(() => {
    if (!mounted) return;
    const timers = timersRef.current;
    const full = PROFILE_LINES.join("\n");
    let pos = 0;
    let deleting = false;

    const step = () => {
      if (!deleting) {
        pos += 1;
        setTyped(full.slice(0, pos));
        if (pos >= full.length) {
          deleting = true;
          timers.push(setTimeout(step, 2600));
          return;
        }
        timers.push(setTimeout(step, 26 + Math.random() * 30));
      } else {
        pos -= 1;
        setTyped(full.slice(0, pos));
        if (pos <= 0) {
          deleting = false;
          timers.push(setTimeout(step, 700));
          return;
        }
        timers.push(setTimeout(step, 12));
      }
    };
    timers.push(setTimeout(step, 500));
    return () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
    };
  }, [mounted]);

  // blink the terminal cursor
  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => setBlink((b) => !b), 530);
    return () => clearInterval(id);
  }, [mounted]);

  // keep the terminal scrolled to the bottom while it types
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [typed]);

  if (!mounted) return null;

  return (
    <div className="xp-intro" id="intro">
      <div className="xp-intro-titlebar">
        <span className="xp-ttl-icon">
          <svg viewBox="0 0 20 20" width="16" height="16">
            <path d="M2 5.5c0-.8.7-1.5 1.5-1.5h4l2 2h8c.8 0 1.5.7 1.5 1.5V16c0 .8-.7 1.5-1.5 1.5h-14c-.8 0-1.5-.7-1.5-1.5V5.5z" fill="#F6C13A" stroke="#B8860B" strokeWidth=".5" />
          </svg>
        </span>
        <span className="xp-ttl-text">My_Riyanshi.exe</span>
        <div className="win-btns">
          <div className="win-btn min">_</div>
          <div className="win-btn max">▢</div>
          <div className="win-btn close">✕</div>
        </div>
      </div>

      <div className="xp-menubar">
        <span className="menu-label">File</span>
        <span className="menu-label">Edit</span>
        <span className="menu-label">View</span>
        <span className="menu-label">Help</span>
      </div>

      <div className="xp-intro-address">
        <span className="xp-lbl">Address</span>
        <div className="xp-addr-input">
          <svg viewBox="0 0 20 20" width="14" height="14">
            <path d="M1 5.5c0-.8.7-1.5 1.5-1.5H8l1.6 2H17.5c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-15C1.7 18 1 17.3 1 16.5v-11z" fill="#F6C13A" stroke="#B8860B" strokeWidth=".5" />
          </svg>
          C:\World\My_Riyanshi.exe
        </div>
      </div>

      <div className="xp-intro-body">
        {/* artwork 1 — the intro image */}
        <div
          className="xp-intro-art xp-clickable-art"
          onClick={() => setShowFullscreen(true)}
          title="Click to view artwork full screen"
        >
          <img src="/art/riya-1.jpg" alt="Riyanshi artwork" draggable={false} />
          <span className="art-fs-badge">⛶ FULLSCREEN</span>
        </div>

        {/* self-typing profile terminal */}
        <div className="xp-intro-term" ref={termRef}>
          <span className="xp-intro-termtext">{typed}</span>
          <span className={`xp-intro-cursor ${blink ? "on" : ""}`} />
        </div>
      </div>

      <div className="xp-statusbar">
        <div>1 object</div>
        <div className="xp-status-right">INTRO.EXE — READY</div>
      </div>

      <ArtworkLightbox
        isOpen={showFullscreen}
        onClose={() => setShowFullscreen(false)}
        slides={[{ url: "/art/riya-1.jpg", title: "Artwork #01 — Riyanshi Noir" }]}
        currentIndex={0}
      />
    </div>
  );
}
