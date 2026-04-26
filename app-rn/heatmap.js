/**
 * @schema 2.10
 * @input populated: boolean = true
 */
const populated = pencil.input.populated;
const cols = 16;
const rows = 7;
const cellSize = 14;
const gap = 3;
const labelWidth = 18;
const labelGap = 6;
const gridStart = labelWidth + labelGap;

const colors = ["#ECEEF2", "#C8E1F5", "#92C4E8", "#5BA0D5", "#2E7CB8"];
const freezeFill = "#E8F0F9";
const freezeStroke = "#5B9BF5";
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
      y: r * (cellSize + gap) + 2,
      fontSize: 9,
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
        cornerRadius: 3,
        fill: freezeFill,
        stroke: { thickness: 1, fill: freezeStroke, align: "inside" },
      });
      nodes.push({
        type: "icon_font",
        iconFontFamily: "lucide",
        iconFontName: "snowflake",
        x: cellX + 2,
        y: cellY + 2,
        width: 10,
        height: 10,
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
      cornerRadius: 3,
      fill: colors[intensity],
    });
  }
}

return nodes;
