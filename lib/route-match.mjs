// Minimal route matcher for the new Communication Hub endpoints.
//
// The API lives in a single catch-all handler whose dispatch is a long chain of
// `if (pathStr === …)` / `if (pathStr.startsWith(…) && path[2] === …)` checks.
// Adding ~18 more branches that way multiplies the chance of a missed auth
// check, a wrong branch order, or two routes quietly overlapping.
//
// This does not restructure the existing chain — it only gives the new routes a
// declarative table so each handler can state its path once and receive named
// params instead of indexing into the path array.

function compile(pattern) {
  const segments = String(pattern)
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  return segments.map((segment) =>
    segment.startsWith(":")
      ? { param: segment.slice(1) }
      : { literal: segment },
  );
}

function splitPath(pathStr) {
  return String(pathStr ?? "")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
}

/**
 * Match one path against one pattern.
 * Returns the extracted params, or null when the pattern does not apply.
 */
export function matchPattern(pattern, pathStr) {
  const compiled = compile(pattern);
  const segments = splitPath(pathStr);
  if (compiled.length !== segments.length) return null;

  const params = {};
  for (let i = 0; i < compiled.length; i += 1) {
    const spec = compiled[i];
    const value = segments[i];
    if (spec.literal !== undefined) {
      if (spec.literal !== value) return null;
    } else {
      // An empty segment can never be a valid id; reject rather than pass ""
      // down into a database lookup.
      if (!value) return null;
      params[spec.param] = decodeURIComponent(value);
    }
  }
  return params;
}

/**
 * Find the first entry in `table` whose method and pattern match.
 *
 * Order matters and is the caller's responsibility: list more specific
 * patterns first, exactly as the surrounding if-chain already requires.
 *
 * @param {string} method  HTTP verb, e.g. "POST"
 * @param {string} pathStr path without the /api prefix, e.g. "chat/channels/abc/messages"
 * @param {Array<{method: string, pattern: string, handler: Function}>} table
 * @returns {{route: object, params: object}|null}
 */
export function matchRoute(method, pathStr, table) {
  if (!Array.isArray(table)) return null;
  const verb = String(method ?? "").toUpperCase();
  for (const route of table) {
    if (!route || String(route.method ?? "").toUpperCase() !== verb) continue;
    const params = matchPattern(route.pattern, pathStr);
    if (params) return { route, params };
  }
  return null;
}
