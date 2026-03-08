import { syncBoxFigureBody } from "./box.js";
import { drawDraggingBox, drawCircle } from "./utils.js";
import { initEventListeners } from "./actions.js";
// import {} from "./actions";

const { Engine, Render, Runner, Bodies, Body, Composite, Constraint, Events } =
  Matter;

export let mousePos = null;
export let dragCorner = null;
export let targetCorner = null;
export let firstBox = null;
export let secondBox = null;
export let boxFigures = [];
export let eyeletFigures = [];
export let firstEyelet = null;
let SecondEyelet = null;

export const setMousePos = (val) => {
  mousePos = val;
};
export const setSecondBox = (val) => {
  secondBox = val;
};
export const setTargetCorner = (val) => {
  targetCorner = val;
};

const W = Math.min(window.innerWidth - 40, 800);
const H = Math.min(window.innerHeight - 120, 560);

export const canvas = document.getElementById("canvas");
canvas.width = W;
canvas.height = H;

const engine = Engine.create({ gravity: { y: 1.5 } });

export const world = engine.world;

const render = Render.create({
  canvas,
  engine,
  options: { width: W, height: H, wireframes: false, background: "#111" },
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

export const HANDLE_D = 20;
const GAP = 10; // px
export const EYELET_RADIUS = 6;
const EYELET_PADDING = 10;
const ROWS = 11;
const COLS = 11;
const gridW = W * 0.9;
const gridH = H * 0.9;
export const gridBoxes = [];

export const EYELET_OFFSETS = {
  1: { x: EYELET_PADDING, y: EYELET_PADDING }, // tl
  2: { x: -EYELET_PADDING, y: EYELET_PADDING }, // tr
  3: { x: EYELET_PADDING, y: -EYELET_PADDING }, // bl
  4: { x: -EYELET_PADDING, y: -EYELET_PADDING }, // br
};

const boxW = Math.floor((gridW - GAP * (COLS - 1)) / COLS);
const boxH = Math.floor((gridH - GAP * (ROWS - 1)) / ROWS);

// based on the floored box sizes to match pixels
const actualGridW = boxW * COLS + GAP * (COLS - 1);
const actualGridH = boxH * ROWS + GAP * (ROWS - 1);

const ox = Math.floor((W - gridW) / 2);
const oy = Math.floor((H - gridH) / 2);

for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const x = ox + c * (boxW + GAP);
    const y = oy + r * (boxH + GAP);
    gridBoxes.push({
      x,
      y,
      row: r,
      col: c,
      free: true,
      corners: [
        { x: x, y: y, i: 1 }, // TL
        { x: x + boxW, y: y, i: 2 }, // TR
        { x: x, y: y + boxH, i: 3 }, // BL
        { x: x + boxW, y: y + boxH, i: 4 }, // BR
      ],
    });
  }
}

gridBoxes.forEach((box) => {
  const body = Bodies.rectangle(
    box.x + boxW / 2,
    box.y + boxH / 2,
    boxW,
    boxH,
    {
      isStatic: true,
      render: { fillStyle: "#c4c4c4" },
    },
  );
  box.body = body;
  Composite.add(world, body);
});

export function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: src.clientX - r.left,
    y: src.clientY - r.top,
  };
}

Events.on(render, "afterRender", () => {
  const ctx = render.context;

  syncBoxFigureBody();

  drawDraggingBox(ctx);
  if (dragCorner) drawCircle(dragCorner.x, dragCorner.y, "#ff0000");
  if (targetCorner) drawCircle(targetCorner.x, targetCorner.y, "#09f7ff");

  ctx.beginPath();
});

initEventListeners();
