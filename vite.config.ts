import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Serves netlify/functions/*.ts at /api/* during `npm run dev`, so local dev
 * needs no netlify-cli. Production uses the redirect in netlify.toml.
 */
function netlifyFunctionsDev(): Plugin {
  return {
    name: 'netlify-functions-dev',
    configureServer(server) {
      // Local dev without Supabase may call the AI endpoints; production stays closed.
      process.env.ALLOW_OPEN_DEV ??= '1';
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/([\w-]+)/);
        if (!m) return next();
        try {
          const mod = await server.ssrLoadModule(`/netlify/functions/${m[1]}.ts`);
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          });
          const response: Response = await mod.default(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'DEV_FUNCTION', detail: String(e) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Expose server-only vars (GEMINI_API_KEY etc.) to the dev functions via process.env.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [react(), netlifyFunctionsDev()] };
});
