import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { registerTenantBudgetResolver } from "./lib/aiBootstrap";

registerTenantBudgetResolver();

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// CORS allowlist: REPLIT_DEV_DOMAIN, REPLIT_DOMAINS (comma-separated), and
// any explicit ALLOWED_ORIGINS. Requests with no Origin header (server-to-
// server, curl, same-origin) are allowed. Anything else is rejected.
const allowedOrigins = (() => {
  const list = new Set<string>();
  const dev = process.env["REPLIT_DEV_DOMAIN"];
  if (dev) list.add(`https://${dev}`);
  for (const d of (process.env["REPLIT_DOMAINS"] ?? "").split(",")) {
    const t = d.trim();
    if (t) list.add(`https://${t}`);
  }
  for (const o of (process.env["ALLOWED_ORIGINS"] ?? "").split(",")) {
    const t = o.trim();
    if (t) list.add(t);
  }
  if (process.env["NODE_ENV"] !== "production") {
    list.add("http://localhost:5173");
    list.add("http://localhost:5000");
  }
  return list;
})();

app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin not allowed: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: "35mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;
