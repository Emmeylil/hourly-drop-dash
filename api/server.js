import server from "../dist/server/server.js";
import { Readable } from "stream";
import fs from "fs";
import path from "path";

export default async (req, res) => {
  try {
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host;
    const url = new URL(req.url, `${protocol}://${host}`);

    console.log(`Handling request for: ${url.pathname}`);

    // Fallback static file serving for assets
    if (url.pathname.startsWith("/assets/")) {
      const filePath = path.join(process.cwd(), "dist", "client", url.pathname);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const contentTypes = {
          ".css": "text/css",
          ".js": "text/javascript",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".svg": "image/svg+xml",
          ".ico": "image/x-icon",
        };
        res.setHeader("Content-Type", contentTypes[ext] || "application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.end(content);
        return;
      }
    }

    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? Readable.toWeb(req) : null,
      duplex: "half",
    });

    const response = await server.fetch(request, {}, {});

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(e.message || "Internal Server Error");
    }
  }
};
