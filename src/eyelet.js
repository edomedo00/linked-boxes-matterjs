import {
  eyeletFigures,
  EYELET_OFFSETS,
  EYELET_RADIUS,
  world,
  boxFigures,
} from "./main.js";

export function selectEyelet() {
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

export function createBoxEyelet(corner) {
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

export function syncEyelets() {
  for (const eyelet of eyeletFigures) {
    const { corner, offset } = eyelet;

    Body.setPosition(eyelet.body, {
      x: corner.x + offset.x,
      y: corner.y + offset.y,
    });
  }
}
