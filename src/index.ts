export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // TODO - validate JWT?
    const jwt = request.headers.get("cf-access-jwt-assertion");
    if (!jwt) {
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const dbName = url.pathname.slice(1); 

    const db = env[dbName];
    if (!db || typeof db.prepare !== 'function') {
      return new Response("Not Found", { status: 404 });
    }

    try {
      const body = await request.json() as { sql: string; args?: unknown[]; isExec?: boolean };
      const stmt = db.prepare(body.sql).bind(...(body.args || []));

      if (body.isExec) {
        const result = await stmt.run();
        const response = {
          changes: result.meta?.changes ?? 0,
          last_row_id: result.meta?.last_row_id ?? 0,
        };
        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" }
        });
      } else {
        const { results } = await stmt.all();
        return new Response(JSON.stringify(results), {
          headers: { "Content-Type": "application/json" }
        });
      }

    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};