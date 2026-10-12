// Run identity on the page side (UMD, also loaded by the tests).
// A "run" is one sub-agent execution. The relay may call it by the first characters of its task text, and after a resume
// by "<agent type>-<last 6 of the id>". The server sends the exact identity (type, task, id) from the meta.json files;
// this module remembers it so the two names always end up as ONE run, even after the event ring dropped the first event.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(); else root.Identity = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function create() {
    const known = new Set();          // base names of agent types defined in the project (+ the main session)
    const typeMap = {};               // run name -> agent type
    const taskMap = {};               // run name -> full task text
    const accounts = {};              // session id -> account label
    const idFirst = {};               // agent id -> first name this run was seen under
    const idAlias = {};               // later name -> first name (the merge)
    const titles = {};                // session id -> first user prompt

    function baseOf(n) {
      n = String(n || "orchestrator");
      if (typeMap[n]) return typeMap[n];
      if (known.has(n)) return n;
      const m = n.replace(/-[0-9a-f]{6}$/, "");
      if (m !== n) return m;          // hook-born names are "<agent type>-<last 6 of the id>"
      return "sub-agent";             // the relay names unmatched runs after their task text
    }
    function link(name, type, id, task) {
      typeMap[name] = type; if (task) taskMap[name] = task;
      if (id) {
        idFirst[id] = idFirst[id] || name; idAlias[name] = idFirst[id];
        typeMap[idFirst[id]] = type; if (task) taskMap[idFirst[id]] = task;
      }
    }
    function learnRun(r) { link(r.name, r.agentType, r.agentId, r.task); }   // server "run-info" message
    function learn(m) {                                                      // an agent-event message
      const e = m.event, p = e.payload || {};
      if (e._type) { link(e._name || p.name || p.agent || p.child, e._type, e._agentId, e._task); if (e._account) accounts[e.sessionId] = e._account; }
      if (e.type === "message" && p.role === "user" && (p.agent || "orchestrator") === "orchestrator" && !titles[e.sessionId] && p.content) titles[e.sessionId] = p.content;
    }
    const alias = n => idAlias[n] || n;
    return { known, typeMap, taskMap, accounts, titles, idAlias, baseOf, learnRun, learn, alias };
  }
  return { create };
});
