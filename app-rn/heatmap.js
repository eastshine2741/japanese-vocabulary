/**
 * @schema 2.10
 * @input populated: boolean = true
 * @input selectedCol: number = -1
 * @input selectedRow: number = -1
 * @input scale: number = 1
 */
const populated = pencil.input.populated;
const selectedCol = pencil.input.selectedCol;
const selectedRow = pencil.input.selectedRow;
const scale = pencil.input.scale || 1;
const cols = 16;
const rows = 7;
const cellSize = 14 * scale;
const gap = 3 * scale;
const labelWidth = 18 * scale;
const labelGap = 6 * scale;
const radius = 3 * scale;
const gridStart = labelWidth + labelGap;

const colors = ["$heatmap-l0", "$heatmap-l1", "$heatmap-l2", "$heatmap-l3", "$heatmap-l4"];
const freezeFill = "$heatmap-freeze-fill";
const freezeStroke = "$heatmap-freeze-stroke";
const dayLabels = ["", "월", "", "수", "", "금", ""];
const freezeDays = [
  { c: 14, r: 4 },
  { c: 7, r: 2 },
];

const nodes = [];

for (let r = 0; r < rows; r++) {
  if (dayLabels[r]) {
    nodes.push({
      type: "text",
      content: dayLabels[r],
      x: 0,
      y: r * (cellSize + gap) + 2 * scale,
      fontSize: 9 * scale,
      fontFamily: "Inter",
      fill: "#888888",
    });
  }
}

function rng(i) {
  const x = Math.sin(i * 12.9898 + 5.43) * 43758.5453;
  return x - Math.floor(x);
}

for (let c = 0; c < cols; c++) {
  for (let r = 0; r < rows; r++) {
    const i = c * rows + r;
    const cellX = gridStart + c * (cellSize + gap);
    const cellY = r * (cellSize + gap);
    const isFreeze = populated && freezeDays.some((f) => f.c === c && f.r === r);
    if (isFreeze) {
      nodes.push({
        type: "rectangle",
        x: cellX,
        y: cellY,
        width: cellSize,
        height: cellSize,
        cornerRadius: radius,
        fill: freezeFill,
        stroke: { thickness: scale, fill: freezeStroke, align: "inside" },
      });
      nodes.push({
        type: "icon_font",
        iconFontFamily: "lucide",
        iconFontName: "snowflake",
        x: cellX + 2 * scale,
        y: cellY + 2 * scale,
        width: 10 * scale,
        height: 10 * scale,
        fill: freezeStroke,
      });
      continue;
    }
    const isFuture = c === cols - 1 && r > 4;
    let intensity;
    if (!populated) {
      intensity = 0;
    } else if (isFuture) {
      intensity = 0;
    } else if (c >= cols - 3) {
      intensity = Math.floor(rng(i) * 3) + 1;
    } else {
      const v = rng(i);
      if (v < 0.32) intensity = 0;
      else if (v < 0.58) intensity = 1;
      else if (v < 0.8) intensity = 2;
      else if (v < 0.94) intensity = 3;
      else intensity = 4;
    }
    nodes.push({
      type: "rectangle",
      x: cellX,
      y: cellY,
      width: cellSize,
      height: cellSize,
      cornerRadius: radius,
      fill: colors[intensity],
    });
  }
}

if (selectedCol >= 0 && selectedRow >= 0) {
  const cellX = gridStart + selectedCol * (cellSize + gap);
  const cellY = selectedRow * (cellSize + gap);
  nodes.push({
    type: "rectangle",
    x: cellX - 2 * scale,
    y: cellY - 2 * scale,
    width: cellSize + 4 * scale,
    height: cellSize + 4 * scale,
    cornerRadius: 5 * scale,
    fill: "#FFFFFF00",
    stroke: { thickness: 1.5 * scale, fill: "#1A1A1A", align: "inside" },
  });
}

return nodes;
