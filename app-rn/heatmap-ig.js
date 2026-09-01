/**
 * @schema 2.10
 * @input selectedCol: number = -1
 * @input selectedRow: number = -1
 */
const selectedCol = pencil.input.selectedCol;
const selectedRow = pencil.input.selectedRow;
const cols = 24;
const rows = 7;
const cellSize = 25;
const gap = 6;
const labelWidth = 34;
const labelGap = 10;
const gridStart = labelWidth + labelGap;

const colors = ["$heatmap-l0", "$heatmap-l1", "$heatmap-l2", "$heatmap-l3", "$heatmap-l4"];
const dayLabels = ["", "월", "", "수", "", "금", ""];

const nodes = [];

for (let r = 0; r < rows; r++) {
  if (dayLabels[r]) {
    nodes.push({
      type: "text",
      content: dayLabels[r],
      x: 0,
      y: r * (cellSize + gap) + 3,
      fontSize: 17,
      fontFamily: "Noto Sans KR",
      fill: "$ig-gray-light",
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
    const isFuture = c === cols - 1 && r > 4;
    let intensity;
    if (isFuture) {
      intensity = 0;
    } else if (c >= cols - 4) {
      intensity = Math.floor(rng(i) * 3) + 2;
    } else if (c < 4) {
      const v = rng(i);
      if (v < 0.55) intensity = 0;
      else if (v < 0.85) intensity = 1;
      else intensity = 2;
    } else {
      const v = rng(i);
      if (v < 0.22) intensity = 0;
      else if (v < 0.46) intensity = 1;
      else if (v < 0.72) intensity = 2;
      else if (v < 0.9) intensity = 3;
      else intensity = 4;
    }
    nodes.push({
      type: "rectangle",
      x: cellX,
      y: cellY,
      width: cellSize,
      height: cellSize,
      cornerRadius: 6,
      fill: colors[intensity],
    });
  }
}

if (selectedCol >= 0 && selectedRow >= 0) {
  const cellX = gridStart + selectedCol * (cellSize + gap);
  const cellY = selectedRow * (cellSize + gap);
  nodes.push({
    type: "rectangle",
    x: cellX - 4,
    y: cellY - 4,
    width: cellSize + 8,
    height: cellSize + 8,
    cornerRadius: 9,
    fill: "#FFFFFF00",
    stroke: { thickness: 3, fill: "$ig-ink", align: "inside" },
  });
}

return nodes;
