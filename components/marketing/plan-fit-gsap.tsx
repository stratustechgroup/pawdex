"use client";

import { useEffect } from "react";

// The GSAP enhancement layer for the fit finder, and the only JavaScript
// animation anywhere on this site.
//
// It exists for one reason that CSS genuinely cannot do: a CSS transition
// RESTARTS from its start value when the target changes mid-flight, so dragging
// a slider quickly makes the cards stutter as each new recommendation
// interrupts the last. A GSAP tween with overwrite: "auto" retargets from
// wherever the card currently is. That is the whole justification for the
// dependency, and it is why this file only ever touches transform and opacity.
//
// This module is dynamically imported and never server rendered. Before it
// loads, and if it never loads, the fit finder is complete: three cards, a
// working recommendation, native range inputs, and a CSS scroll-snap carousel
// on small screens. Everything here is strictly additive.

const MOBILE = "(max-width: 900px)";

export default function PlanFitGsap() {
  useEffect(() => {
    let killed = false;
    // Cleanup handles collected as we go, so an unmount mid-import is safe.
    let cleanup: Array<() => void> = [];

    (async () => {
      const [{ gsap }, { Draggable }, { InertiaPlugin }] = await Promise.all([
        import("gsap"),
        import("gsap/Draggable"),
        import("gsap/InertiaPlugin"),
      ]);
      if (killed) return;

      gsap.registerPlugin(Draggable, InertiaPlugin);

      const root = document.querySelector<HTMLElement>(".pf");
      if (!root) return;

      // Hand over from CSS. The class turns off the CSS transitions on the
      // cards so the two systems never animate the same property at once.
      root.classList.add("pf--gsap");
      cleanup.push(() => root.classList.remove("pf--gsap"));

      const cards = gsap.utils.toArray<HTMLElement>(".pf-card", root);

      const applyFit = () => {
        for (const card of cards) {
          const fits = card.dataset.fit === "true";
          gsap.to(card, {
            // overwrite: "auto" is the entire point. Mid-drag the target
            // changes on every slider step; this retargets from the card's
            // current value instead of snapping back and starting again.
            overwrite: "auto",
            duration: 0.42,
            ease: "power3.out",
            y: fits ? -8 : 0,
            scale: fits ? 1.02 : 0.985,
            // Never opacity. Fading the unrecommended cards drops their text
            // below the contrast floor; scale carries the de-emphasis instead.
            opacity: 1,
          });
        }
      };

      // React rewrites data-fit as the sliders move; watching the attribute
      // keeps this layer completely decoupled from React's state.
      const mo = new MutationObserver(applyFit);
      for (const card of cards) {
        mo.observe(card, { attributes: true, attributeFilter: ["data-fit"] });
      }
      cleanup.push(() => mo.disconnect());
      applyFit();

      // ── Mobile carousel ────────────────────────────────────────────
      // Below 900px the three cards cannot coexist. CSS already provides a
      // scroll-snap carousel; this upgrades it to a real throw with inertia and
      // snapping. Set up and torn down with the media query so a resize past
      // the breakpoint does not leave a dead draggable behind.
      const mql = window.matchMedia(MOBILE);
      let drag: ReturnType<typeof Draggable.create> | null = null;

      const teardownDrag = () => {
        drag?.forEach((d) => d.kill());
        drag = null;
        root.classList.remove("pf--drag");
        gsap.set(".pf-track", { clearProps: "x" });
      };

      const setupDrag = () => {
        teardownDrag();
        if (!mql.matches) return;
        const viewport = root.querySelector<HTMLElement>(".pf-viewport");
        const track = root.querySelector<HTMLElement>(".pf-track");
        if (!viewport || !track || cards.length === 0) return;

        root.classList.add("pf--drag");

        const step = cards[0].getBoundingClientRect().width + 18; // card + gap
        const maxX = Math.min(0, viewport.offsetWidth - track.scrollWidth);

        drag = Draggable.create(track, {
          type: "x",
          inertia: true,
          bounds: { minX: maxX, maxX: 0 },
          edgeResistance: 0.9,
          snap: { x: (value: number) => Math.round(value / step) * step },
        });
      };

      setupDrag();
      mql.addEventListener("change", setupDrag);
      cleanup.push(() => {
        mql.removeEventListener("change", setupDrag);
        teardownDrag();
      });
    })();

    return () => {
      killed = true;
      for (const fn of cleanup) fn();
      cleanup = [];
    };
  }, []);

  return null;
}
