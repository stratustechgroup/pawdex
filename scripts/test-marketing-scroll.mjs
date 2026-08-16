/**
 * Scroll-system verification for the marketing surface.
 *
 * The failure mode this exists for is not a build error. It is a pinned scene
 * that never releases, trapping the visitor mid-page with no way out but the
 * back button. That does not show up in tsc, in a lint, or in a screenshot. It
 * shows up in production, to a real person, once.
 *
 * So this asserts the three structural invariants that make a sticky scene
 * releasable, on every marketing page, in both motion states:
 *
 *   1. the scene is meaningfully taller than its sticky stage
 *   2. no ancestor of the stage clips overflow (the single most common cause of
 *      "position: sticky silently does nothing")
 *   3. the stage actually computes to position: sticky when motion is allowed,
 *      and does NOT when the visitor has asked for reduced motion
 *
 * Connects to an already-running headless Chrome. Use scripts/run-marketing-scroll.sh,
 * which boots the server and the browser for you.
 *
 * Env:
 *   SCROLL_ORIGIN     origin to test against (default http://localhost:3210)
 *   CDP_PORT          Chrome remote debugging port (default 9445)
 *   EXPECTED_SCENES   minimum total .mk-scene count across all pages (default 0)
 */

const PORT = Number(process.env.CDP_PORT ?? 9445);
const ORIGIN = process.env.SCROLL_ORIGIN ?? "http://localhost:3210";
const EXPECTED_SCENES = Number(process.env.EXPECTED_SCENES ?? 0);
const PAGES = ["/", "/architecture", "/about", "/pricing"];

// ── harness ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];
function check(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.error("FAIL: " + msg);
  }
}

// ── CDP plumbing (same shape as scripts/test-cockpit-cdp.mjs) ────────
async function getPageTarget() {
  const res = await fetch(`http://localhost:${PORT}/json`);
  const targets = await res.json();
  let page = targets.find((t) => t.type === "page");
  if (!page) {
    const nt = await fetch(`http://localhost:${PORT}/json/new`);
    page = await nt.json();
  }
  return page.webSocketDebuggerUrl;
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout ${method}`));
        }
      }, 30000);
    });
  }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", (e) =>
      reject(new Error("ws error " + (e.message ?? ""))),
    );
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── the probe, evaluated in the page ─────────────────────────────────
const SCENE_PROBE = `(() => {
  const out = [];
  for (const scene of document.querySelectorAll('.mk-scene')) {
    const stage = scene.querySelector('.mk-scene-stage');
    if (!stage) {
      out.push({ id: scene.id || '(unnamed)', error: 'no .mk-scene-stage child' });
      continue;
    }
    // Walk up from the stage looking for a clipping ancestor. overflow hidden
    // or clip anywhere above a sticky element silently disables the stickiness.
    let bad = null;
    let n = stage.parentElement;
    while (n && n !== document.documentElement) {
      const ov = getComputedStyle(n);
      if (['hidden', 'clip'].includes(ov.overflowY) || ['hidden', 'clip'].includes(ov.overflow)) {
        bad = (n.className && String(n.className).slice(0, 60)) || n.tagName;
        break;
      }
      n = n.parentElement;
    }
    out.push({
      id: scene.id || '(unnamed)',
      beats: getComputedStyle(scene).getPropertyValue('--mk-beats').trim() || null,
      sceneH: Math.round(scene.getBoundingClientRect().height),
      stageH: Math.round(stage.getBoundingClientRect().height),
      badAncestor: bad,
      position: getComputedStyle(stage).position,
    });
  }
  return JSON.stringify(out);
})()`;

/* A beat that renders but never animates is the quiet failure: the scene pins,
   the visitor scrolls, and nothing happens. getAnimations() is the only honest
   way to know the timeline actually attached and the calc()-derived range
   resolved to a real, non-empty slice. */
const BEAT_PROBE = `(() => {
  const out = [];
  for (const beat of document.querySelectorAll('.mk-beat')) {
    const anims = beat.getAnimations();
    const a = anims[0];
    out.push({
      scene: beat.closest('.mk-scene')?.id || '(none)',
      index: getComputedStyle(beat).getPropertyValue('--mk-beat-index').trim(),
      count: anims.length,
      hasTimeline: !!(a && a.timeline),
      rangeStart: a && a.rangeStart ? String(a.rangeStart.rangeName ?? '') + ' ' +
        (a.rangeStart.offset ? a.rangeStart.offset.toString() : '') : null,
      rangeEnd: a && a.rangeEnd ? String(a.rangeEnd.rangeName ?? '') + ' ' +
        (a.rangeEnd.offset ? a.rangeEnd.offset.toString() : '') : null,
    });
  }
  return JSON.stringify(out);
})()`;

/* The rail is navigation as well as decoration, so it has to be correct in
   both motion states: filling with progress when motion is allowed, and shown
   as a static position marker (not an empty track) when it is not. */
const RAIL_PROBE = `(() => {
  const rail = document.querySelector('.mk-rail');
  if (!rail) return JSON.stringify(null);
  const fill = rail.querySelector('.mk-rail-fill');
  const anims = fill ? fill.getAnimations() : [];
  return JSON.stringify({
    display: getComputedStyle(rail).display,
    links: rail.querySelectorAll('.mk-rail-tick').length,
    fillAnims: anims.length,
    fillHasTimeline: !!(anims[0] && anims[0].timeline),
    fillTransform: fill ? getComputedStyle(fill).transform : null,
  });
})()`;

/* A tall, narrow H1 means the copy column got crushed by a layout mistake.
   That is invisible to tsc, invisible to a build, and obvious to a visitor. */
const HEADLINE_PROBE = `(() => {
  const h1 = document.querySelector('h1');
  if (!h1) return JSON.stringify(null);
  const r = h1.getBoundingClientRect();
  return JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height) });
})()`;

/* Diagram groups start at opacity 0 and are raised by a view() animation. If
   that animation ever fails to attach, the diagrams are simply invisible and
   nothing else on the page would tell you. Under reduced motion the base
   opacity rule must not apply at all, so every group must read as fully
   opaque. This is the assertion that catches "the fallback silently hides the
   content", which is the worst outcome of the whole design. */
const DIAGRAM_PROBE = `(() => {
  const groups = [...document.querySelectorAll('.arch-frame svg > g')];
  return JSON.stringify({
    total: groups.length,
    transparent: groups.filter((g) => Number(getComputedStyle(g).opacity) < 0.99).length,
  });
})()`;

/* A fourteen-sheet decorative field behind the headline is exactly the kind of
   thing that quietly steals the largest paint. The fix (content-visibility,
   fewer sheets) is only obvious if something tells you it happened. */
const LCP_PROBE = `new Promise((resolve) => {
  // LCP is not exposed through getEntriesByType; a buffered PerformanceObserver
  // is the only way to read it back after the fact.
  let last = null;
  try {
    new PerformanceObserver((list) => {
      const e = list.getEntries();
      if (e.length) last = e[e.length - 1];
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (err) {
    resolve(JSON.stringify(null));
    return;
  }
  setTimeout(() => resolve(JSON.stringify(last ? {
    startTime: Math.round(last.startTime),
    tag: last.element ? last.element.tagName : null,
    cls: last.element ? String(last.element.className || '').slice(0, 40) : null,
  } : null)), 1500);
})`;

/* Restructuring a page is how in-page anchors die: a section gets absorbed into
   a scene, its id goes with it, and the header link that pointed at it silently
   becomes a no-op. Nothing catches that except checking.

   The header and footer deliberately use home-first hrefs ("/#id") so they work
   from any marketing route, so those only have to resolve ON the home page.
   Bare "#id" links are same-page anywhere and must always resolve. */
const ANCHOR_PROBE = `(() => {
  const bad = [];
  const onHome = location.pathname === '/';
  for (const a of document.querySelectorAll('a[href*="#"]')) {
    const href = a.getAttribute('href') || '';
    let hash = null;
    if (href.startsWith('#')) hash = href.slice(1);
    else if (href.startsWith('/#') && onHome) hash = href.slice(2);
    if (!hash) continue;
    if (!document.getElementById(hash)) {
      bad.push({ href, text: (a.textContent || '').trim().slice(0, 30) });
    }
  }
  return JSON.stringify(bad);
})()`;

async function evalJson(cdp, expr) {
  const r = await cdp.send("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error("page eval threw: " + JSON.stringify(r.exceptionDetails));
  }
  return JSON.parse(r.result.value);
}

async function loadAndProbe(cdp, url) {
  await cdp.send("Page.navigate", { url });
  // Page.loadEventFired is not exposed through this minimal client, so poll
  // readyState instead. Cheap and deterministic.
  for (let i = 0; i < 60; i++) {
    const r = await cdp.send("Runtime.evaluate", {
      expression: "document.readyState",
      returnByValue: true,
    });
    if (r.result.value === "complete") break;
    await sleep(250);
  }
  // Give scroll-driven animation attachment a frame or two to settle.
  await sleep(400);
  return {
    scenes: await evalJson(cdp, SCENE_PROBE),
    beats: await evalJson(cdp, BEAT_PROBE),
    rail: await evalJson(cdp, RAIL_PROBE),
    diagrams: await evalJson(cdp, DIAGRAM_PROBE),
    lcp: await evalJson(cdp, LCP_PROBE),
    headline: await evalJson(cdp, HEADLINE_PROBE),
    anchors: await evalJson(cdp, ANCHOR_PROBE),
  };
}

async function main() {
  const wsUrl = await getPageTarget();
  const ws = await connect(wsUrl);
  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // ── pass 1: motion allowed ────────────────────────────────────────
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });

  let total = 0;
  for (const path of PAGES) {
    const { scenes, beats, rail, lcp, headline, anchors } = await loadAndProbe(
      cdp,
      ORIGIN + path,
    );
    total += scenes.length;

    check(
      anchors.length === 0,
      `${path}: ${anchors.length} same-page anchor(s) point at ids that do not exist: ${anchors
        .map((a) => `${a.href} ("${a.text}")`)
        .join(", ")}`,
    );

    if (headline) {
      check(
        headline.w >= 400 && headline.w > headline.h,
        `${path}: headline is ${headline.w}x${headline.h}px, which means the copy column was crushed`,
      );
    }

    if (path === "/" && lcp) {
      console.log(`          LCP ${lcp.startTime}ms on <${lcp.tag}> ${lcp.cls}`);
      // The bar is not "the H1 must win": a ticker or a card can legitimately
      // be the largest paint. The bar is that DECORATION must never win, and
      // that the headline must not have been crushed into a narrow ribbon by a
      // layout mistake, which is what a tall, narrow H1 means.
      check(
        !String(lcp.cls).includes("mk-paper"),
        `home LCP element is a decorative paper sheet (${lcp.cls}); the paper field has stolen the largest paint`,
      );
    }

    if (rail) {
      check(
        rail.display === "block",
        `${path}: rail must be visible at 1440px, display is "${rail.display}"`,
      );
      check(rail.links > 0, `${path}: rail rendered with no chapter ticks`);
      check(
        rail.fillAnims > 0 && rail.fillHasTimeline,
        `${path}: rail fill is not attached to a scroll timeline, progress will never move`,
      );
    }

    console.log(
      `motion    ${path}: ${scenes.length} scene(s), ${beats.length} beat(s)`,
    );

    for (const b of beats) {
      check(
        b.count > 0,
        `${path} ${b.scene} beat ${b.index}: no animation attached, the beat will never play`,
      );
      check(
        b.hasTimeline,
        `${path} ${b.scene} beat ${b.index}: animation has no timeline, the named view-timeline did not resolve`,
      );
      check(
        b.rangeStart !== b.rangeEnd,
        `${path} ${b.scene} beat ${b.index}: range start and end are identical (${b.rangeStart}), the calc() slice collapsed to zero width`,
      );
    }

    for (const s of scenes) {
      check(!s.error, `${path} ${s.id}: ${s.error ?? ""}`);
      if (s.error) continue;
      check(
        s.sceneH > s.stageH * 1.5,
        `${path} ${s.id}: scene (${s.sceneH}px) must be meaningfully taller than its stage (${s.stageH}px), or it never releases`,
      );
      check(
        s.badAncestor === null,
        `${path} ${s.id}: clipping ancestor "${s.badAncestor}" above the sticky stage disables stickiness`,
      );
      check(
        s.position === "sticky",
        `${path} ${s.id}: stage computed position is "${s.position}", expected sticky`,
      );
    }
  }

  check(
    total >= EXPECTED_SCENES,
    `expected at least ${EXPECTED_SCENES} scene(s) across all pages, found ${total}`,
  );

  // ── pass 2: reduced motion ────────────────────────────────────────
  // Everything must collapse. Not slower, not shorter. Gone.
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });

  for (const path of PAGES) {
    const { scenes, beats, rail, diagrams } = await loadAndProbe(
      cdp,
      ORIGIN + path,
    );
    console.log(
      `reduced   ${path}: ${scenes.length} scene(s), ${beats.length} beat(s), ${diagrams.total} diagram group(s)`,
    );
    check(
      diagrams.transparent === 0,
      `${path}: under reduced motion ${diagrams.transparent} of ${diagrams.total} diagram groups are transparent, the fallback is hiding content`,
    );
    if (rail) {
      check(
        rail.fillAnims === 0,
        `${path}: under reduced motion the rail fill must not animate, found ${rail.fillAnims}`,
      );
      // scaleY(1) serialises as matrix(1, 0, 0, 1, 0, 0). An empty track
      // (scaleY(0)) would serialise with a 0 in the fourth slot.
      check(
        rail.fillTransform === "matrix(1, 0, 0, 1, 0, 0)" ||
          rail.fillTransform === "none",
        `${path}: under reduced motion the rail must show as filled, transform is "${rail.fillTransform}"`,
      );
    }
    for (const b of beats) {
      check(
        b.count === 0,
        `${path} ${b.scene} beat ${b.index}: under reduced motion a beat must have no animation at all, found ${b.count}`,
      );
    }
    for (const s of scenes) {
      if (s.error) continue;
      check(
        s.position !== "sticky",
        `${path} ${s.id}: under reduced motion the stage must not be sticky, got "${s.position}"`,
      );
      check(
        s.sceneH < s.stageH * 1.5,
        `${path} ${s.id}: under reduced motion the scene must collapse to its content height (scene ${s.sceneH}px vs stage ${s.stageH}px)`,
      );
    }
  }

  ws.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.error("\nfailures:\n" + failures.map((f) => "  - " + f).join("\n"));
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
