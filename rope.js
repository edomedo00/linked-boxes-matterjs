// ─────────────────────────────────────────────────────────────────────────
// MATTER.JS MODULE DESTRUCTURING
// Matter.js exposes everything through one global object called `Matter`.
// We destructure the specific modules we need so we can call them directly
// (e.g. Engine.create()) instead of Matter.Engine.create() every time.
// ─────────────────────────────────────────────────────────────────────────
const {
  Engine, // creates and runs the physics simulation (gravity, forces, collisions)
  Render, // draws bodies onto a <canvas> element each frame
  Runner, // drives the engine's update loop using requestAnimationFrame
  Bodies, // factory for creating common shapes (circle, rectangle, etc.)
  Body, // utilities for manipulating individual bodies (setPosition, setVelocity...)
  Composite, // a container that holds bodies and constraints; the "world" is one
  Constraint, // a spring/rod connection between two bodies
  Events, // lets us hook into the engine/render lifecycle (beforeUpdate, afterRender...)
} = Matter;

// ─────────────────────────────────────────────────────────────────────────
// CANVAS SIZING
// We cap the canvas at 800×560 so it never overflows small screens,
// but subtract some pixels to leave room for the heading and hint text.
// ─────────────────────────────────────────────────────────────────────────
const W = Math.min(window.innerWidth - 40, 800); // max 800px wide
const H = Math.min(window.innerHeight - 120, 560); // max 560px tall

// Grab the <canvas> element and set its pixel dimensions explicitly.
// Without this the canvas defaults to 300×150 and everything looks stretched.
const canvas = document.getElementById("canvas");
canvas.width = W;
canvas.height = H;

// ─────────────────────────────────────────────────────────────────────────
// PHYSICS ENGINE
// The engine is the core of Matter.js — it holds the world and advances
// physics each tick (calculates forces, resolves collisions, moves bodies).
// gravity.y: 1.5 means 1.5× Earth-like downward acceleration.
// ─────────────────────────────────────────────────────────────────────────
const engine = Engine.create({ gravity: { y: 1.5 } });

// `engine.world` is the root Composite — all bodies and constraints must
// be added to this (or to a child composite inside it) to exist in the sim.
const world = engine.world;

// ─────────────────────────────────────────────────────────────────────────
// RENDERER
// Render.create() sets up a drawing loop that paints all bodies in `world`
// onto our canvas after each engine update.
// wireframes:false  → draw solid filled shapes instead of outlines
// background:'#111' → fill the canvas with this color each frame
// ─────────────────────────────────────────────────────────────────────────
const render = Render.create({
  canvas,
  engine,
  options: { width: W, height: H, wireframes: false, background: "#111" },
});

// ─────────────────────────────────────────────────────────────────────────
// ROPE CONSTANTS
// The rope is modelled as a chain of small circular "link" bodies connected
// by Constraints. Think of it like a pearl necklace — each bead is a body,
// and the string between beads is a constraint.
// ─────────────────────────────────────────────────────────────────────────
const SEGMENTS = 28; // number of link bodies that make up the rope
const SEG_LEN = 13; // resting distance (px) between adjacent link centers
const LINK_R = 3.5; // radius of each link circle (physics body size)
const HANDLE_R = 20; // hit-test radius (px) — how close the mouse must be
// to an endpoint to start dragging it

// ─────────────────────────────────────────────────────────────────────────
// ROPE POSITIONING
// We want the rope to start centered horizontally and sit in the upper third
// of the canvas. We calculate where the first link (ox, oy) should be placed
// so the whole rope is centered.
// ─────────────────────────────────────────────────────────────────────────
const totalWidth = (SEGMENTS - 1) * SEG_LEN; // total span from first to last link
const ox = (W - totalWidth) / 2; // x offset so rope is horizontally centered
const oy = H * 0.28; // y position: 28% down from the top

// ─────────────────────────────────────────────────────────────────────────
// BUILDING THE ROPE LINKS
// We loop SEGMENTS times, creating one circle body per iteration.
// Each link is placed SEG_LEN pixels to the right of the previous one.
// ─────────────────────────────────────────────────────────────────────────
const links = []; // array to keep references to all link bodies in order

for (let i = 0; i < SEGMENTS; i++) {
  const isEnd = i === 0 || i === SEGMENTS - 1; // true only for first and last link

  const link = Bodies.circle(
    ox + i * SEG_LEN, // x: step SEG_LEN px to the right each iteration
    oy, // y: all links start on the same horizontal line
    LINK_R, // radius of the circle
    {
      // isStatic:true means the physics engine will NEVER move this body —
      // no gravity, no forces, no collisions affect it. We use this for the
      // two endpoints so they "float" in place until we move them manually.
      isStatic: isEnd,

      // frictionAir simulates air resistance / drag. 0.05 means the links
      // lose 5% of their velocity per tick — gives the rope a natural damping
      // so it doesn't swing forever.
      frictionAir: 0.05,

      // collisionFilter.mask:0 means this body collides with nothing.
      // Without this, all 28 links would push each other apart and the rope
      // would explode outward instead of hanging naturally.
      collisionFilter: { mask: 0 },

      // We're drawing all visuals ourselves in the afterRender event below,
      // so we tell Matter's renderer to draw each link as transparent.
      render: { fillStyle: "transparent" },
    },
  );

  links.push(link); // store reference so we can access positions later
  Composite.add(world, link); // register the body with the physics world
}

// ─────────────────────────────────────────────────────────────────────────
// CONNECTING LINKS WITH CONSTRAINTS
// A Constraint is like a spring or rod between two bodies. We connect each
// link to the next one, creating a chain. The key properties:
//
//   length:   the resting/natural distance between the two bodies.
//             Set to SEG_LEN so the constraint neither pulls nor pushes
//             when the links are exactly SEG_LEN apart.
//
//   stiffness: how strongly the constraint enforces its length. 1.0 = rigid
//             rod, 0.0 = no force at all. 0.7 gives a slightly stretchy rope.
//
//   damping:  reduces oscillation. Without this the rope would bounce like a
//             rubber band. 0.08 is a small amount that keeps it looking natural.
// ─────────────────────────────────────────────────────────────────────────
for (let i = 0; i < SEGMENTS - 1; i++) {
  // SEGMENTS-1 gaps between SEGMENTS links
  Composite.add(
    world,
    Constraint.create({
      bodyA: links[i], // left/upper link
      bodyB: links[i + 1], // right/lower link (the next one in the chain)
      length: SEG_LEN,
      stiffness: 0.7,
      damping: 0.08,
      render: { visible: false }, // hide the default constraint line; we draw our own
    }),
  );
}

// Convenient named references to the two endpoint links
const endA = links[0]; // left endpoint
const endB = links[SEGMENTS - 1]; // right endpoint

// ─────────────────────────────────────────────────────────────────────────
// DRAG STATE
// `dragging` holds a reference to whichever endpoint the user is currently
// dragging, or null if they're not dragging anything.
// ─────────────────────────────────────────────────────────────────────────
let dragging = null;

// ─────────────────────────────────────────────────────────────────────────
// HELPER: canvasPos(e)
// Converts a mouse or touch event's screen coordinates into canvas-local
// coordinates. This is necessary because the canvas may not start at (0,0)
// on the page — getBoundingClientRect() tells us its exact position.
//
// e.touches exists on touch events; we use the first touch point.
// For mouse events we use e.clientX / e.clientY directly.
// ─────────────────────────────────────────────────────────────────────────
function canvasPos(e) {
  const r = canvas.getBoundingClientRect(); // canvas position in the viewport
  const src = e.touches ? e.touches[0] : e; // touch or mouse event source
  return {
    x: src.clientX - r.left, // subtract canvas's left edge to get local x
    y: src.clientY - r.top, // subtract canvas's top edge to get local y
  };
}

// ─────────────────────────────────────────────────────────────────────────
// HELPER: nearestEndpoint(pos)
// Given a canvas position, checks whether it's close enough to either
// endpoint to count as a "hit". Returns the endpoint body if so, or null.
//
// Math.hypot(dx, dy) is the Euclidean distance √(dx² + dy²).
// If that distance is less than HANDLE_R (20px), the user is close enough.
// ─────────────────────────────────────────────────────────────────────────
function nearestEndpoint(pos) {
  for (const ep of [endA, endB]) {
    const d = Math.hypot(pos.x - ep.position.x, pos.y - ep.position.y);
    if (d < HANDLE_R) return ep; // hit! return this endpoint
  }
  return null; // no endpoint was close enough
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT: onDown (mousedown / touchstart)
// Called when the user presses the mouse button or puts a finger on screen.
// We check if the press landed on an endpoint and, if so, start dragging it.
// e.preventDefault() stops the browser from doing default touch behaviors
// like scrolling the page while the user drags.
// ─────────────────────────────────────────────────────────────────────────
function onDown(e) {
  const pos = canvasPos(e);
  dragging = nearestEndpoint(pos); // null if missed, body reference if hit
  if (dragging) e.preventDefault();
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT: onMove (mousemove / touchmove)
// Called every time the pointer moves. Two responsibilities:
//
// 1. If dragging: teleport the endpoint to the cursor's position each frame.
//    Body.setPosition() instantly moves the body — since it's static, the
//    physics engine won't fight us by applying gravity to it.
//    Body.setVelocity({x:0,y:0}) resets velocity so the body doesn't drift
//    or "throw" the rope when released.
//
// 2. If not dragging: update the cursor icon to 'grab' when hovering over
//    an endpoint, giving the user a visual affordance that it's draggable.
// ─────────────────────────────────────────────────────────────────────────
function onMove(e) {
  const pos = canvasPos(e);
  if (dragging) {
    e.preventDefault();
    Body.setPosition(dragging, pos); // move endpoint to cursor
    Body.setVelocity(dragging, { x: 0, y: 0 }); // zero out any accumulated velocity
    canvas.style.cursor = "grabbing"; // closed fist cursor
  } else {
    // Show 'grab' cursor when hovering over a handle so users know it's interactive
    canvas.style.cursor = nearestEndpoint(pos) ? "grab" : "default";
  }
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT: onUp (mouseup / mouseleave / touchend)
// Called when the user releases the mouse button, lifts their finger, or
// moves the cursor outside the canvas. We clear `dragging` so onMove stops
// teleporting the endpoint, and reset the cursor.
// ─────────────────────────────────────────────────────────────────────────
function onUp() {
  dragging = null; // stop dragging — endpoint stays where it is
  canvas.style.cursor = "default";
}

// Register all event listeners on the canvas element.
// Mouse events for desktop, touch events for mobile.
// { passive: false } on touch events is required so e.preventDefault() works —
// without it, modern browsers ignore it and may scroll the page instead.
canvas.addEventListener("mousedown", onDown);
canvas.addEventListener("mousemove", onMove);
canvas.addEventListener("mouseup", onUp);
canvas.addEventListener("mouseleave", onUp); // treat leaving canvas as releasing
canvas.addEventListener("touchstart", onDown, { passive: false });
canvas.addEventListener("touchmove", onMove, { passive: false });
canvas.addEventListener("touchend", onUp);

// ─────────────────────────────────────────────────────────────────────────
// CUSTOM RENDERING via Events.on(render, 'afterRender', ...)
//
// Matter.js fires 'afterRender' every frame, after it has drawn all the
// bodies. We hook into this to draw our own visuals on top using the raw
// Canvas 2D API (ctx). This gives us full control — smooth bezier rope,
// gradient glows, layered strokes — things Matter's built-in renderer
// can't do on its own.
// ─────────────────────────────────────────────────────────────────────────
Events.on(render, "afterRender", () => {
  // render.context is the CanvasRenderingContext2D — the standard browser
  // drawing API. All ctx.* calls below are plain Canvas 2D, not Matter.js.
  const ctx = render.context;

  // ── ROPE OUTER STROKE ───────────────────────────────────────────────
  // We draw the rope as a smooth quadratic bezier curve that passes through
  // all link positions, rather than a series of straight line segments.
  // This makes it look like a real rope instead of a polygon chain.
  //
  // HOW THE BEZIER TRICK WORKS:
  // For each pair of adjacent links (c and n), we use the midpoint between
  // them as the "landing point" and the link itself as the "control point".
  // This is the classic smooth-curve-through-points technique — each segment
  // curves toward the link position without actually passing through it,
  // creating a smooth arc rather than a sharp corner.
  ctx.beginPath();
  // Start the path at the very first link (left endpoint)
  ctx.moveTo(links[0].position.x, links[0].position.y);

  for (let i = 1; i < links.length - 1; i++) {
    const c = links[i].position; // current link (used as bezier control point)
    const n = links[i + 1].position; // next link
    // Midpoint between current and next link = where the curve "lands"
    ctx.quadraticCurveTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2);
  }
  // Finish with a straight line to the last link so the endpoint is exact
  ctx.lineTo(links[SEGMENTS - 1].position.x, links[SEGMENTS - 1].position.y);

  ctx.strokeStyle = "#7a5530"; // dark brown rope color
  ctx.lineWidth = 6; // thick outer stroke for rope body
  ctx.lineCap = "round"; // rounded ends at the start and finish
  ctx.lineJoin = "round"; // rounded joins between segments
  ctx.stroke(); // actually draw the path

  // ── ROPE INNER HIGHLIGHT ────────────────────────────────────────────
  // We draw the exact same path again but thinner and with a semi-transparent
  // golden color. Layering it on top of the dark stroke creates the illusion
  // of a rounded, lit rope surface — a cheap but effective 3D effect.
  ctx.beginPath();
  ctx.moveTo(links[0].position.x, links[0].position.y);
  for (let i = 1; i < links.length - 1; i++) {
    const c = links[i].position;
    const n = links[i + 1].position;
    ctx.quadraticCurveTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2);
  }
  ctx.lineTo(links[SEGMENTS - 1].position.x, links[SEGMENTS - 1].position.y);
  ctx.strokeStyle = "rgba(220, 170, 90, 0.3)"; // translucent gold — blends with dark rope
  ctx.lineWidth = 2.5; // thinner than the outer stroke
  ctx.stroke();

  // ── ENDPOINT HANDLES ────────────────────────────────────────────────
  // Draw a golden circle handle at each endpoint so users can see where
  // to drag. We loop over both endpoints to avoid duplicating code.
  for (const ep of [endA, endB]) {
    const { x, y } = ep.position; // current physics position of this endpoint

    // GLOW EFFECT: a radial gradient that fades from golden to transparent.
    // createRadialGradient(x1,y1,r1, x2,y2,r2) creates a gradient that
    // starts as a circle of radius r1 at (x1,y1) and fades to radius r2.
    // We fill a large circle with this gradient to create a soft halo.
    const grd = ctx.createRadialGradient(
      x,
      y,
      2, // inner circle: tiny, centered on endpoint
      x,
      y,
      22, // outer circle: 22px radius where color fades to 0 opacity
    );
    grd.addColorStop(0, "rgba(200,169,126,0.35)"); // warm gold at center
    grd.addColorStop(1, "rgba(200,169,126,0)"); // fully transparent at edge
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2); // full circle, radius 22 (covers the glow area)
    ctx.fillStyle = grd;
    ctx.fill();

    // MAIN HANDLE CIRCLE: solid gold filled circle with a lighter stroke
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2); // radius 11 — bigger than the physics body
    ctx.fillStyle = "#c8a97e"; // warm gold fill
    ctx.fill();
    ctx.strokeStyle = "#f0d9aa"; // lighter gold border
    ctx.lineWidth = 2;
    ctx.stroke();

    // CENTER DOT: a small bright dot in the middle of the handle.
    // Acts as a crosshair / visual anchor, making the handle look like a knob.
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff5e0"; // near-white cream color
    ctx.fill();
  }
});

// ─────────────────────────────────────────────────────────────────────────
// START THE SIMULATION
//
// Render.run(render)  → starts the rendering loop (calls requestAnimationFrame
//                       repeatedly, drawing the canvas each frame)
//
// Runner.create()     → creates a Runner object that manages the timing of
//                       engine updates (tries to run at 60fps)
//
// Runner.run(runner, engine) → starts the physics update loop, advancing
//                       the simulation each frame so bodies move, constraints
//                       are resolved, and gravity is applied continuously
// ─────────────────────────────────────────────────────────────────────────
Render.run(render);
Runner.run(Runner.create(), engine);
