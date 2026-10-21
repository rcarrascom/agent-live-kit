// Tool-call icons: small fading icons by tool family instead of the full call text.
// One place for the tool family, its colour, its icon and its name. Used by the Team live floating chips, the Flow skin chips,
// the flying chips on the canvas and the legend. Full text of a call stays in the node's "now" line, the activity log and the node card.
(function () {
  const COL = { read: "#7cc8ff", write: "#ffb454", run: "#6fd3a0", search: "#a99bff", web: "#4fe3e8", other: "#9fb2cf" };
  const NAME = { read: "reads files", write: "writes / edits", run: "runs a command", search: "searches", web: "web", other: "other tool" };
  const TOOLFAM = { Read: "read", Glob: "read", LS: "read", Write: "write", Edit: "write", NotebookEdit: "write", MultiEdit: "write",
    Bash: "run", PowerShell: "run", Grep: "search", ToolSearch: "search", WebFetch: "web", WebSearch: "web" };
  // 20 x 20 icon paths (stroke only): page, pencil, play, magnifier, globe, diamond
  const PATH = {
    read: "M5 3h7l4 4v10H5z M12 3v4h4",
    write: "M4 16l1-4 8-8 3 3-8 8z M11 6l3 3",
    run: "M6 4l10 6-10 6z",
    search: "M9 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M13.5 13.5L17 17",
    web: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M3 10h14 M10 3c3 3 3 11 0 14 M10 3c-3 3-3 11 0 14",
    other: "M10 3l7 7-7 7-7-7z"
  };
  const famOf = tool => TOOLFAM[String(tool || "").replace(/^mcp__.*/, "other")] || "other";
  const famOfCol = col => Object.keys(COL).find(k => COL[k] === col) || "other";
  const svg = (fam, size, col) => `<svg viewBox="0 0 20 20" width="${size}" height="${size}" fill="none" stroke="${col || COL[fam]}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATH[fam] || PATH.other}"/></svg>`;
  // canvas: draw the icon centred at (x, y), size px wide
  const draw = (cx, fam, x, y, size, col) => {
    const k = size / 20; cx.save(); cx.translate(x - size / 2, y - size / 2); cx.scale(k, k);
    cx.strokeStyle = col || COL[fam]; cx.lineWidth = 1.8; cx.lineCap = "round"; cx.lineJoin = "round"; cx.stroke(new Path2D(PATH[fam] || PATH.other)); cx.restore();
  };
  const legendHTML = () => `<span class="tkey" aria-label="tool icon key">tool icons: ${Object.keys(COL).map(f => `<span class="tk" style="--c:${COL[f]}">${svg(f, 13)}${NAME[f]}</span>`).join("")}</span>`;
  window.TOOLICONS = { COL, NAME, famOf, famOfCol, svg, draw, legendHTML };
})();
