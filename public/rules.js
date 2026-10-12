// Activity-rule matcher, shared by the browser and Node (UMD). A rule maps one tool call to a node id:
//   { node, tool?: regex on the tool name, match?: regex on the argument text, flags?: "i" (default), waiting?: true }
// A rule with neither tool nor match never fires. All rules that match fire (one command can light several nodes).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(); else root.Rules = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function compile(rules) {
    const out = [], errors = [];
    (rules || []).forEach((r, i) => {
      try {
        out.push({ ...r, tre: r.tool ? new RegExp(r.tool) : null, mre: r.match ? new RegExp(r.match, r.flags || "i") : null });
      } catch (e) { errors.push({ index: i, node: r && r.node, error: String(e.message || e) }); }
    });
    return { rules: out, errors };
  }
  // Returns the list of matching compiled rules for one tool call.
  function matchRules(compiled, tool, argText) {
    const hits = [];
    for (const r of compiled) {
      if (!r.tre && !r.mre) continue;
      if (r.tre && !r.tre.test(tool || "")) continue;
      if (r.mre && !r.mre.test(argText || "")) continue;
      hits.push(r);
    }
    return hits;
  }
  return { compile, matchRules };
});
