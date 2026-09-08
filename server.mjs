import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(moduleDirectory, "public");
const maximumBodyBytes = 16 * 1024;
const defaultLeadApi = "https://dig-media-partners.alijune.chatgpt.site/api/leads";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
]);

function applySecurityHeaders(response) {
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function sendJson(response, status, value) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

async function readBoundedBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBodyBytes) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function proxyLead(request, response, leadApiUrl) {
  if (!String(request.headers["content-type"] || "").startsWith("application/json")) {
    sendJson(response, 415, { error: "This endpoint accepts JSON inquiries only." });
    return;
  }

  try {
    const rawBody = await readBoundedBody(request);
    JSON.parse(rawBody);
    const upstream = await fetch(leadApiUrl, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: rawBody,
      signal: AbortSignal.timeout(10_000),
    });
    const body = await upstream.text();
    response.statusCode = upstream.status;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(body);
  } catch (error) {
    const status = error instanceof Error && error.message === "BODY_TOO_LARGE" ? 413 : 502;
    sendJson(response, status, {
      error: status === 413
        ? "The inquiry is too long. Please shorten it and try again."
        : "We could not submit your inquiry just now. Please email contact@ubcdig.com.",
    });
  }
}

function resolvePublicFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const requested = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const resolved = path.resolve(publicDirectory, requested);
  return resolved === publicDirectory || resolved.startsWith(`${publicDirectory}${path.sep}`)
    ? resolved
    : null;
}

async function serveStatic(request, response, pathname) {
  let filePath = resolvePublicFile(pathname);
  if (!filePath) {
    response.statusCode = 400;
    response.end("Bad request");
    return;
  }

  try {
    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
    const body = await readFile(filePath);
    response.statusCode = 200;
    response.setHeader("Content-Type", contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream");
    response.setHeader("Cache-Control", path.extname(filePath) === ".html" ? "no-cache" : "public, max-age=604800");
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    try {
      const body = await readFile(path.join(publicDirectory, "404.html"));
      response.statusCode = 404;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.statusCode = 404;
      response.end("Not found");
    }
  }
}

export function createUbcServer(options = {}) {
  const leadApiUrl = options.leadApiUrl || process.env.LEAD_API_URL || defaultLeadApi;
  return createServer(async (request, response) => {
    applySecurityHeaders(response);
    const url = new URL(request.url || "/", "http://localhost");
    if (request.method === "POST" && url.pathname === "/api/leads") {
      await proxyLead(request, response, leadApiUrl);
      return;
    }
    if (request.method === "GET" || request.method === "HEAD") {
      await serveStatic(request, response, url.pathname);
      return;
    }
    response.setHeader("Allow", "GET, HEAD, POST");
    sendJson(response, 405, { error: "Method not allowed." });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createUbcServer().listen(port, "0.0.0.0", () => {
    console.log(`UBC website listening on port ${port}`);
  });
}
