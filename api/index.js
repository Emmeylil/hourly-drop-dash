import server from '../dist/server/server.js';
import { Readable } from 'stream';

export default async (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const url = new URL(req.url, `${protocol}://${host}`);

    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? Readable.toWeb(req) : null,
      duplex: 'half',
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
