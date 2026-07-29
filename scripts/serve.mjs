import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
spawnSync(process.execPath, [path.join(__dirname, "build-blog.mjs")], { stdio: "inherit" });
const dist = path.join(root, "dist");
const types = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".webp":"image/webp", ".svg":"image/svg+xml" };
const server = http.createServer(async (req,res) => {
  try {
    const requestPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let filePath = path.join(dist, requestPath);
    if (!filePath.startsWith(dist)) throw new Error("Invalid path");
    let stat;
    try { stat = await fs.stat(filePath); } catch { stat = null; }
    if (stat?.isDirectory()) filePath = path.join(filePath, "index.html");
    if (!stat && !path.extname(filePath)) filePath = path.join(filePath, "index.html");
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type":"text/plain; charset=utf-8" });
    res.end("Page not found");
  }
});
server.listen(3000, () => console.log("Preview running at http://localhost:3000"));
