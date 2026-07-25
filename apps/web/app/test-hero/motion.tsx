"use client";

/**
 * Animation primitives for /test-hero only.
 *
 * Everything here is page-local by design: the landing page's motion language
 * (scroll reveals, count-ups, a scroll-progress rail) is not shared with the
 * rest of the site, so it lives beside the page rather than in components/.
 * The CSS these toggle lives in ./test-hero.css.
 *
 * All of it degrades to "just render the content": if IntersectionObserver
 * never fires, `useReveal` still marks the node shown on mount, and the
 * count-ups snap to their final value under `prefers-reduced-motion`.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/** True when the visitor asked for reduced motion (re-evaluated on change). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Fires once when the element first scrolls into view. Returns the ref to
 * attach and whether it has been seen. `rootMargin` pulls the trigger up so
 * content is already settled by the time it reaches comfortable reading height.
 */
export function useInView<T extends HTMLElement>(options?: {
  rootMargin?: string;
  threshold?: number;
  once?: boolean;
}): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const { rootMargin = "0px 0px -12% 0px", threshold = 0.15, once = true } = options ?? {};

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // No IO (very old browser / SSR-hydration edge): show immediately.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin, threshold },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [rootMargin, threshold, once]);

  return [ref, inView];
}

/** Wrapper that fades + lifts its children in the first time they're seen. */
export function Reveal({
  children,
  delay = 0,
  className = "",
  id,
}: {
  children: ReactNode;
  /** Stagger, in ms. */
  delay?: number;
  className?: string;
  id?: string;
}) {
  const [ref, shown] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      id={id}
      className={`th-reveal ${className}`}
      data-shown={shown}
      style={{ "--th-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Eased count-up. Starts when the number scrolls into view so the motion is
 * seen rather than finished off-screen; `format` renders the running value.
 */
export function CountUp({
  to,
  duration = 1600,
  format = (n) => Math.round(n).toLocaleString(),
}: {
  to: number;
  duration?: number;
  format?: (value: number) => string;
}) {
  const [ref, shown] = useInView<HTMLSpanElement>({ threshold: 0.4 });
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!shown) return;
    if (reduced) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutExpo — fast out of the gate, long settle on the final digits.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, to, duration, reduced]);

  return (
    <span ref={ref} suppressHydrationWarning>
      {format(shown ? value : 0)}
    </span>
  );
}

/**
 * Scroll-driven progress hairline + "which section am I in" state, used by the
 * fixed top bar. Returns 0–1 progress, the stuck flag, and the active anchor.
 */
export function useScrollSpy(sectionIds: readonly string[]): {
  progress: number;
  stuck: boolean;
  active: string | null;
} {
  const [progress, setProgress] = useState(0);
  const [stuck, setStuck] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  const measure = useCallback(() => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const y = window.scrollY;
    setProgress(max > 0 ? Math.min(1, Math.max(0, y / max)) : 0);
    setStuck(y > 40);

    // Active = the last section whose top has passed a third of the viewport.
    let current: string | null = null;
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.34) current = id;
    }
    setActive(current);
  }, [sectionIds]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [measure]);

  return { progress, stuck, active };
}

/**
 * Autoplays a `<video>` only while it is on screen and pauses it otherwise.
 * The reel puts eight H.264 clips on one page; without this every one of them
 * decodes continuously and the tab burns a core for no visible benefit.
 */
export function useVideoInView(): React.RefObject<HTMLVideoElement | null> {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          // play() rejects when autoplay is blocked — the poster frame stays,
          // which is an acceptable resting state.
          void el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}
