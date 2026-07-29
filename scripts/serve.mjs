import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const dist = path.join(root, "dist");
const watchMode = process.argv.includes("--watch");
const port = Number(process.env.PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

let building = false;
let queued = false;
function buildSite() {
  return new Promise((resolve, reject) => {
    if (building) { queued = true; resolve(); return; }
    building = true;
    const child = spawn(process.execPath, ["scripts/build.mjs"], { cwd: root, stdio: "inherit" });
    child.on("exit", (code) => {
      building = false;
      if (queued) { queued = false; setTimeout(buildSite, 50); }
      if (code === 0) resolve(); else reject(new Error(`Build exited with code ${code}`));
    });
  });
}

await buildSite();

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    let requested = decodeURIComponent(url.pathname);
    if (requested.endsWith("/")) requested += "index.html";
    let filePath = path.join(dist, requested.replace(/^\/+/, ""));
    if (!path.extname(filePath)) filePath = path.join(filePath, "index.html");
    if (!filePath.startsWith(dist)) throw new Error("Invalid path");
    try {
      const stat = await fsp.stat(filePath);
      if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
      const body = await fsp.readFile(filePath);
      response.writeHead(200, { "Content-Type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
      response.end(body);
    } catch {
      const body = await fsp.readFile(path.join(dist, "404.html"));
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      response.end(body);
    }
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error.message);
  }
});

server.listen(port, () => {
  console.log(`Podium Watch is running at http://localhost:${port}`);
  console.log("Press Ctrl and C to stop the server.");
});

if (watchMode) {
  let timer;
  const watchFolders = ["content", "src", "public"].map((folder) => path.join(root, folder));
  for (const folder of watchFolders) {
    fs.watch(folder, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => buildSite().catch((error) => console.error(error.message)), 180);
    });
  }
}
