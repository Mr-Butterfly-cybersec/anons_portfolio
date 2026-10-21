"use client";

import { useEffect, useRef, useState } from "react";

/* The sketchbook — a page-flipping book of our artwork.
   Ported from MengTo/sketchbook (MIT-ish open source), re-themed to our
   dark hacker-artist portal, with our own drawings as the plates. */

const PAGES = [
  { url: "/art/riya-1.jpg", place: "FIG.01" },
  { url: "/art/riya-2.jpg", place: "FIG.02" },
  { url: "/art/riya-3.jpg", place: "FIG.03" },
  { url: "/art/riya-4.jpg", place: "FIG.04" }
];
const M = PAGES.length;
const LAND = 0;

const N = 18;       /* strips — enough for a smooth curve */
const SPAN = 0.449; /* gutter -> outer page edge */
const BETA = 0.6;   /* peak curl */
const TILT_X = 4.5, TILT_Y = 7;
const ZOOM_MIN = 0.9, ZOOM_MAX = 1.5;

export default function Sketchbook() {
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const sb3dRef = useRef(null);
  const tiltRef = useRef(null);
  const bookRef = useRef(null);
  const hintRef = useRef(null);
  const leftBtnRef = useRef(null);
  const rightBtnRef = useRef(null);

  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);

  // The sketchbook builds its DOM imperatively — only mount after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const wrap = wrapRef.current;
    const stage = stageRef.current;
    const sb3d = sb3dRef.current;
    const book = bookRef.current;
    const hint = hintRef.current;

    const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- state (mirrors the vanilla implementation) ---------- */
    let idx = 0, turn = null, strips = [];
    let curlEl = null, shadeF = [], shadeB = [];
    let gutterL = null, gutterR = null;
    let turnActive = false;
    let spring = null, raf = null, last = 0;
    let view = { rx: 0, ry: 0, z: 1, trx: 0, try_: 0, tz: 1 };
    let viewActive = false;
    let drag = null;
    let riffle = null, riffleAt = 0, introOn = false;

    /* ------------------------ helpers ------------------------ */
    function el(t, c) {
      const e = document.createElement(t);
      if (c) e.className = c;
      return e;
    }
    function imgEl(i, side) {
      const im = new Image();
      im.className = "sb-half-img " + side;
      im.draggable = false;
      im.alt = "";
      im.src = PAGES[i].url;
      return im;
    }
    function halfImg(i, side) {
      const im = imgEl(i, side);
      book.appendChild(im);
      return im;
    }
    function gutterEl(pos) {
      const g = el("div", "gutter-shade " + pos);
      book.appendChild(g);
      return g;
    }

    /* ------------------- the turning leaf ------------------- */
    function buildCurl(dir, from, to) {
      strips = [];
      shadeF = [];
      shadeB = [];
      const c = el("div", "curl " + dir);
      let host = c;
      for (let i = 0; i < N; i++) {
        const s = el("div", "strip");
        s.style.setProperty("--i", i);
        const gut = "calc(var(--bw) * 0.5)";
        const sw = "calc(var(--bw) * " + SPAN + " / " + N + ")";
        const A = "calc(-1 * (" + gut + " + " + i + " * " + sw + "))";
        const B = "calc(" + (i + 1) + " * " + sw + " - " + gut + ")";
        const f = el("div", "face front"), b = el("div", "face back");
        const dress = (e, url, px) => {
          e.style.backgroundImage = "url(" + url + ")";
          e.style.backgroundPositionX = px;
        };
        dress(f, PAGES[from].url, dir === "next" ? A : B);
        dress(b, PAGES[to].url, dir === "next" ? B : A);
        f.appendChild(el("div", "sh"));
        f.appendChild(el("div", "gl"));
        b.appendChild(el("div", "sh"));
        b.appendChild(el("div", "gl"));
        s.appendChild(f);
        s.appendChild(b);
        if (i === N - 1) s.classList.add("edge");
        host.appendChild(s);
        host = s;
        strips.push(s);
        shadeF.push(f.querySelector(".sh"));
        shadeB.push(b.querySelector(".sh"));
      }
      curlEl = c;
      return c;
    }
    function applyTurn(t) {
      const th = Math.PI * t;
      const beta = BETA * Math.sin(Math.PI * t);
      const D = 180 / Math.PI;
      const tt = th + beta, td = (2 * beta) / N;
      if (curlEl) {
        curlEl.style.transform = "rotateY(" + (turn.dir === "next" ? -tt : tt) * D + "deg)";
        curlEl.style.setProperty("--td", (td * D).toFixed(3) + "deg");
      }
      sb3d.style.setProperty("--shade", Math.sin(Math.PI * t).toFixed(3));
      shadeF.forEach((el, i) => {
        const l = Math.abs(Math.cos(tt - i * td));
        el.style.opacity = (1 - l) * 0.62;
      });
      shadeB.forEach((el, i) => {
        const l = Math.abs(Math.cos(tt - (i + 1) * td));
        el.style.opacity = (1 - l) * 0.62;
      });
    }
    function setHalf(pos, page) {
      const img = halfImg(page, pos);
      const shade = gutterEl(pos);
      if (pos === "left") {
        if (gutterL) gutterL.replaceWith(shade);
        else book.appendChild(shade);
        gutterL = shade;
      } else {
        if (gutterR) gutterR.replaceWith(shade);
        else book.appendChild(shade);
        gutterR = shade;
      }
      return img;
    }
    function rebuildPage() {
      book.textContent = "";
      gutterL = null;
      gutterR = null;
      curlEl = null;
      if (turnActive) {
        const next = turn.dir === "next";
        const l = setHalf("left", next ? turn.from : turn.to);
        const r = setHalf("right", next ? turn.to : turn.from);
        book.appendChild(buildCurl(turn.dir, turn.from, turn.to));
        applyTurn(turn.t);
        void l; void r;
      } else {
        const f = el("div", "sb-full");
        const im = new Image();
        im.src = PAGES[idx].url;
        im.alt = PAGES[idx].place;
        im.draggable = false;
        f.appendChild(im);
        book.appendChild(f);
        sb3d.style.setProperty("--shade", "0");
      }
      layout();
      addZones();
    }
    function addZones() {
      const a = el("button", "sb-zone sb-prev");
      const b = el("button", "sb-zone sb-next");
      a.setAttribute("aria-label", "previous page");
      b.setAttribute("aria-label", "next page");
      book.appendChild(a);
      book.appendChild(b);
    }
    function clearBook() {
      book.textContent = "";
      gutterL = null;
      gutterR = null;
      curlEl = null;
    }
    function paint() {
      rebuildPage();
    }
    function paintStatic() {
      clearBook();
      const next = turn.dir === "next";
      const l = setHalf("left", next ? turn.from : turn.to);
      const r = setHalf("right", next ? turn.to : turn.from);
      if (gutterL) gutterL.style.opacity = "0";
      if (gutterR) gutterR.style.opacity = "0";
      book.appendChild(buildCurl(turn.dir, turn.from, turn.to));
      applyTurn(turn.t);
      addZones();
      void l; void r;
    }
    function layout() {
      const bw = book.clientWidth;
      sb3d.style.setProperty("--bw", bw + "px");
    }
    function onResize() {
      layout();
    }
    window.addEventListener("resize", onResize);

    /* ----------------------- spring loop ----------------------- */
    function animateTo(target, onDone, stiff, damp) {
      spring = { kind: "spring", v: 0, target, done: onDone, k: stiff || 150, c: damp || 22 };
      kick();
    }
    function tweenTo(target, dur, onDone) {
      spring = { kind: "tween", from: turn ? turn.t : 0, target, dur, e: 0, done: onDone };
      kick();
    }
    function tick(now) {
      raf = null;
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      if (spring && turn) {
        const s = spring;
        if (s.kind === "tween") {
          s.e += dt;
          const k = Math.min(1, s.e / s.dur);
          turn.t = s.from + (s.target - s.from) * k;
          applyTurn(turn.t);
          if (k >= 1) {
            spring = null;
            const d = s.done;
            d && d();
          }
        } else {
          const x = turn.t - s.target;
          s.v += (-s.k * x - s.c * s.v) * dt;
          turn.t += s.v * dt;
          if (Math.abs(turn.t - s.target) < 0.002 && Math.abs(s.v) < 0.02) {
            turn.t = s.target;
            spring = null;
            applyTurn(turn.t);
            const d = s.done;
            d && d();
          } else applyTurn(turn.t);
        }
      }
      viewSpring();
      if ((spring || viewActive) && raf === null) raf = requestAnimationFrame(tick);
    }
    function kick() {
      if (raf === null) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    }

    /* ------------------- tilt + zoom of the book ------------------- */
    function applyView() {
      const rx = view.rx.toFixed(2) + "deg", ry = view.ry.toFixed(2) + "deg", z = view.z.toFixed(3);
      const tilt = tiltRef.current;
      if (!tilt) return;
      tilt.style.transform = "rotateX(" + rx + ") rotateY(" + ry + ") scale(" + z + ")";
    }
    function viewSpring() {
      const e = 0.14;
      let moved = false;
      for (const [k, t] of [
        ["rx", "trx"],
        ["ry", "try_"],
        ["z", "tz"]
      ]) {
        const d = view[t] - view[k];
        if (Math.abs(d) > 0.0006) {
          view[k] += d * e;
          moved = true;
        } else view[k] = view[t];
      }
      if (moved) applyView();
      viewActive = moved;
      return moved;
    }
    function setView(rx, ry, z) {
      view.trx = Math.max(-TILT_X, Math.min(TILT_X, rx));
      view.try_ = Math.max(-TILT_Y, Math.min(TILT_Y, ry));
      view.tz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
      viewActive = true;
      kick();
    }
    function tiltTo(cx, cy) {
      if (drag) return;
      const r = book.getBoundingClientRect();
      if (!r.width) return;
      const nx = Math.max(-1, Math.min(1, (cx - (r.left + r.width / 2)) / (r.width * 0.62)));
      const ny = Math.max(-1, Math.min(1, (cy - (r.top + r.height / 2)) / (r.height * 0.9)));
      setView(-ny * TILT_X, nx * TILT_Y, view.tz);
    }
    function onPointerMove(e) {
      if (e.pointerType === "touch") return;
      tiltTo(e.clientX, e.clientY);
    }
    function onPointerOut(e) {
      if (!e.relatedTarget) setView(0, 0, view.tz);
    }
    function onBlur() {
      setView(0, 0, view.tz);
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerOut);
    window.addEventListener("blur", onBlur);
    stage.addEventListener("dblclick", () => setView(view.trx, view.try_, 1));

    /* ------------------------ pointer work ------------------------ */
    function bookRect() {
      return book.getBoundingClientRect();
    }
    function hideHint() {
      hint.classList.add("gone");
    }
    function onDown(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      const onBook = e.target.closest(".sb-zone");
      stage.setPointerCapture(e.pointerId);
      hideHint();
      if (!onBook || introOn) return;
      const r = bookRect();
      const dir = (e.clientX - r.left) / r.width > 0.5 ? "next" : "prev";
      startTurn(dir, 0);
      drag = { dir, x0: e.clientX, w: r.width, moved: 0, vel: 0, tPrev: performance.now() };
    }
    function onMove(e) {
      if (!drag) return;
      const dx = e.clientX - drag.x0;
      drag.moved = Math.max(drag.moved, Math.abs(dx));
      const raw = (drag.dir === "next" ? -dx : dx) / (drag.w * 0.62);
      const t = Math.max(0, Math.min(1, raw));
      const now = performance.now();
      drag.vel = (t - (turn ? turn.t : 0)) / Math.max(0.001, (now - drag.tPrev) / 1000);
      drag.tPrev = now;
      if (turn) {
        turn.t = t;
        applyTurn(t);
      }
    }
    function endDrag() {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (!turn) return;
      if (d.moved < 6) {
        commit();
        return;
      }
      const go = turn.t > 0.42 || d.vel > 1.1;
      if (go) commit();
      else cancel();
    }
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("dragstart", (e) => e.preventDefault());
    stage.addEventListener("selectstart", (e) => e.preventDefault());
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);

    /* ------------------------ turn control ------------------------ */
    function startTurn(dir, t) {
      spring = null;
      if (turn) {
        idx = turn.to;
        turn = null;
      }
      const from = idx;
      turn = { dir, from, to: dir === "next" ? (from + 1) % M : (from - 1 + M) % M, t: t || 0 };
      paintStatic();
      turnActive = true;
    }
    function commit() {
      if (!turn) return;
      if (REDUCED) {
        idx = turn.to;
        turn = null;
        turnActive = false;
        paint();
        return;
      }
      animateTo(
        1,
        () => {
          idx = turn.to;
          turn = null;
          turnActive = false;
          paint();
        },
        170,
        26
      );
    }
    function cancel() {
      if (!turn) return;
      animateTo(
        0,
        () => {
          turn = null;
          turnActive = false;
          paint();
        },
        150,
        24
      );
    }
    function step(dir) {
      if (introOn) endIntro();
      if (turn) {
        idx = turn.to;
        turn = null;
        turnActive = false;
      }
      startTurn(dir, 0);
      commit();
    }
    function goTo(i) {
      if (introOn) endIntro();
      if (i === idx) return;
      if (turn) {
        idx = turn.to;
        turn = null;
      }
      const fwd = (i - idx + M) % M, back = (idx - i + M) % M;
      if (Math.min(fwd, back) === 1) {
        step(fwd === 1 ? "next" : "prev");
        return;
      }
      idx = i;
      paint();
    }
    leftBtnRef.current.onclick = () => step("prev");
    rightBtnRef.current.onclick = () => step("next");
    function onKey(e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      hideHint();
      step(e.key === "ArrowRight" ? "next" : "prev");
    }
    window.addEventListener("keydown", onKey);

    /* --------------------------- the riffle --------------------------- */
    function endIntro() {
      introOn = false;
      wrap.classList.remove("intro", "b2");
    }
    function riffleStep() {
      const s = riffle[riffleAt];
      wrap.classList.toggle("b2", s.bell > 0.55);
      startTurn("next", 0);
      tweenTo(1, s.dur, () => {
        idx = turn.to;
        turn = null;
        turnActive = false;
        riffleAt++;
        if (introOn && riffleAt < riffle.length) {
          rebuildPage();
          riffleStep();
        } else {
          endIntro();
          rebuildPage();
        }
      });
    }
    function startIntro() {
      const coarse = matchMedia("(max-width: 640px), (pointer: coarse)").matches;
      if (coarse || REDUCED) {
        idx = LAND;
        paint();
        return;
      }
      const steps = M + LAND;
      riffle = [];
      for (let r = 0; r < steps; r++) {
        const bell = Math.sin(Math.PI * (r / (steps - 1)));
        riffle.push({ bell, dur: 0.26 - 0.19 * bell });
      }
      riffleAt = 0;
      introOn = true;
      wrap.classList.add("intro");
      riffleStep();
    }

    /* ----------------------------- boot ----------------------------- */
    rebuildPage();
    applyView();
    const t = setTimeout(startIntro, 220);
    setTick(1);

    return () => {
      clearTimeout(t);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", endDrag);
      stage.removeEventListener("pointercancel", endDrag);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <section id="art" className="sketchbook-section">
      <div className="sb-wrap" id="sbWrap" ref={wrapRef}>
        <div className="sb-stage" ref={stageRef}>
          <button className="sb-arrow left" ref={leftBtnRef} aria-label="previous page">
            <svg viewBox="0 0 14 44" width="14" height="44" fill="none" aria-hidden="true">
              <polyline points="11,3 3,22 11,41" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="sb-3d" ref={sb3dRef}>
            <div className="sb-tilt" ref={tiltRef}>
              <div className="sb-cast ambient" aria-hidden="true" />
              <div className="sb-cast contact" aria-hidden="true" />
              <div className="sb-cast hair" aria-hidden="true" />
              <div className="sb-book" ref={bookRef} />
            </div>
          </div>

          <button className="sb-arrow right" ref={rightBtnRef} aria-label="next page">
            <svg viewBox="0 0 14 44" width="14" height="44" fill="none" aria-hidden="true">
              <polyline points="3,3 11,22 3,41" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <p className="sb-hint" ref={hintRef}>
          Drag the page to turn
        </p>
      </div>
    </section>
  );
}
