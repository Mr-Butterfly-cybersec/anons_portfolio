"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const Sketchbook = dynamic(() => import("./Sketchbook"), { ssr: false });
const XpConsole = dynamic(() => import("./XpConsole"), { ssr: false });
const MyRiyanshiExe = dynamic(() => import("./MyRiyanshiExe"), { ssr: false });
const SocialsFolder = dynamic(() => import("./SocialsFolder"), { ssr: false });

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


export default function Home() {
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const [hintsVisible, setHintsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const heartbeatRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hints = [
    "Hint: Check the hidden directory in the VM filesystem",
    "Hint: The flag is encoded in the AMI metadata",
    "Hint: Look for port 1337 on the running instance"
  ];

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

  async function startMachine() {
    setBusy(true);
    setState({
      ...initialState,
      phase: "starting",
      message: "REQUESTING MACHINE"
    });

    try {
      const response = await fetch("/api/vm/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (response.status === 409 && data.occupied) {
        setState({
          ...initialState,
          phase: "occupied",
          message: "MACHINE OCCUPIED",
          instanceId: data.instanceId || "",
          error: ""
        });
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

      if (data.state === "running") {
        startHeartbeat(data.instanceId);
      } else if (data.state !== "running" && data.instanceId) {
        pollInstance(data.instanceId);
      }
    } catch (error) {
      setState({
        ...initialState,
        phase: "error",
        message: "REQUEST FAILED",
        error: error.message
      });
    } finally {
      setBusy(false);
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
      }
    }, 5000);
  }

  async function destroyMachine() {
    if (!state.instanceId) return;

    setBusy(true);

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
    } catch (error) {
      setState((current) => ({
        ...current,
        phase: "error",
        message: "TERMINATION FAILED",
        error: error.message
      }));
    } finally {
      setBusy(false);
    }
  }

  // Cleanup heartbeat on unmount
  useEffect(() => {
    return () => clearHeartbeat();
  }, []);

  return (
    <main className="shell" id="top">
      {/* marquee banner — welcome, with gif at both ends */}
      <div className="banner-marquee">
        <img src="/art/welcome-computer.gif" alt="" className="marquee-gif" />
        <div className="track">
          <span>Hey welcome to my site, here I post my shenanigans and views. BTW I love low-level coding and hacking.</span>
        </div>
        <img src="/art/welcome-computer.gif" alt="" className="marquee-gif" />
      </div>

      {/* gemini banner — full bleed, the one and only */}
      <div className="site-banner">
        <img src="/art/banner.png" alt="RIYANSHI'S WORLD banner" />
        <span className="banner-title">
          <span className="t1">RIYANSHI&apos;S</span>
          <span className="t2">WORLD.</span>
          <span className="t3">&ldquo;One is not born, but rather becomes, woman&rdquo;</span>
        </span>
      </div>


      {/* the XP field console — big, stretched wide */}
      <XpConsole />

      {/* the sketchbook — below the console */}
      {mounted && <Sketchbook />}

      {/* riyanshi info + socials — side by side, profile first */}
      <section className="riyanshi-section" id="links">
        {/* My_Riyanshi.exe — the XP intro card */}
        {mounted && <MyRiyanshiExe />}

        {/* Socials — XP folder of shortcut links */}
        {mounted && <SocialsFolder />}
      </section>
    </main>
  );
}
