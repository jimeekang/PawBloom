import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const host = args.get("--host") ?? "127.0.0.1";
const port = Number(args.get("--port") ?? "8082");
const root = resolve("apps/mobile/dist-web");

if (!existsSync(root)) {
  console.error(`Missing Expo web export at ${root}. Run npm run mobile:export-web first.`);
  process.exit(1);
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveRequestPath(url) {
  const parsed = new URL(url, `http://${host}:${port}`);
  const decodedPath = decodeURIComponent(parsed.pathname);
  const normalized = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const candidate = resolve(root, `.${sep}${normalized}`);
  if (!candidate.startsWith(root)) {
    return null;
  }
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }
  return join(root, "index.html");
}

const server = createServer((request, response) => {
  const filePath = resolveRequestPath(request.url ?? "/");
  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const contentType = contentTypes[extname(filePath)] ?? "application/octet-stream";
  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`PetBloom app preview running at http://${host}:${port}/`);
});

