"use client";

import { useEffect, useRef, useState } from "react";

/* FIELD CONSOLE — a Windows XP folder window containing a single
   field-console.exe icon. Double-click (run) the exe → a cmd window
   opens and provisions the machine via the backend; when the instance
   is up it prints session id + machine ip + password in the cmd output. */

const initialState = {
  phase: "idle",
  message: "SYSTEM READY",
  instanceId: "",
  ip: "",
  username: "",
  password: "",
  sessionId: "",
  error: ""
};

export default function XpConsole() {
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const [hintsVisible, setHintsVisible] = useState(false);
  const [folderMin, setFolderMin] = useState(false);
  const [folderClosed, setFolderClosed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdMin, setCmdMin] = useState(false);
  const [cmdLog, setCmdLog] = useState([
    "Microsoft Windows XP [Version 5.1.2600]",
    "(C) Copyright 1985-2001 Microsoft Corp.",
    ""
  ]);
  const [cmdInput, setCmdInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [notepad, setNotepad] = useState(null); // { name, content } or null
  const [openMenu, setOpenMenu] = useState(null); // which menubar dropdown is open
  const heartbeatRef = useRef(null);
  const folderRef = useRef(null);
  const cmdRef = useRef(null);
  const cmdBodyRef = useRef(null);
  const inputRef = useRef(null);
  const stateRef = useRef(state);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // keep the cmd scrolled to the bottom
  useEffect(() => {
    if (cmdBodyRef.current) {
      cmdBodyRef.current.scrollTop = cmdBodyRef.current.scrollHeight;
    }
  }, [cmdLog, cmdInput]);

  const hints = [
    "Hint: Check the hidden directory in the VM filesystem",
    "Hint: The flag is encoded in the AMI metadata",
    "Hint: Look for port 1337 on the running instance"
  ];

  /* files in the folder — instructions + hints, open in Notepad */
  const files = [
    {
      name: "instructions.txt",
      content:
        "FIELD CONSOLE — instructions\n" +
        "========================================\n" +
        "1. Double-click field-console.exe to provision a machine.\n" +
        "2. Wait for the cmd window to print your session id,\n" +
        "   machine ip, and password.\n" +
        "3. Connect with: ssh <user>@<ip>\n" +
        "4. Find the flag. The machine is ephemeral — terminate\n" +
        "   it when you're done.\n" +
        "Good luck, player."
    },
    {
      name: "hints.txt",
      content:
        "HINTS\n" +
        "========================================\n" +
        "1. Check the hidden directory in the VM filesystem.\n" +
        "2. The flag is encoded in the AMI metadata.\n" +
        "3. Look for port 1337 on the running instance.\n" +
        "\nUse them wisely — it's more fun blind."
    }
  ];

  function pushLog(lines) {
    setCmdLog((prev) => [...prev, ...lines]);
  }

  /* progressive typing animation for provisioning lines */
  function typeLines(lines, done) {
    setTyping(true);
    let i = 0;
    const step = () => {
      if (i < lines.length) {
        pushLog([lines[i]]);
        i += 1;
        typingTimerRef.current = setTimeout(step, 130 + Math.random() * 140);
      } else {
        setTyping(false);
        if (done) done();
      }
    };
    typingTimerRef.current = setTimeout(step, 150);
  }

  function clearTyping() {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setTyping(false);
  }

  function clearHeartbeat() {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }

  function startHeartbeat(instanceId) {
    clearHeartbeat();
    heartbeatRef.current = setInterval(async () => {
      try {
        await fetch("/api/vm/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instanceId })
        });
      } catch (err) {
        console.error("Heartbeat failed:", err);
      }
    }, 30000);
  }

  /* run the exe — opens the cmd window and provisions the machine */
  function runExe() {
    setCmdOpen(true);
    setCmdMin(false);
    setBusy(true);
    setState({
      ...initialState,
      phase: "starting",
      message: "REQUESTING MACHINE"
    });
    clearTyping();
    typeLines([
      "",
      "C:\\World> field-console.exe --provision",
      "  [*] contacting AWS ap-south-1 ..."
    ]);

    fetch("/api/vm/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    })
      .then(async (response) => {
        const data = await response.json();

        if (response.status === 409 && data.occupied) {
          setState({
            ...initialState,
            phase: "occupied",
            message: "MACHINE OCCUPIED",
            instanceId: data.instanceId || "",
            error: ""
          });
          typeLines(["  [!] MACHINE OCCUPIED — another player is inside.", ""]);
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || "The provisioning request failed.");
        }

        setState({
          phase: data.state === "running" ? "running" : "booting",
          message: data.state === "running" ? "MACHINE ONLINE" : "MACHINE BOOTING",
          instanceId: data.instanceId || "",
          ip: data.publicIp || "",
          username: data.username || "",
          password: data.password || "",
          sessionId: data.sessionId || "",
          error: ""
        });

        if (data.publicIp) {
          typeLines([
            "  [*] launching ephemeral instance ...",
            "  [+] instance online: " + (data.instanceId || ""),
            "  [+] session : " + (data.sessionId || ""),
            "  [+] host    : " + data.publicIp,
            "  [+] user    : " + data.username,
            "  [+] pass    : " + data.password,
            "",
            "  ssh " + data.username + "@" + data.publicIp,
            ""
          ]);
          startHeartbeat(data.instanceId);
        } else if (data.state !== "running" && data.instanceId) {
          typeLines(["  [*] launching ephemeral instance ...", "  [*] booting, waiting for public ip ..."]);
          pollInstance(data.instanceId);
        }
      })
      .catch((error) => {
        setState({
          ...initialState,
          phase: "error",
          message: "REQUEST FAILED",
          error: error.message
        });
        typeLines(["  [x] " + error.message, ""]);
      })
      .finally(() => {
        setBusy(false);
      });
  }

  /* interactive cmd prompt */
  function runCommand(raw) {
    const cmd = raw.trim();
    pushLog(["C:\\World> " + cmd]);
    if (!cmd) return;
    const lower = cmd.toLowerCase();
    if (lower === "ssh") {
      const cur = stateRef.current;
      if (cur.ip && cur.username) {
        pushLog([
          "  ssh " + cur.username + "@" + cur.ip,
          "  (or open: ssh://" + cur.username + "@" + cur.ip + ")",
          ""
        ]);
      } else {
        pushLog(["  no active machine. run field-console.exe first.", ""]);
      }
    } else if (lower === "help") {
      pushLog(["  available commands:", "    ssh   — connect to the machine", "    help  — show this help", "    clear — clear the screen", "    exit  — close cmd", ""]);
    } else if (lower === "clear") {
      setCmdLog([]);
    } else if (lower === "exit") {
      pushLog([""]);
      setCmdOpen(false);
      clearHeartbeat();
    } else if (lower.startsWith("field-console")) {
      runExe();
    } else {
      pushLog(["  '" + cmd + "' is not recognized as an internal or external command,", "  operable program or batch file.", ""]);
    }
  }

  function onCmdKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = cmdInput;
      setCmdInput("");
      runCommand(val);
    }
  }

  async function pollInstance(instanceId) {
    let attempts = 0;

    const timer = setInterval(async () => {
      attempts += 1;

      try {
        const response = await fetch(
          `/api/vm/status/${encodeURIComponent(instanceId)}`
        );
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Status check failed.");

        setState((current) => ({
          ...current,
          phase: data.publicIp ? "running" : "booting",
          message: data.publicIp ? "MACHINE ONLINE" : "MACHINE BOOTING",
          ip: data.publicIp || "",
          instanceId: instanceId
        }));

        if (data.publicIp) {
          clearInterval(timer);
          const cur = stateRef.current;
          typeLines([
            "  [+] instance online: " + instanceId,
            "  [+] session : " + (cur.sessionId || ""),
            "  [+] host    : " + data.publicIp,
            "  [+] user    : " + (cur.username || ""),
            "  [+] pass    : " + (cur.password || ""),
            "",
            "  ssh " + (cur.username || "") + "@" + data.publicIp,
            ""
          ]);
          startHeartbeat(instanceId);
        } else if (attempts >= 30) {
          clearInterval(timer);
        }
      } catch (error) {
        clearInterval(timer);
        setState((current) => ({
          ...current,
          phase: "error",
          message: "STATUS ERROR",
          error: error.message
        }));
        typeLines(["  [x] " + error.message, ""]);
      }
    }, 5000);
  }

  async function destroyMachine() {
    if (!state.instanceId) return;

    setBusy(true);
    clearTyping();
    typeLines(["", "C:\\World> field-console.exe --terminate " + state.instanceId]);

    try {
      const response = await fetch("/api/vm/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId: state.instanceId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not terminate the machine.");
      }

      clearHeartbeat();
      setState({
        ...initialState,
        phase: "idle",
        message: "MACHINE TERMINATED"
      });
      typeLines(["  [+] instance terminated. session closed.", ""]);
    } catch (error) {
      setState((current) => ({
        ...current,
        phase: "error",
        message: "TERMINATION FAILED",
        error: error.message
      }));
      typeLines(["  [x] " + error.message, ""]);
    } finally {
      setBusy(false);
    }
  }

  // Cleanup heartbeat on unmount
  useEffect(() => {
    return () => {
      clearHeartbeat();
      clearTyping();
    };
  }, []);

  // window chrome: drag + resize + click-to-front for folder, cmd, notepad
  const zTopRef = useRef(100);
  useEffect(() => {
    const folder = folderRef.current;
    if (!folder) return;

    const zTop = zTopRef;
    const winEls = () => [folder, cmdRef.current, folder.querySelector(".xp-notepad")].filter(Boolean);

    function bringToFront(win) {
      zTop.current += 1;
      win.style.zIndex = zTop.current;
    }

    /* any mousedown on a window raises it — click to focus, like real XP */
    function onAnyDown(e) {
      const w = e.currentTarget;
      bringToFront(w);
    }

    const bind = (win, handle) => {
      if (!handle) return () => {};
      let dragging = false;
      let offX = 0;
      let offY = 0;

      function onDown(e) {
        if (e.target.closest(".win-btn")) return;
        dragging = true;
        offX = e.clientX - win.offsetLeft;
        offY = e.clientY - win.offsetTop;
        bringToFront(win);
        e.preventDefault();
      }

      function onMove(e) {
        if (!dragging) return;
        let nl = e.clientX - offX;
        let nt = e.clientY - offY;
        nl = Math.max(-win.offsetWidth + 80, Math.min(nl, window.innerWidth - 80));
        nt = Math.max(0, Math.min(nt, window.innerHeight - 30));
        win.style.left = nl + "px";
        win.style.top = nt + "px";
      }

      function onUp() {
        dragging = false;
      }

      handle.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return () => {
        handle.removeEventListener("mousedown", onDown);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
    };

    const bindResize = (win, handle) => {
      if (!handle) return () => {};
      let resizing = false;
      let startX = 0;
      let startY = 0;
      let startW = 0;
      let startH = 0;

      function onDown(e) {
        resizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = win.offsetWidth;
        startH = win.offsetHeight;
        bringToFront(win);
        e.preventDefault();
        e.stopPropagation();
      }

      function onMove(e) {
        if (!resizing) return;
        win.style.width = Math.max(380, startW + (e.clientX - startX)) + "px";
        win.style.height = Math.max(240, startH + (e.clientY - startY)) + "px";
      }

      function onUp() {
        resizing = false;
      }

      handle.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return () => {
        handle.removeEventListener("mousedown", onDown);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
    };

    /* attach to whatever windows exist right now */
    const unsubs = [];
    winEls().forEach((w) => {
      w.addEventListener("mousedown", onAnyDown);
      unsubs.push(() => w.removeEventListener("mousedown", onAnyDown));
      const t = w.querySelector(".xp-folder-titlebar, .xp-cmd-titlebar, .xp-notepad-titlebar");
      unsubs.push(bind(w, t));
      if (w.classList.contains("xp-cmd") || w.classList.contains("xp-notepad")) {
        unsubs.push(bindResize(w, w.querySelector(".xp-resize")));
      }
    });

    return () => {
      unsubs.forEach((u) => u && u());
    };
  }, [cmdOpen, notepad]);

  // close dropdown menus when clicking elsewhere
  useEffect(() => {
    if (!openMenu) return;
    function onDocClick(e) {
      if (!e.target.closest(".menu-item")) setOpenMenu(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openMenu]);

  const online = state.phase === "running";
  const occupied = state.phase === "occupied";

  return (
    <div className="xp-folder" id="console" ref={folderRef} style={{ zIndex: 10 }}>
      {!folderClosed && (
        <>
          {/* XP folder titlebar */}
          <div className="xp-folder-titlebar">
            <span className="xp-ttl-icon">
              <svg viewBox="0 0 20 20" width="16" height="16">
                <path d="M2 5.5c0-.8.7-1.5 1.5-1.5h4l2 2h8c.8 0 1.5.7 1.5 1.5V16c0 .8-.7 1.5-1.5 1.5h-14c-.8 0-1.5-.7-1.5-1.5V5.5z" fill="#F6C13A" stroke="#B8860B" strokeWidth=".5" />
              </svg>
            </span>
            <span className="xp-ttl-text">Field Console</span>
            <div className="win-btns">
              <div className="win-btn min" onClick={() => setFolderMin(true)}>_</div>
              <div className="win-btn max" onClick={() => setFolderMin(false)}>▢</div>
              <div className="win-btn close" onClick={() => setFolderClosed(true)}>✕</div>
            </div>
          </div>

          {!folderMin && (
            <>
              {/* menubar — interactive dropdowns */}
              <div className="xp-menubar">
                <div className="menu-item">
                  <span className="menu-label" onClick={() => setOpenMenu(openMenu === "file" ? null : "file")}>File</span>
                  {openMenu === "file" && (
                    <div className="menu-dropdown">
                      <button onClick={() => { setFolderClosed(true); setOpenMenu(null); }}>Close</button>
                      <button onClick={() => { setNotepad({ name: "instructions.txt", content: files[0].content }); setOpenMenu(null); }}>Open Instructions</button>
                      <button onClick={() => { setNotepad({ name: "hints.txt", content: files[1].content }); setOpenMenu(null); }}>Open Hints</button>
                      <div className="menu-sep" />
                      <button onClick={() => { runExe(); setOpenMenu(null); }}>Run field-console.exe</button>
                    </div>
                  )}
                </div>
                <div className="menu-item">
                  <span className="menu-label" onClick={() => setOpenMenu(openMenu === "view" ? null : "view")}>View</span>
                  {openMenu === "view" && (
                    <div className="menu-dropdown">
                      <button onClick={() => setOpenMenu(null)}>Refresh</button>
                      <button onClick={() => { document.querySelectorAll(".xp-folder .file-icon.selected").forEach((i) => i.classList.remove("selected")); setOpenMenu(null); }}>Deselect All</button>
                    </div>
                  )}
                </div>
                <div className="menu-item">
                  <span className="menu-label" onClick={() => setOpenMenu(openMenu === "help" ? null : "help")}>Help</span>
                  {openMenu === "help" && (
                    <div className="menu-dropdown">
                      <button onClick={() => { setNotepad({ name: "instructions.txt", content: files[0].content }); setOpenMenu(null); }}>How to use</button>
                      <button onClick={() => setOpenMenu(null)}>About Field Console</button>
                    </div>
                  )}
                </div>
              </div>

              {/* toolbar */}
              <div className="xp-toolbar">
                <div className="tb-btn" onClick={() => setFolderClosed(true)} title="close window">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <circle cx="12" cy="12" r="10" fill="#66c35c" stroke="#2f8f2d" />
                    <path d="M13.5 7 8.5 12l5 5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Back</span>
                </div>
                <div className="tb-sep" />
                <div className="tb-btn active" onClick={() => { setFolderMin(false); setOpenMenu(null); }} title="show files">
                  <svg viewBox="0 0 20 20" width="20" height="20">
                    <path d="M1 5.5c0-.8.7-1.5 1.5-1.5H8l1.6 2H17.5c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-15C1.7 18 1 17.3 1 16.5v-11z" fill="#F6C13A" stroke="#B8860B" strokeWidth=".5" />
                  </svg>
                  <span>Folders</span>
                </div>
                <div className="tb-sep" />
                <div className="tb-btn" onClick={runExe} title="run field-console.exe">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <circle cx="12" cy="12" r="10" fill="#7bc96f" stroke="#2f8f2d" />
                    <path d="M10 8v8l6-4z" fill="#fff" />
                  </svg>
                  <span>Run exe</span>
                </div>
              </div>

              {/* address bar */}
              <div className="xp-addressbar">
                <span className="xp-lbl">Address</span>
                <div className="xp-addr-input">
                  <svg viewBox="0 0 20 20" width="14" height="14">
                    <path d="M1 5.5c0-.8.7-1.5 1.5-1.5H8l1.6 2H17.5c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-15C1.7 18 1 17.3 1 16.5v-11z" fill="#F6C13A" stroke="#B8860B" strokeWidth=".5" />
                  </svg>
                  C:\World\Field Console
                </div>
                <div className="go-btn" onClick={runExe}>Go</div>
              </div>

              {/* body — the exe icon */}
              <div className="xp-body">
                <div className="xp-content">
                  <div className="xp-folder-note">
                    Double-click <b>field-console.exe</b> to provision a machine.
                  </div>
                  <div className="icon-grid">
                    <div
                      className={`file-icon ${busy ? "busy" : ""}`}
                      onDoubleClick={runExe}
                      onClick={(e) => {
                        document.querySelectorAll(".xp-folder .file-icon.selected").forEach((i) => i.classList.remove("selected"));
                        e.currentTarget.classList.add("selected");
                        e.stopPropagation();
                      }}
                      title="run field-console.exe"
                    >
                      {/* classic XP application icon: white page + blue app emblem */}
                      <svg viewBox="0 0 64 64" width="48" height="48">
                        <defs>
                          <linearGradient id="exe-page" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#ffffff" />
                            <stop offset="1" stopColor="#e8e8e8" />
                          </linearGradient>
                          <linearGradient id="exe-blue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#3f8cf3" />
                            <stop offset="1" stopColor="#0a58d9" />
                          </linearGradient>
                        </defs>
                        {/* page */}
                        <path d="M14 2h26l10 10v46a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z" fill="url(#exe-page)" stroke="#8C8C8C" strokeWidth="1.2" />
                        <path d="M40 2v10h10z" fill="#D8D8D8" />
                        {/* app emblem — the classic blue window */}
                        <rect x="18" y="24" width="28" height="22" rx="3" fill="url(#exe-blue)" stroke="#0a246a" strokeWidth="1" />
                        <rect x="21" y="27" width="22" height="16" fill="#fff" stroke="#5C7EAE" strokeWidth=".6" />
                        <path d="M23.5 30.5 28 35l-4.5 4.5M31 39.5h9" stroke="#0a58d9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        {/* little shine */}
                        <path d="M18 24h10v4H18z" fill="rgba(255,255,255,.35)" />
                      </svg>
                      <div className="name">field-console.exe</div>
                    </div>

                    {/* instructions.txt — opens in notepad */}
                    <div
                      className="file-icon"
                      onDoubleClick={() => setNotepad({ name: "instructions.txt", content: files[0].content })}
                      onClick={(e) => {
                        document.querySelectorAll(".xp-folder .file-icon.selected").forEach((i) => i.classList.remove("selected"));
                        e.currentTarget.classList.add("selected");
                        e.stopPropagation();
                      }}
                      title="open instructions.txt"
                    >
                      <svg viewBox="0 0 64 64" width="48" height="48">
                        <path d="M14 2h26l10 10v46a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z" fill="#fff" stroke="#8C8C8C" strokeWidth="1.2" />
                        <path d="M40 2v10h10z" fill="#D8D8D8" />
                        <path d="M20 26h24M20 33h24M20 40h16" stroke="#4d9fe1" strokeWidth="2.4" strokeLinecap="round" />
                      </svg>
                      <div className="name">instructions.txt</div>
                    </div>

                    {/* hints.txt — opens in notepad */}
                    <div
                      className="file-icon"
                      onDoubleClick={() => setNotepad({ name: "hints.txt", content: files[1].content })}
                      onClick={(e) => {
                        document.querySelectorAll(".xp-folder .file-icon.selected").forEach((i) => i.classList.remove("selected"));
                        e.currentTarget.classList.add("selected");
                        e.stopPropagation();
                      }}
                      title="open hints.txt"
                    >
                      <svg viewBox="0 0 64 64" width="48" height="48">
                        <path d="M14 2h26l10 10v46a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z" fill="#fff" stroke="#8C8C8C" strokeWidth="1.2" />
                        <path d="M40 2v10h10z" fill="#D8D8D8" />
                        <path d="M20 26h24M20 33h24M20 40h16" stroke="#7C4DFF" strokeWidth="2.4" strokeLinecap="round" />
                      </svg>
                      <div className="name">hints.txt</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* status bar */}
              <div className="xp-statusbar">
                <div>{busy ? "running..." : "3 objects"}</div>
                <div className="xp-status-right">{online ? "MACHINE ONLINE" : state.message}</div>
                {online && state.instanceId && (
                  <button className="xp-close-instance" onClick={destroyMachine} disabled={busy}>
                    ✕ close instance
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* the cmd window that opens when the exe runs */}
      {cmdOpen && !cmdMin && !folderClosed && (
        <div className="xp-cmd" ref={cmdRef} style={{ zIndex: 30 }}>
          <div className="xp-cmd-titlebar">
            <span className="xp-cmd-ttl">
              <svg viewBox="0 0 16 16" width="14" height="14">
                <rect x="1" y="3" width="14" height="10" rx="1" fill="#0b0d0a" stroke="#7bc96f" strokeWidth="1" />
                <path d="M3.5 6.5 6 8 3.5 9.5M7.5 9.5h4" stroke="#7bc96f" strokeWidth="1" strokeLinecap="round" fill="none" />
              </svg>
            </span>
            <span className="xp-cmd-title">
              {online && state.sessionId
                ? "field-console [session: " + state.sessionId + "]"
                : "C:\\WINDOWS\\system32\\cmd.exe"}
            </span>
            <div className="win-btns">
              <div className="win-btn min" onClick={() => setCmdMin(true)}>_</div>
              <div className="win-btn max" onClick={() => setCmdMin(false)}>▢</div>
              <div className="win-btn close" onClick={() => { setCmdOpen(false); clearHeartbeat(); }}>✕</div>
            </div>
          </div>

          <div className="xp-cmd-menubar">
            <div className="menu-item">
              <span className="menu-label" onClick={() => setOpenMenu(openMenu === "file" ? null : "file")}>File</span>
              {openMenu === "file" && (
                <div className="menu-dropdown">
                  <button onClick={() => { setCmdOpen(false); clearHeartbeat(); setOpenMenu(null); }}>Exit</button>
                </div>
              )}
            </div>
            <div className="menu-item">
              <span className="menu-label" onClick={() => setOpenMenu(openMenu === "edit" ? null : "edit")}>Edit</span>
              {openMenu === "edit" && (
                <div className="menu-dropdown">
                  <button onClick={() => { setCmdLog([]); setOpenMenu(null); }}>Clear Screen</button>
                  <button onClick={() => setOpenMenu(null)}>Select All</button>
                </div>
              )}
            </div>
            <div className="menu-item">
              <span className="menu-label" onClick={() => setOpenMenu(openMenu === "help" ? null : "help")}>Help</span>
              {openMenu === "help" && (
                <div className="menu-dropdown">
                  <button onClick={() => { pushLog(["  available commands:", "    ssh   — connect to the machine", "    help  — show this help", "    clear — clear the screen", "    exit  — close cmd", ""]); setOpenMenu(null); }}>Commands</button>
                </div>
              )}
            </div>
          </div>

          <div className="xp-cmd-body" ref={cmdBodyRef}>
            {cmdLog.map((line, i) => (
              <div key={i} className="xp-cmd-line">
                {line}
              </div>
            ))}

            {online && state.ip && (
              <div className="xp-cmd-block">
                <div className="xp-cmd-line"><span className="cmd-hl">SESSION ID:</span> {state.sessionId || "—"}</div>
                <div className="xp-cmd-line"><span className="cmd-hl">MACHINE IP:</span> {state.ip}</div>
                <div className="xp-cmd-line"><span className="cmd-hl">USER:</span> {state.username}</div>
                <div className="xp-cmd-line"><span className="cmd-hl">PASSWORD:</span> {state.password}</div>
                <div className="xp-cmd-line">&nbsp;</div>
              </div>
            )}

            {occupied && (
              <div className="xp-cmd-line cmd-err">MACHINE OCCUPIED — another player is inside. try again later.</div>
            )}

            {state.error && (
              <div className="xp-cmd-line cmd-err">! {state.error}</div>
            )}

            {/* interactive prompt line */}
            <div className="xp-cmd-prompt" onClick={() => inputRef.current && inputRef.current.focus()}>
              <span className="xp-cmd-line prompt-sign">C:\World&gt;</span>
              <input
                ref={inputRef}
                className="xp-cmd-input"
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                onKeyDown={onCmdKeyDown}
                disabled={!cmdOpen}
                aria-label="cmd input"
              />
              <span className="cmd-cursor" />
            </div>

            <div className="xp-cmd-actions">
              <button className="cmd-btn" onClick={runExe} disabled={busy || online}>
                {busy ? "WORKING..." : online ? "MACHINE ONLINE" : occupied ? "TRY AGAIN" : "RUN AGAIN"}
              </button>
              <button className="cmd-btn" onClick={() => setHintsVisible(!hintsVisible)} disabled={busy}>
                {hintsVisible ? "HIDE HELP" : "TYPE HELP"}
              </button>
              {state.instanceId && online && (
                <button className="cmd-btn" onClick={destroyMachine} disabled={busy}>
                  TERMINATE
                </button>
              )}
            </div>

            {hintsVisible && (
              <div className="cmd-hints">
                <div className="cmd-hints-title">C:\World&gt; help --hints</div>
                {hints.map((hint, i) => (
                  <div key={i} className="xp-cmd-line"> [{i + 1}] {hint}</div>
                ))}
              </div>
            )}
          </div>

          <div className="xp-cmd-status">
            <span>{online ? "MACHINE ONLINE" : state.message}</span>
            <span className="xp-cmd-status-right">AP-SOUTH-1 / EC2</span>
          </div>

          {/* resize handle */}
          <div className="xp-resize" />
        </div>
      )}

      {/* mini taskbar — restore minimized windows */}
      {(folderMin || cmdMin) && !folderClosed && (
        <div className="xp-taskbar">
          <button
            className={`xp-task-btn ${!folderMin && !folderClosed ? "active" : ""}`}
            onClick={() => setFolderMin(false)}
          >
            📁 Field Console
          </button>
          {cmdOpen && (
            <button
              className={`xp-task-btn ${!cmdMin ? "active" : ""}`}
              onClick={() => setCmdMin(false)}
            >
              ⌨ cmd.exe
            </button>
          )}
        </div>
      )}

      {/* notepad window — opens for instructions.txt / hints.txt */}
      {notepad && (
        <div className="xp-notepad" style={{ zIndex: 40 }}>
          <div className="xp-notepad-titlebar">
            <span className="xp-ttl-icon">
              <svg viewBox="0 0 20 20" width="14" height="14">
                <path d="M14 2h26l10 10v46a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z" transform="scale(.32)" fill="#fff" stroke="#8C8C8C" strokeWidth="1.2" />
              </svg>
            </span>
            <span className="xp-ttl-text">{notepad.name} - Notepad</span>
            <div className="win-btns">
              <div className="win-btn close" onClick={() => setNotepad(null)}>✕</div>
            </div>
          </div>
          <div className="xp-notepad-menu">
            <span>File</span>
            <span>Edit</span>
            <span>Format</span>
            <span>View</span>
            <span>Help</span>
          </div>
          <pre className="xp-notepad-body">{notepad.content}</pre>
          <div className="xp-notepad-status">Text Document &nbsp;|&nbsp; UTF-8</div>
          <div className="xp-resize" />
        </div>
      )}
    </div>
  );
}
