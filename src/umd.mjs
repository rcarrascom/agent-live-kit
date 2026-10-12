// Loads the browser/Node shared (UMD) modules from public/ into Node.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export const Rules = require("../public/rules.js");
export const Identity = require("../public/identity.js");
