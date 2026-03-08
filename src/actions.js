import * as state from "./main.js";
import { canvas } from "./main.js";
import { selectEyelet } from "./eyelet.js";
import { selectBox, createBoxFigure } from "./box.js";
import { nearestCorner, nearCorner } from "./utils.js";
import { setMousePos, canvasPos } from "./main.js";

function onDown(e) {
  const pos = state.canvasPos(e);

  state.firstBox = selectBox(pos);

  if (state.firstBox) {
    state.dragCorner = nearestCorner(pos, state.firstBox);
  }

  state.firstEyelet = selectEyelet();
}

function onUp(e) {
  if (state.dragCorner && state.targetCorner && state.secondBox) {
    createBoxFigure();
  }

  state.dragCorner = null;
  state.firstBox = null;
  state.secondBox = null;
  state.targetCorner = null;
}

function onMove(e) {
  const pos = state.canvasPos(e);
  setMousePos(pos);

  if (state.firstBox) {
    nearCorner(state.mousePos);
  }
}

export function initEventListeners() {
  canvas.addEventListener("mousedown", onDown);
  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseup", onUp);
  canvas.addEventListener("mouseleave", onUp);
}
