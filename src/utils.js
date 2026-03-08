import {
  dragCorner,
  HANDLE_D,
  mousePos,
  secondBox,
  targetCorner,
} from "./main.js";
import { selectBox } from "./box.js";

export function drawCircle(x, y, color) {
  const ctx = render.context;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
export function drawDraggingBox(ctx) {
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
export function nearCorner(pos) {
  if (dragCorner) {
    secondBox = selectBox(pos);

    if (secondBox) {
      targetCorner = nearestCorner(pos, secondBox);
    }
  }
}

export function nearestCorner(pos, box) {
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
