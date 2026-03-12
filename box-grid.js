const { Engine, Render, Runner, Bodies, Body, Composite, Constraint, Events } =
  Matter;

let mousePos = null;
// let dragCorner = null;
// let targetCorner = null;
let hovered = [];
let gridBoxes = [];
let firstBox = null;
let secondBox = null;
let lastSecondBox = null;
let boxFigures = [];
let eyeletFigures = [];
let firstEyelet = null;
let secondEyelet = null;
let ropeFigures = [];
let tempRope = null;
let activeBoxFigure = null;

let nextFigureId = 0;
let nextEyeletId = 0;
let nextRopeId = 0;

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
// BEFOREEEEE
function selectBoxFigure(pos) {
  const eyelet = selectEyelet();

  const selected = boxFigures.find((fig) => {
    const { TL, BR } = fig.absCoor;
    return pos.x >= TL.x && pos.x <= BR.x && pos.y >= TL.y && pos.y <= BR.y;
  });

  if (eyelet && eyelet?.figureId === activeBoxFigure?.id) return 1; // return null when the eyelet is in the selected figure

  return selected ?? null;
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
  const eyelet = selectEyelet();
  const clickedFig = selectBoxFigure(pos);

  firstBox = selectBox(pos);
  secondBox = selectBox(pos);

  firstEyelet = eyelet?.free ? eyelet : null;
  if (firstEyelet) createRopeFigure();

  if (clickedFig === 1)
    return; // if no clicked figure, do not toggle selecteBoxFigure
  else {
    activeBoxFigure =
      clickedFig?.id === activeBoxFigure?.id ? null : clickedFig;
  }
}

function onUp(e) {
  if (firstBox && secondBox) {
    createBoxFigure();
    activeBoxFigure = boxFigures[boxFigures.length - 1]; // set active by default
  }

  if (tempRope) {
    if (
      secondEyelet &&
      secondEyelet !== firstEyelet &&
      secondEyelet.figureId !== firstEyelet.figureId
    ) {
      Body.setPosition(tempRope.links[SEGMENTS - 1], {
        x: secondEyelet.body.position.x,
        y: secondEyelet.body.position.y,
      });
      tempRope.endEyelet = secondEyelet;

      firstEyelet.free = false;
      secondEyelet.free = false;

      ropeFigures.push(tempRope);
    } else {
      tempRope.links.forEach((link) => Composite.remove(world, link));
    }
  }

  tempRope = null;
  firstBox = null;
  secondBox = null;
  firstEyelet = null;
  secondEyelet = null;
  tempRope = null;
  hovered = [];
}

function onMove(e) {
  mousePos = canvasPos(e);

  secondBox = selectBox(mousePos) ?? lastSecondBox;

  if (firstBox) {
    if (secondBox) {
      lastSecondBox = secondBox;
      hovered = hoveredBoxes();
    }
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

function onKeydown(e) {
  switch (e.code) {
    case "KeyD":
      deleteBoxFigure();
      return;
    case "KeyU":
      deleteBoxRopes();
      return;

    default:
      return;
  }
}

function hoveredBoxes() {
  const { minCol, maxCol, minRow, maxRow } = absBoxesCoor();

  const hovered = gridBoxes.filter(
    (box) =>
      box.col >= minCol &&
      box.col <= maxCol &&
      box.row >= minRow &&
      box.row <= maxRow,
  );

  return hovered;
}

// function nearCorner(pos) {
//   if (dragCorner) {
//     secondBox = selectBox(pos);

//     if (secondBox) {
//       targetCorner = nearestCorner(pos, secondBox);
//     }
//   }
// }

function createRopeFigure() {
  tempRope = {
    id: nextRopeId,
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

function absBoxesCoor(fBox = firstBox, sBox = secondBox) {
  const firstBoxCoor = { col: fBox.col, row: fBox.row };
  const secondBoxCoor = { col: sBox.col, row: sBox.row };

  const minCol = Math.min(firstBoxCoor.col, secondBoxCoor.col);
  const maxCol = Math.max(firstBoxCoor.col, secondBoxCoor.col);
  const minRow = Math.min(firstBoxCoor.row, secondBoxCoor.row);
  const maxRow = Math.max(firstBoxCoor.row, secondBoxCoor.row);

  return { minCol, maxCol, minRow, maxRow };
}

function createBoxFigure() {
  const { minCol, maxCol, minRow, maxRow } = absBoxesCoor();

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
      nextFigureId,
    ),
    createBoxEyelet(
      gridBoxes
        .find((box) => box.col === maxCol && box.row === minRow)
        .corners.find((c) => c.i === 2),
      nextFigureId,
    ),
    createBoxEyelet(
      gridBoxes
        .find((box) => box.col === minCol && box.row === maxRow)
        .corners.find((c) => c.i === 3),
      nextFigureId,
    ),
    createBoxEyelet(
      gridBoxes
        .find((box) => box.col === maxCol && box.row === maxRow)
        .corners.find((c) => c.i === 4),
      nextFigureId,
    ),
  ];

  eyeletFigures.push(...eyelets);

  let boxTL = gridBoxes.find((box) => box.col === minCol && box.row === minRow);
  let boxBR = gridBoxes.find((box) => box.col === maxCol && box.row === maxRow);

  const boxFig = {
    id: nextFigureId++,
    start: { box: firstBox },
    end: { box: secondBox },
    absCoor: { TL: boxTL.corners[0], BR: boxBR.corners[3] },
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

function deleteBoxFigure() {
  if (!activeBoxFigure) return;

  deleteBoxRopes();

  Composite.remove(world, activeBoxFigure.body);

  for (let i = eyeletFigures.length - 1; i >= 0; i--) {
    const eyelet = eyeletFigures[i];

    if (eyelet.figureId === activeBoxFigure.id) {
      Composite.remove(world, eyelet.body);
      eyeletFigures.splice(i, 1);
    }
  }

  const { minCol, maxCol, minRow, maxRow } = absBoxesCoor(
    activeBoxFigure.start.box,
    activeBoxFigure.end.box,
  );

  gridBoxes.forEach((box) => {
    if (
      box.col >= minCol &&
      box.col <= maxCol &&
      box.row >= minRow &&
      box.row <= maxRow
    ) {
      box.free = true;
    }
  });

  const index = boxFigures.findIndex((f) => f.id === activeBoxFigure.id);
  if (index !== -1) boxFigures.splice(index, 1);

  boxFigures.splice();

  activeBoxFigure = null;
}

function deleteBoxRopes() {
  if (activeBoxFigure) {
    for (let i = ropeFigures.length - 1; i >= 0; i--) {
      const rope = ropeFigures[i];

      if (
        rope.startEyelet.figureId === activeBoxFigure.id ||
        rope.endEyelet.figureId === activeBoxFigure.id
      ) {
        rope.links.forEach((link) => Composite.remove(world, link));
        rope.constraints.forEach((c) => Composite.remove(world, c));

        rope.startEyelet.free = true;
        rope.endEyelet.free = true;

        ropeFigures.splice(i, 1);
      }
    }
  }
}

function syncBoxFigureBody() {
  if (boxFigures.length === 0) return;

  let currBoxFig = null;

  for (let i = 0; i < boxFigures.length; i++) {
    currBoxFig = boxFigures[i];

    const x1 = currBoxFig.absCoor.TL.x;
    const y1 = currBoxFig.absCoor.TL.y;
    const x2 = currBoxFig.absCoor.BR.x;
    const y2 = currBoxFig.absCoor.BR.y;

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

  currBoxFig = null;

  syncEyelets();
}

function createBoxEyelet(corner, figureId) {
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
      },
      collisionFilter: {
        mask: 0,
      },
    },
  );

  Composite.add(world, body);

  return {
    id: nextEyeletId++,
    figureId: figureId,
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

function syncGridBoxColors(hovered = []) {
  const hoveredSet = new Set(hovered.map(({ row, col }) => `${row},${col}`));

  for (const box of gridBoxes) {
    if (!box.body) continue;

    if (hoveredSet.has(`${box.row},${box.col}`)) {
      box.body.render.fillStyle = "#B8BABC";
    } else {
      box.body.render.fillStyle = "#b8babc33";
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
  }

  ctx.restore();
}

function drawRopeFigures(ctx) {
  for (const rope of ropeFigures) {
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

// function drawBoxFigureBorders(ctx) {
//   for (const fig of boxFigures) {
//     const { TL, BR } = fig.absCoor;
//     const x = TL.x;
//     const y = TL.y;
//     const w = Math.abs(BR.x - TL.x);
//     const h = Math.abs(BR.y - TL.y);

//     const isSelected = activeBoxFigure?.id === fig.id;

//     ctx.save();
//     ctx.strokeStyle = isSelected ? "#000000" : "#11111100";
//     ctx.lineWidth = isSelected ? 1 : 0;
//     ctx.strokeRect(x, y, w, h);
//     ctx.restore();
//   }
// }

function drawactiveBoxFigure(ctx) {
  if (!activeBoxFigure) return;

  const { TL, BR } = activeBoxFigure.absCoor;
  const x = TL.x;
  const y = TL.y;
  const w = BR.x - TL.x;
  const h = BR.y - TL.y;

  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

canvas.addEventListener("mousedown", onDown);
canvas.addEventListener("mousemove", onMove);
canvas.addEventListener("mouseup", onUp);
canvas.addEventListener("mouseleave", onUp);

document.addEventListener("keydown", onKeydown);

// canvas.addEventListener("touchstart", onDown, { passive: false });
// canvas.addEventListener("touchmove", onMove, { passive: false });
// canvas.addEventListener("touchend", onUp);

Events.on(render, "afterRender", () => {
  const ctx = render.context;

  syncGridBoxColors(hovered);
  syncBoxFigureBody();
  syncRopeFigures();

  if (tempRope) updateRopeSlack(tempRope);

  drawactiveBoxFigure(ctx);
  drawRopeFigures(ctx);

  // if (dragCorner) drawCircle(dragCorner.x, dragCorner.y, "#ff0000");
  // if (targetCorner) drawCircle(targetCorner.x, targetCorner.y, "#09f7ff");
  if (firstEyelet) drawDraggingRope(ctx);

  ctx.beginPath();
});

// revisar que campos tendran o pueden tener interactividad y compartirlos

// se debe autoseleccionar la ultima caja creada
