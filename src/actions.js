import * as state from "../box-grid.js";
import { canvas } from "../box-grid.js";
import { selectEyelet } from "./eyelet.js";
import { selectBox, createBoxFigure } from "./box.js";
import { nearestCorner, nearCorner } from "./utils.js";

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
  state.mousePos = state.canvasPos(e);

  if (state.firstBox) {
    nearCorner(state.mousePos);
  }
}

canvas.addEventListener("mousedown", onDown);
canvas.addEventListener("mousemove", onMove);
canvas.addEventListener("mouseup", onUp);
canvas.addEventListener("mouseleave", onUp);
