"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);
import { Antonio } from "next/font/google";
import styles from "./CountdownFireworks.module.css";

const antonio = Antonio({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-antonio",
});

export default function CountdownFireworks({
  from = 5,
  videoSrc,
  bombText,
  lineWidth = 3,
  growFrom = 0.35,
  growDuration = 20,
  intro = {
    eyebrow: "The 26th Annual General Assembly",
    title: "IAMU AGA26",
    subtitle:
      "Human Centered Digital Ocean: Educating safe & green global maritime professionals",
  },
  logos = [
    { src: "/logos/iamu.png", alt: "IAMU" },
    { src: "/logos/pfst.png", alt: "Faculty of Maritime Studies" },
    { src: "/logos/nippon.png", alt: "The Nippon Foundation" },
  ],
  openText = "IAMU AGA26 - OFFICIALLY OPEN",
  hideAfter,
  showStartButton = false,
  startLabel = "OPEN THE CEREMONY",
}) {
  const rootRef = useRef(null);
  const headlineRef = useRef(null);
  const introRef = useRef(null);
  const countInRef = useRef(null);
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const [ready, setReady] = useState(false); // engine loaded — needed before Start can unlock audio
  const [phase, setPhase] = useState("idle"); // idle | leaving | counting | show
  const [count, setCount] = useState(from);

  // mount / dispose the three.js scene (client only — three touches window)
  useEffect(() => {
    let cancelled = false;
    let handle = null;
    import("@/lib/fireworks/engine").then(({ createFireworks }) => {
      if (cancelled || !mountRef.current) return;
      handle = createFireworks(mountRef.current, {
        bombText,
        lineWidth,
        growFrom,
        growDuration,
      });
      engineRef.current = handle;
      setReady(true);
    });
    return () => {
      cancelled = true;
      handle?.dispose();
      engineRef.current = null;
      setReady(false);
    };
  }, [bombText, growFrom, growDuration]);

  // thickness can change live without rebuilding the scene
  useEffect(() => {
    engineRef.current?.setLineWidth(lineWidth);
  }, [lineWidth]);

  // tick the countdown once a second; fire at zero
  useEffect(() => {
    if (phase !== "counting") return;
    if (count === 0) {
      engineRef.current?.start();
      setPhase("show");
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, count]);

  // explosive headline reveal once the countdown hits zero
  useGSAP(
    () => {
      if (phase !== "show" || !headlineRef.current) return;
      const chars = gsap.utils.toArray(`.${styles.char}`);

      // every letter starts at the headline's centre, collapsed and hidden
      const box = headlineRef.current.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      gsap.set(chars, {
        x: (i, el) => {
          const r = el.getBoundingClientRect();
          return cx - (r.left + r.width / 2);
        },
        y: (i, el) => {
          const r = el.getBoundingClientRect();
          return cy - (r.top + r.height / 2);
        },
        scale: 0,
        opacity: 0,
        rotation: () => gsap.utils.random(-40, 40),
        filter: "blur(10px)",
      });

      const tl = gsap.timeline({ delay: 1.0 });

      // white flash + shockwave ring at the moment of impact
      tl.fromTo(
        `.${styles.flash}`,
        { opacity: 0, scale: 0.3 },
        { opacity: 1, scale: 1, duration: 0.12, ease: "power2.out" },
      )
        .to(`.${styles.flash}`, {
          opacity: 0,
          scale: 1.6,
          duration: 0.9,
          ease: "power2.out",
        })
        .fromTo(
          `.${styles.shock}`,
          { opacity: 0.9, scale: 0 },
          { opacity: 0, scale: 5, duration: 1.1, ease: "expo.out" },
          0,
        );

      // letters explode outward from the centre: 0 → 1.3, then settle to 1
      tl.to(
        chars,
        {
          keyframes: [
            {
              x: 0,
              y: 0,
              scale: 1.3,
              opacity: 1,
              rotation: 0,
              filter: "blur(0px)",
              duration: 0.45,
              ease: "power4.out",
            },
            { scale: 1, duration: 0.8, ease: "elastic.out(1.1, 0.4)" },
          ],
          stagger: { each: 0.012, from: "center" },
        },
        0,
      );

      // shake the screen on impact (slight zoom so the edges never show)
      tl.fromTo(
        rootRef.current,
        { x: 0, y: 0 },
        {
          keyframes: {
            x: [-14, 12, -9, 7, -4, 2, 0],
            y: [8, -10, 6, -5, 3, -1, 0],
            scale: [1.04, 1.035, 1.03, 1.02, 1.01, 1.005, 1],
          },
          duration: 0.5,
          ease: "none",
        },
        0.05,
      );

      tl.addLabel("settled");

      // afterglow: slow breathing glow once settled
      let glow;
      tl.call(
        () => {
          glow = gsap.to(headlineRef.current, {
            textShadow:
              "0 0 40px rgba(255,255,255,0.95), 0 0 90px rgba(255,220,150,0.6), 0 4px 40px rgba(0,0,0,0.6)",
            duration: 1.4,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          });
        },
        null,
        "settled",
      );

      // optional exit: letters shrink back toward the centre and fade out
      if (hideAfter != null) {
        tl.call(() => glow?.kill(), null, `settled+=${hideAfter}`).to(
          chars,
          {
            x: (i, el) => {
              const r = el.getBoundingClientRect();
              return (cx - (r.left + r.width / 2)) * 0.35;
            },
            y: (i, el) => {
              const r = el.getBoundingClientRect();
              return (cy - (r.top + r.height / 2)) * 0.35;
            },
            scale: 0,
            opacity: 0,
            filter: "blur(10px)",
            duration: 0.6,
            ease: "power3.in",
            stagger: { each: 0.012, from: "edges" },
          },
          `settled+=${hideAfter}`,
        );
      }
    },
    { scope: rootRef, dependencies: [phase, hideAfter] },
  );

  // starts from a click anywhere (or the optional button). The click is also
  // what lets the browser play sound, so it waits until the engine is loaded.
  const begin = () => {
    if (phase !== "idle" || !ready) return;
    engineRef.current?.enableAudio();
    setCount(from);
    setPhase(intro ? "leaving" : "counting");
  };

  // intro text and logos animate out, then the countdown starts
  useGSAP(
    () => {
      if (phase !== "leaving" || !introRef.current) return;
      const items = [...introRef.current.children];
      // hand the items over from their CSS entrance animation to GSAP
      items.forEach((el) => {
        el.style.animation = "none";
        el.style.opacity = "1";
      });
      gsap
        .timeline({ onComplete: () => setPhase("counting") })
        .to(items, {
          y: -40,
          opacity: 0,
          scale: 0.94,
          filter: "blur(10px)",
          duration: 0.55,
          ease: "power2.in",
          stagger: 0.08,
        })
        .to(
          introRef.current,
          { opacity: 0, duration: 0.3, ease: "power1.out" },
          "-=0.25",
        );
    },
    { scope: rootRef, dependencies: [phase] },
  );

  // countdown animates in: grows out of the centre and comes into focus
  useGSAP(
    () => {
      if (phase !== "counting" || !countInRef.current) return;
      gsap.from(countInRef.current, {
        scale: 0.4,
        opacity: 0,
        filter: "blur(14px)",
        duration: 0.7,
        ease: "back.out(1.7)",
      });
    },
    { scope: rootRef, dependencies: [phase] },
  );

  // any key also starts it (the key press unlocks audio just like a click)
  useEffect(() => {
    if (phase !== "idle" || !ready) return;
    const onKey = (e) => {
      if (e.repeat) return;
      begin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${phase === "idle" ? styles.idle : ""}`}
      onClick={begin}
    >
      {videoSrc && (
        <video
          className={styles.video}
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      )}

      {/* with a video, the black canvas is screen-blended so only the light shows */}
      <div
        ref={mountRef}
        className={`${styles.canvas} ${videoSrc ? styles.screen : ""}`}
      />

      {intro && (phase === "idle" || phase === "leaving") && (
        <div ref={introRef} className={styles.intro}>
          {intro.eyebrow && <p className={styles.eyebrow}>{intro.eyebrow}</p>}
          {intro.title && (
            <h1 className={`${styles.introTitle} ${antonio.variable}`}>
              {intro.title}
            </h1>
          )}
          {intro.subtitle && (
            <p className={styles.subtitle}>{intro.subtitle}</p>
          )}
          {logos?.length > 0 && (
            <div className={styles.logos}>
              {logos.map((logo) => (
                <img
                  key={logo.src}
                  src={logo.src}
                  alt={logo.alt}
                  className={styles.logo}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showStartButton && phase === "idle" && ready && (
        <button className={styles.start} onClick={begin}>
          {startLabel}
        </button>
      )}

      {(phase === "counting" || phase === "show") && (
        <div
          className={`${styles.overlay} ${phase === "show" ? styles.out : ""}`}
        >
          <div ref={countInRef} className={styles.countIn}>
            <svg className={styles.ring} viewBox="0 0 200 200" aria-hidden>
              <circle cx="100" cy="100" r="92" className={styles.track} />
              <circle
                cx="100"
                cy="100"
                r="92"
                className={styles.progress}
                style={{ animationDuration: `${from}s` }}
              />
            </svg>
            <span
              key={count}
              className={`${styles.num} ${count === 0 ? styles.zero : ""}`}
            >
              {count}
            </span>
          </div>
        </div>
      )}

      {phase === "show" && (
        <div className={styles.reveal}>
          <div className={styles.flash} />
          <div className={styles.shock} />
          <h1
            ref={headlineRef}
            className={styles.headline}
            aria-label={openText}
          >
            {openText.split(" ").map((word, w) => (
              <span key={w} className={styles.word} aria-hidden>
                {[...word].map((ch, c) => (
                  <span key={c} className={styles.char}>
                    {ch}
                  </span>
                ))}
              </span>
            ))}
          </h1>
        </div>
      )}
    </div>
  );
}
