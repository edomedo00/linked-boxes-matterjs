const { Engine, Render, Runner, Bodies, Body, Composite, Constraint, Events } =
  Matter;

let mousePos = null;
let dragCorner = null;
let targetCorner = null;
let gridBoxes = [];
let firstBox = null;
let secondBox = null;
let boxFigures = [];
let eyeletFigures = [];
let firstEyelet = null;
let secondEyelet = null;
let ropeFigures = [];
let tempRope = null;

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
  options: { width: W, height: H, wireframes: false, background: "#E6E6E6" },
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

const HANDLE_D = 20;
const HANDLE_EYELET = 10;
const GAP = 10; // px
const EYELET_RADIUS = 6;
const EYELET_PADDING = 10;
const ROWS = 11;
const COLS = 11;
const gridW = W * 0.9;
const gridH = H * 0.9;

// ROPE
const SEGMENTS = 28;
const SEG_LEN = 13;
const LINK_R = 3.5;
const SLACK = 1.3;

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

////////////////////
let links = [];

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
      render: { fillStyle: "#b8babc33" },
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
      return (
        Math.hypot(
          mousePos.x - eye.body.position.x,
          mousePos.y - eye.body.position.y,
        ) <
        EYELET_RADIUS + HANDLE_EYELET
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
  if (firstEyelet) {
    createRopeFigure();
  }
}

function onUp(e) {
  if (dragCorner && targetCorner && secondBox) {
    createBoxFigure();
  }

  if (tempRope) {
    if (secondEyelet) {
      Body.setPosition(tempRope.links[SEGMENTS - 1], {
        x: secondEyelet.body.position.x,
        y: secondEyelet.body.position.y,
      });
      tempRope.endEyelet = secondEyelet;
      ropeFigures.push(tempRope);
      console.log(ropeFigures);
    } else {
      tempRope.links.forEach((link) => Composite.remove(world, link));
    }
  }

  tempRope = null;
  firstBox = null;
  secondBox = null;
  dragCorner = null;
  targetCorner = null;
  firstEyelet = null;
  secondEyelet = null;
  tempRope = null;
}

function onMove(e) {
  mousePos = canvasPos(e);

  if (firstBox) {
    nearCorner(mousePos);
  }

  if (firstEyelet) {
    secondEyelet = selectEyelet();
  }

  if (tempRope && tempRope.links.length > 0) {
    Body.setPosition(tempRope.links[SEGMENTS - 1], {
      x: mousePos.x,
      y: mousePos.y,
    });
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

function createRopeFigure() {
  tempRope = {
    startEyelet: firstEyelet,
    endEyelet: null,
    links: [],
    constraints: [],
  };

  const start = firstEyelet.body.position;

  const dist = Math.hypot(mousePos.x - start.x, mousePos.y - start.y);

  const totalLength = Math.max(dist * 10, SEGMENTS * 1);
  const segLen = totalLength / SEGMENTS;

  for (let i = 0; i < SEGMENTS; i++) {
    const isEnd = i === 0 || i === SEGMENTS - 1;

    const link = Bodies.circle(start.x, start.y, LINK_R, {
      isStatic: isEnd,
      frictionAir: 0.05,
      collisionFilter: { mask: 0 },
      render: { fillStyle: "transparent" },
    });

    tempRope.links.push(link);
    Composite.add(world, link);
  }

  for (let i = 0; i < SEGMENTS - 1; i++) {
    const constraint = Constraint.create({
      bodyA: tempRope.links[i],
      bodyB: tempRope.links[i + 1],
      length: SEG_LEN,
      stiffness: 0.7,
      damping: 0.08,
      render: { visible: false },
    });
    tempRope.constraints.push(constraint);
    Composite.add(world, constraint);
  }
}

function createBoxFigure() {
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
        render: { fillStyle: "#B8BABC", opacity: 1 },
      });
      Composite.add(world, currBoxFig.body);
      for (const eyelet of currBoxFig.eyelets) {
        Composite.remove(world, eyelet.body);
        Composite.add(world, eyelet.body);
      }
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
      render: {
        fillStyle: "#E6E6E6",
        strokeStyle: "none",
        lineWidth: 2,
      },
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

function syncRopeFigures() {
  for (const rope of ropeFigures) {
    Body.setPosition(rope.links[0], {
      x: rope.startEyelet.body.position.x,
      y: rope.startEyelet.body.position.y,
    });
    Body.setPosition(rope.links[SEGMENTS - 1], {
      x: rope.endEyelet.body.position.x,
      y: rope.endEyelet.body.position.y,
    });
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
    ctx.fillStyle = "#B8BABC";
    ctx.strokeStyle = "#B8BABC";
    ctx.lineWidth = 2;

    const w = mousePos.x - dragCorner.x;
    const h = mousePos.y - dragCorner.y;

    ctx.fillRect(dragCorner.x, dragCorner.y, w, h);
    ctx.strokeRect(dragCorner.x, dragCorner.y, w, h);
  }
}

function drawDraggingRope(ctx) {
  if (tempRope.links.length === 0) return;

  ctx.save();

  const endA = tempRope.links[0]; // left endpoint
  const endB = tempRope.links[SEGMENTS - 1]; // right endpoint

  ctx.beginPath();
  ctx.moveTo(tempRope.links[0].position.x, tempRope.links[0].position.y);

  for (let i = 1; i < tempRope.links.length - 1; i++) {
    const c = tempRope.links[i].position;
    const n = tempRope.links[i + 1].position;

    ctx.quadraticCurveTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2);
  }

  ctx.lineTo(
    tempRope.links[SEGMENTS - 1].position.x,
    tempRope.links[SEGMENTS - 1].position.y,
  );

  ctx.strokeStyle = "#00b809";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  for (const ep of [endA, endB]) {
    const { x, y } = ep.position;
    ctx.beginPath();
    ctx.arc(x, y, EYELET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#00b809";
    ctx.fill();
    // ctx.strokeStyle = "#004718";
    // ctx.lineWidth = 2;
    // ctx.stroke();
  }

  ctx.restore();
}

function drawRopeFigures(ctx) {
  for (const rope of ropeFigures) {
    // if (rope.links.length === 0);
    // return;
    ctx.save();

    ctx.beginPath();
    ctx.moveTo(rope.links[0].position.x, rope.links[0].position.y);

    for (let i = 1; i < rope.links.length - 1; i++) {
      const c = rope.links[i].position;
      const n = rope.links[i + 1].position;
      ctx.quadraticCurveTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2);
    }

    ctx.lineTo(
      rope.links[SEGMENTS - 1].position.x,
      rope.links[SEGMENTS - 1].position.y,
    );

    ctx.strokeStyle = "#00b809";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    for (const ep of [rope.links[0], rope.links[SEGMENTS - 1]]) {
      const { x, y } = ep.position;
      ctx.beginPath();
      ctx.arc(x, y, EYELET_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "#00b809";
      ctx.fill();
    }

    ctx.restore();
  }
}

function updateRopeSlack(rope) {
  const a = rope.links[0].position;
  const b = rope.links[SEGMENTS - 1].position;
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const segLen = (dist * SLACK) / (SEGMENTS - 1);
  for (const c of rope.constraints) {
    c.length = segLen;
  }
}

canvas.addEventListener("mousedown", onDown);
canvas.addEventListener("mousemove", onMove);
canvas.addEventListener("mouseup", onUp);
canvas.addEventListener("mouseleave", onUp);

// canvas.addEventListener("touchstart", onDown, { passive: false });
// canvas.addEventListener("touchmove", onMove, { passive: false });
// canvas.addEventListener("touchend", onUp);

Events.on(render, "afterRender", () => {
  const ctx = render.context;

  syncBoxFigureBody();
  syncRopeFigures();

  if (tempRope) updateRopeSlack(tempRope);

  drawDraggingBox(ctx);
  drawRopeFigures(ctx);

  // if (dragCorner) drawCircle(dragCorner.x, dragCorner.y, "#ff0000");
  // if (targetCorner) drawCircle(targetCorner.x, targetCorner.y, "#09f7ff");
  if (firstEyelet) drawDraggingRope(ctx);

  ctx.beginPath();
});

// dos cuerdas en la misma cuenca? si

// no se puede conectar con la misma caja
// que se sombreen los cuadros, no tienes que star cerca de ninguna esquina, si esta en el cuadro que se complete

// revisar que campos tendran o pueden tener interactividad y compartirlos

// se pueden mover de cuencas las cuerdas  que ya existan?

// puedes crear una cuerda en una cuenca donde ya existe otra cuerda? o se seleccionaria la cuerda que ya existe para poder moverla

// de ser el segundo caso, estariamos
