import {
  gridBoxes,
  dragCorner,
  targetCorner,
  firstBox,
  secondBox,
  eyeletFigures,
  boxFigures,
  world,
} from "./main.js";
import { createBoxEyelet, syncEyelets } from "./eyelet.js";

export function selectBox(pos) {
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

export function createBoxFigure() {
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

export function syncBoxFigureBody() {
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
