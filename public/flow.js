// ---------- flow ----------
let NW = 200, NH = 60, OX = 24, CX = 470, GAP = 86, MAXC = 7, VW = 960, NARROW = false;
const packets = [];
function childPos(i, n) { return { x: CX, y: 20 + i * GAP }; }
function visibleEdges() { return model.edges.slice(-MAXC); }
function spawnPacket(ed, dir) {
  if (SKIN === "team" || SKIN === "classic") { const a = fxName(ed.parent || "orchestrator"), b = fxName(ed.child); if (dir === "out") { ed.born = performance.now(); FX.hook("beam", { from: a, to: b, label: ed.task, col: "#7cc8ff" }); } else FX.hook("beam", { from: b, to: a, label: "result", col: "#6fd3a0" }); return; }
  if (dir === "out") { ed.born = performance.now(); FX.hook("dispatch", ed); } else FX.hook("return", ed); }
function layoutH() { return Math.max(300, 40 + Math.min(MAXC, Math.max(1, model.edges.length)) * GAP); }
function renderFlow() {
  if (SKIN !== "team") { $("svg").style.height = ""; $("svg").style.maxHeight = ""; $("svg").style.maxWidth = ""; }
  if (SKIN === "classic") return renderClassic();
  if (SKIN === "team") return renderTeamLive();
  NARROW = $("svg").parentElement.clientWidth < 620;
  if (NARROW) { VW = 420; NW = 150; NH = 72; OX = 10; CX = 250; GAP = 108; } else { VW = 960; NW = 200; NH = 60; OX = 24; CX = 470; GAP = 86; }
  const ves = visibleEdges(), H = layoutH(), cy = H / 2;
  const svg = $("svg"); svg.setAttribute("viewBox", `0 0 ${VW} ${H}`);
  const geo = { VW, H, nodes: {}, edges: {} }, st2 = { agents: {}, edges: {}, chips: {}, ctx: null };
  let s = "";
  const iconChip = (c2, col, fam, x, y) => `<g opacity="${Math.max(.15, 1 - (nowTs - c2.ts) / CHIP_MS)}" transform="translate(${x} ${y})"><title>${esc(c2.tool + " " + (c2.arg || ""))}</title><circle cx="9" cy="9" r="9" fill="#0d1523" stroke="${col}" stroke-opacity=".8"/><g transform="translate(2.5 2.5) scale(.65)">${TOOLICONS.svg(fam, 20, col).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</g></g>`;
  const nodeBox = (x, y, name, a, label, born) => {
    const c = colorOf(name), st = a ? a.status : "idle", on = st === "tool" || st === "thinking" || st === "perm";
    const fill = on ? "#18304f" : "#14203a", op = st === "done" ? .7 : (st === "idle" ? .5 : 1);
    const age = born ? performance.now() - born : 1e9, shake = a && a.errAt && nowTs - a.errAt < 700 && nowTs >= a.errAt ? nowTs - a.errAt : -1;
    const anim = age < 900 ? `animation:mat .7s ease-out both;animation-delay:-${Math.round(age)}ms;` : (shake >= 0 ? `animation:shake .5s linear both;animation-delay:-${Math.round(shake)}ms;` : "");
    let o = `<g class="nodeg" style="${anim}" opacity="${op}">`;
    if (on && !RM) o += `<rect class="ring" x="${x}" y="${y}" width="${NW}" height="${NH}" rx="12" fill="none" stroke="${c}" stroke-width="2"/>`;
    o += `<rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="12" fill="${fill}" stroke="${on ? c : "#22314d"}" stroke-width="${on ? 2 : 1}"/>`;
    o += `<rect x="${x}" y="${y + 10}" width="4" height="${NH - 20}" rx="2" fill="${c}"/>`;
    o += `<text class="nm" x="${x + 16}" y="${y + 26}" fill="${c}">${esc(label.slice(0, NARROW ? 15 : 22))}</text>`;
    o += `<text class="sub" x="${x + 16}" y="${y + 45}">${esc((st === "perm" ? "permission" : LABEL[st]) + (a && a.calls ? " · " + a.calls + " calls" : ""))}</text>`;
    if (st === "done") o += `<text x="${x + NW - 22}" y="${y + 24}" fill="var(--moss)" font-size="15">&#10003;</text>`;
    if (st === "perm") o += `<circle class="perm-badge" cx="${x + NW - 16}" cy="${y + 16}" r="9" fill="#ffb454"/><text x="${x + NW - 16}" y="${y + 20.5}" text-anchor="middle" font-size="13" font-weight="700" fill="#111">!</text>`;
    if (st === "error") o += `<text x="${x + NW - 22}" y="${y + 24}" fill="var(--blood)" font-size="15">!</text>`;
    return o + "</g>";
  };
  const orch = model.agents["orchestrator"];
  const oy = cy - NH / 2;
  if (model.edges.length > MAXC) s += `<text class="sub" x="${CX}" y="12">+${model.edges.length - MAXC} earlier hand-offs (see the log)</text>`;
  ves.forEach((ed, i) => {
    const p = childPos(i), y = p.y, x1 = OX + NW, y1 = cy, x2 = p.x, y2 = y + NH / 2;
    const mx = (x1 + x2) / 2, c = colorOf(ed.child), active = ed.state === "out";
    const bage = ed.born ? performance.now() - ed.born : 1e9, drawing = bage < 900;
    geo.edges[ed.id] = { p0: [x1, y1], p1: [mx, y1], p2: [mx, y2], p3: [x2, y2], child: ed.child, col: colorRaw(ed.child) }; st2.edges[ed.id] = ed.state;
    geo.nodes[ed.child] = { x: x2, y, w: NW, h: NH, cx: x2 + NW / 2, cy: y + NH / 2, col: colorRaw(ed.child), chipX: NARROW ? x2 : x2 + NW + 12, chipY: NARROW ? y + NH + 4 : y + 2, chipStep: NARROW ? 0 : 20 };
    s += `<path id="e${ed.id}" d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" fill="none" stroke="${active ? c : "#2c3f63"}" stroke-width="${active ? 2.2 : 1.4}" class="${active && !RM && !drawing ? "edgeactive" : ""}" style="${drawing ? `stroke-dasharray:1200;animation:drawE .8s linear both;animation-delay:-${Math.round(bage)}ms` : ""}" opacity="${active ? 1 : .6}"/>`;
    const LN = NARROW ? 20 : 46, lab = (ed.task || "").replace(/\s+/g, " ").slice(0, LN) + ((ed.task || "").length > LN ? "…" : "");
    if (NARROW) s += `<text x="${x2 + 16}" y="${y + 63}" font-size="9.5" fill="#9fb2cf">${esc(lab)}</text>`;
    else if (lab) {
      const w = Math.min(250, lab.length * 6 + 16), lx = mx - w / 2, ly = (y1 + y2) / 2 - 11;
      s += `<g><rect x="${lx}" y="${ly}" width="${w}" height="20" rx="10" fill="#0d1523" stroke="#22314d"/><text x="${mx}" y="${ly + 14}" text-anchor="middle" font-size="10.5" fill="#b4c3dc">${esc(lab)}</text></g>`;
    }
    const a = model.agents[ed.child];
    s += nodeBox(x2, y, ed.child, a, labelOf(ed.child), ed.born);
    // chips next to the node
    const chips = model.chips.filter(c2 => c2.agent === ed.child && nowTs - c2.ts < CHIP_MS).slice(NARROW ? -1 : -3);
    chips.forEach((c2, j) => {
      const fam = TOOLICONS.famOf(c2.tool), col = TOOLICONS.COL[fam], yy = NARROW ? y + NH + 4 : y + 2 + j * 22, cx0 = NARROW ? x2 + j * 22 : x2 + NW + 12;
      s += iconChip(c2, col, fam, cx0, yy);
    });
  });
  geo.nodes.orchestrator = { x: OX, y: oy, w: NW, h: NH, cx: OX + NW / 2, cy: cy, col: colorRaw("orchestrator"), chipX: OX, chipY: oy + NH + 10, chipStep: 20 };
  s += nodeBox(OX, oy, "orchestrator", orch, "orchestrator");
  const oc = model.chips.filter(c2 => c2.agent === "orchestrator" && nowTs - c2.ts < CHIP_MS).slice(-3);
  oc.forEach((c2, j) => { const fam = TOOLICONS.famOf(c2.tool), col = TOOLICONS.COL[fam]; s += iconChip(c2, col, fam, OX + j * 22, oy + NH + 10); });
  if (!model.edges.length) {
    s += `<text x="${CX}" y="${cy - 150}" fill="var(--muted)" font-size="${NARROW ? 11 : 13}">${NARROW ? "no sub-agent in this session" : "No sub-agent in this session yet. The idle team is drawn faintly; pick another session above or wait for a spawn."}</text>`;
    const ghosts = (typeof TN !== "undefined" ? TN.filter(x => isAgentBand(x.band)) : []).slice(0, 14);
    ghosts.forEach((g, i) => { const gx = CX - 40 + (i % 2) * 215, gy = cy - 120 + Math.floor(i / 2) * 34; s += `<g opacity=".28"><rect x="${gx}" y="${gy}" width="200" height="26" rx="9" fill="#111a2a" stroke="#22314d"/><rect x="${gx}" y="${gy + 5}" width="3" height="16" fill="#b9e6ff"/><text x="${gx + 12}" y="${gy + 17}" font-size="11" fill="#b9e6ff" font-family="Saira Condensed,sans-serif" font-weight="700">${esc(g.name)}</text></g>`; });
  }
  $("layer").innerHTML = s;
  for (const a of Object.values(model.agents)) {
    const recent = (a.stamps || []).filter(x => nowTs - x < 4000).length / 4;
    st2.agents[a.name] = { status: a.status, rate: recent };
    st2.chips[a.name] = model.chips.filter(c2 => c2.agent === a.name && nowTs - c2.ts < CHIP_MS).length;
  }
  if (model.ctx) st2.ctx = { pct: model.ctx.tokens / (model.ctx.max || 1000000) };
  FX.setGeom(geo); FX.sync(st2);
}
