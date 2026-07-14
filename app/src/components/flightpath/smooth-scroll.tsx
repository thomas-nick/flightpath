import { useEffect } from "react";

export function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let killed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lenis: any = null;
    let tickerFn: ((t: number) => void) | null = null;

    void Promise.all([
      import("lenis"),
      import("gsap"),
      import("gsap/ScrollTrigger"),
    ]).then(([lenisMod, gsapMod, stMod]) => {
      if (killed) return;
      const Lenis = lenisMod.default;
      const gsap = gsapMod.default;
      const { ScrollTrigger } = stMod;
      gsap.registerPlugin(ScrollTrigger);

      lenis = new Lenis({
        autoRaf: false,
        smoothWheel: true,
      });
      lenis.on("scroll", ScrollTrigger.update);
      tickerFn = (time: number) => {
        lenis?.raf(time * 1000);
      };
      gsap.ticker.add(tickerFn);
      gsap.ticker.lagSmoothing(0);

      gsap.utils.toArray<HTMLElement>(".fp-section").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 28 },
          {
            y: 0,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              end: "top 55%",
              scrub: 0.6,
            },
          },
        );
      });
    });

    return () => {
      killed = true;
      void import("gsap").then((gsapMod) => {
        if (tickerFn) gsapMod.default.ticker.remove(tickerFn);
      });
      lenis?.destroy?.();
    };
  }, []);

  return null;
}
