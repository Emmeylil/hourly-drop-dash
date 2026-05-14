import server from '../dist/server/server.js';

export const config = {
  runtime: 'edge',
};

export default async (req) => {
  try {
    return await server.fetch(req, {}, {});
  } catch (e) {
    console.error(e);
    return new Response(e.message || "Internal Server Error", { status: 500 });
  }
};
