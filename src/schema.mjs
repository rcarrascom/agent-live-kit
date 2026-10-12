// Tiny JSON-Schema subset validator (type, required, properties, additionalProperties, items, enum, pattern,
// minimum, maximum, minItems, maxItems). Returns human-readable error strings; no dependencies.
const typeOf = v => (Array.isArray(v) ? "array" : v === null ? "null" : Number.isInteger(v) ? "integer" : typeof v);
const okType = (t, v) => (t === "number" ? typeof v === "number" : t === "integer" ? Number.isInteger(v) : typeOf(v) === t);

export function validate(schema, value, at = "", out = []) {
  const where = at || "(top level)";
  if (schema.type && !okType(schema.type, value)) {
    out.push(`${where}: should be ${schema.type === "integer" ? "a whole number" : "a " + schema.type}, found ${typeOf(value)}`);
    return out;
  }
  if (schema.enum && !schema.enum.includes(value)) out.push(`${where}: must be one of ${schema.enum.join(", ")}`);
  if (typeof value === "string" && schema.pattern && !new RegExp(schema.pattern).test(value)) out.push(`${where}: "${value}" does not look right (expected pattern ${schema.pattern})`);
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) out.push(`${where}: must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) out.push(`${where}: must be at most ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) out.push(`${where}: needs at least ${schema.minItems} item(s)`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) out.push(`${where}: has more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => validate(schema.items, v, `${at}[${i}]`, out));
  }
  if (typeOf(value) === "object") {
    for (const k of schema.required || []) if (!(k in value)) out.push(`${where}: missing required field "${k}"`);
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(value)) {
      const sub = at ? `${at}.${k}` : k;
      if (props[k]) validate(props[k], v, sub, out);
      else if (schema.additionalProperties === false) out.push(`${sub}: unknown field (typo? allowed here: ${Object.keys(props).join(", ")})`);
      else if (typeof schema.additionalProperties === "object") validate(schema.additionalProperties, v, sub, out);
    }
  }
  return out;
}
