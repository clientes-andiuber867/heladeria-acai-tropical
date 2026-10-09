import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [
      react(),
      {
        name: "local-public-payment-preview",
        apply: "serve",
        configureServer(server) {
          server.middlewares.use(
            "/api/local-public-payment",
            async (req, res) => {
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              if (req.method !== "GET" || !env.SUPABASE_SERVICE_ROLE_KEY) {
                res.statusCode = 503;
                res.end(JSON.stringify({ error: "QR no disponible" }));
                return;
              }
              try {
                const response = await fetch(
                  `${env.VITE_SUPABASE_URL}/rest/v1/payment_settings?select=qr_path,recipient,version&id=eq.1`,
                  {
                    headers: {
                      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                    },
                    signal: AbortSignal.timeout(8000),
                  },
                );
                if (!response.ok) throw new Error("QR unavailable");
                const rows = await response.json();
                res.end(JSON.stringify(rows[0] || null));
              } catch {
                res.statusCode = 503;
                res.end(
                  JSON.stringify({ error: "No se pudo consultar el QR" }),
                );
              }
            },
          );
        },
      },
    ],
    server: {
      host: true,
    },
  };
});
