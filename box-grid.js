const { Engine, Render, Runner, Bodies, Body, Composite, Constraint, Events } =
  Matter;

let mousePos = null;
let dragCorner = null;
let targetCorner = null;
let firstBox = null;
let secondBox = null;
let boxFigures = [];
let eyeletFigures = [];
let firstEyelet = null;
let SecondEyelet = null;

const W = Math.min(window.innerWidth - 40, 800);
const H = Math.min(window.innerHeight - 120, 560);

const canvas = document.getElementById("canvas");
canvas.width = W;
canvas.height = H;

const engine = Engine.create({ gravity: { y: 1.5 } });

const world = engine.world;

const render = Render.create({
  canvas,
  engine,
  options: { width: W, height: H, wireframes: false, background: "#111" },
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

const HANDLE_D = 20;
const GAP = 10; // px
const EYELET_RADIUS = 6;
const EYELET_PADDING = 10;
const ROWS = 11;
const COLS = 11;
const gridW = W * 0.9;
const gridH = H * 0.9;
const gridBoxes = [];

const EYELET_OFFSETS = {
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

// HANDLE AND DRAGGING

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: src.clientX - r.left,
    y: src.clientY - r.top,
  };
}

function selectBox(pos) {
  return (
    gridBoxes.find((box) => {
      const xs = box.corners.map((c) => c.x);
      const ys = box.corners.map((c) => c.y);
      const minX = Math.min(...xs),
        maxX = Math.max(...xs);
      const minY = Math.min(...ys),
        maxY = Math.max(...ys);

      return (
        pos.x >= minX &&
        pos.x <= maxX &&
        pos.y >= minY &&
        pos.y <= maxY &&
        box.free === true
      );
    }) ?? null
  );
}

function selectEyelet() {
  return (
    eyeletFigures.find((eye) => {
      const xs = eye.corner.map((c) => c.x);
      const ys = eye.corner.map((c) => c.y);
      const minX = Math.min(...xs),
        maxX = Math.max(...xs);
      const minY = Math.min(...ys),
        maxY = Math.max(...ys);

      return (
        pos.x >= minX &&
        pos.x <= maxX &&
        pos.y >= minY &&
        pos.y <= maxY &&
        eye.free === true
      );
    }) ?? null
  );
}

function nearestCorner(pos, box) {
  const closest = box.corners.reduce((nearest, corner) => {
    return Math.hypot(pos.x - corner.x, pos.y - corner.y) <
      Math.hypot(pos.x - nearest.x, pos.y - nearest.y)
      ? corner
      : nearest;
  }, box.corners[0]);

  return Math.hypot(pos.x - closest.x, pos.y - closest.y) < HANDLE_D
    ? closest
    : null;
}

function onDown(e) {
  const pos = canvasPos(e);
  firstBox = selectBox(pos);

  if (firstBox) {
    dragCorner = nearestCorner(pos, firstBox);
    // console.log(dragCorner);
  }

  firstEyelet = selectEyelet();
}

function onUp(e) {
  if (dragCorner && targetCorner && secondBox) {
    createBoxFigure();
  }

  dragCorner = null;
  firstBox = null;
  secondBox = null;
  targetCorner = null;
}

function createBoxFigure() {
  // console.log(secondBox);

  if (dragCorner.i + targetCorner.i !== 5) return;

  const firstBoxCoor = { col: firstBox.col, row: firstBox.row };
  const secondBoxCoor = { col: secondBox.col, row: secondBox.row };

  if (dragCorner.i === 1) {
    if (firstBoxCoor.col > secondBoxCoor.col) return;
    if (firstBoxCoor.row > secondBoxCoor.row) return;
  }

  if (dragCorner.i === 2) {
    if (firstBoxCoor.col < secondBoxCoor.col) return;
    if (firstBoxCoor.row > secondBoxCoor.row) return;
  }

  if (dragCorner.i === 3) {
    if (firstBoxCoor.col > secondBoxCoor.col) return;
    if (firstBoxCoor.row < secondBoxCoor.row) return;
  }

  if (dragCorner.i === 4) {
    if (firstBoxCoor.col < secondBoxCoor.col) return;
    if (firstBoxCoor.row < secondBoxCoor.row) return;
  }

  const minCol = Math.min(firstBoxCoor.col, secondBoxCoor.col);
  const maxCol = Math.max(firstBoxCoor.col, secondBoxCoor.col);
  const minRow = Math.min(firstBoxCoor.row, secondBoxCoor.row);
  const maxRow = Math.max(firstBoxCoor.row, secondBoxCoor.row);

  const unavailableGridBox = gridBoxes.some(
    (box) =>
      box.col >= minCol &&
      box.col <= maxCol &&
      box.row >= minRow &&
      box.row <= maxRow &&
      box.free === false,
  );

  if (unavailableGridBox) return;

  const eyelets = [
    createBoxEyelet(
      gridBoxes
        .find((box) => box.col === minCol && box.row === minRow)
        .corners.find((c) => c.i === 1),
    ),
    createBoxEyelet(
      gridBoxes
        .find((box) => box.col === maxCol && box.row === minRow)
        .corners.find((c) => c.i === 2),
    ),
    createBoxEyelet(
      gridBoxes
        .find((box) => box.col === minCol && box.row === maxRow)
        .corners.find((c) => c.i === 3),
    ),
    createBoxEyelet(
      gridBoxes
        .find((box) => box.col === maxCol && box.row === maxRow)
        .corners.find((c) => c.i === 4),
    ),
  ];

  eyeletFigures.push(...eyelets);
  console.log(eyeletFigures);

  const boxFig = {
    id: boxFigures.length,
    start: { box: firstBox, corner: dragCorner },
    end: { box: secondBox, corner: targetCorner },
    body: null,
    align: "center",
    eyelets,
  };

  gridBoxes.forEach((box) => {
    if (
      box.col >= minCol &&
      box.col <= maxCol &&
      box.row >= minRow &&
      box.row <= maxRow
    ) {
      box.free = false;
    }
  });

  boxFigures.push(boxFig);

  syncBoxFigureBody();
}

function syncBoxFigureBody() {
  if (boxFigures.length === 0) return;

  for (let i = 0; i < boxFigures.length; i++) {
    let currBoxFig = boxFigures[i];

    const x1 = currBoxFig.start.corner.x;
    const y1 = currBoxFig.start.corner.y;
    const x2 = currBoxFig.end.corner.x;
    const y2 = currBoxFig.end.corner.y;

    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);

    if (currBoxFig.body) {
      Body.setPosition(currBoxFig.body, { x: cx, y: cy });
      const [bw, bh] = [
        currBoxFig.body.bounds.max.x - currBoxFig.body.bounds.min.x,
        currBoxFig.body.bounds.max.y - currBoxFig.body.bounds.min.y,
      ];
      if (Math.abs(bw - w) > 1 || Math.abs(bh - h) > 1) {
        Composite.remove(world, currBoxFig.body);
        currBoxFig.body = null;
      }
    }

    if (!currBoxFig.body) {
      currBoxFig.body = Bodies.rectangle(cx, cy, w, h, {
        isStatic: true,
        render: { fillStyle: "#4a90d9", opacity: 0.7 },
      });
      Composite.add(world, currBoxFig.body);
    }
  }

  syncEyelets();
}

function createBoxEyelet(corner) {
  const offset = EYELET_OFFSETS[corner.i];

  const body = Bodies.circle(
    corner.x + offset.x,
    corner.y + offset.y,
    EYELET_RADIUS,
    {
      isStatic: true,
      label: "eyelet",
      render: { fillStyle: "#0048e2", strokeStyle: "#4f00aa", lineWidth: 2 },
      collisionFilter: {
        mask: 0,
      },
    },
  );

  Composite.add(world, body);

  return {
    id: eyeletFigures.length,
    figureId: boxFigures.length,
    corner,
    offset,
    body,
    radius: EYELET_RADIUS,
    free: true,
  };
}

function syncEyelets() {
  for (const eyelet of eyeletFigures) {
    const { corner, offset } = eyelet;

    Body.setPosition(eyelet.body, {
      x: corner.x + offset.x,
      y: corner.y + offset.y,
    });
  }
}

function onMove(e) {
  mousePos = canvasPos(e);

  if (firstBox) {
    nearCorner(mousePos);
  }
}

function nearCorner(pos) {
  if (dragCorner) {
    secondBox = selectBox(pos);

    if (secondBox) {
      targetCorner = nearestCorner(pos, secondBox);
    }
  }
}

function drawCircle(x, y, color) {
  const ctx = render.context;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawDraggingBox(ctx) {
  if (dragCorner) {
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      dragCorner.x,
      dragCorner.y,
      mousePos.x - dragCorner.x,
      mousePos.y - dragCorner.y,
    );
  }
}

canvas.addEventListener("mousedown", onDown);
canvas.addEventListener("mousemove", onMove);
canvas.addEventListener("mouseup", onUp);
canvas.addEventListener("mouseleave", onUp); // treat leaving canvas as releasing
// canvas.addEventListener("touchstart", onDown, { passive: false });
// canvas.addEventListener("touchmove", onMove, { passive: false });
// canvas.addEventListener("touchend", onUp);

Events.on(render, "afterRender", () => {
  const ctx = render.context;

  syncBoxFigureBody();

  drawDraggingBox(ctx);
  if (dragCorner) drawCircle(dragCorner.x, dragCorner.y, "#ff0000");
  if (targetCorner) drawCircle(targetCorner.x, targetCorner.y, "#09f7ff");

  ctx.beginPath();
});
