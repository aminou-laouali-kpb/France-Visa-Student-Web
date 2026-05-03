import type { RequestHandler } from "express";
import { getTenant } from "../lib/tenant";

/**
 * Returns true when `ip` (IPv4) is contained in the CIDR `cidr`. Falls back
 * to exact match for non-CIDR strings or IPv6.
 */
function ipInCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) return ip === cidr;
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  if (!Number.isFinite(bits) || bits < 0 || bits > 32) return false;
  const toInt = (s: string) => {
    const parts = s.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
      return null;
    }
    return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
  };
  const a = toInt(ip);
  const b = toInt(base);
  if (a == null || b == null) return false;
  if (bits === 0) return true;
  const mask = (~((1 << (32 - bits)) - 1)) >>> 0;
  return (a & mask) === (b & mask);
}

function clientIp(req: { ip?: string }): string {
  // Express resolves `req.ip` from the socket, walking back through proxies
  // listed in the `trust proxy` setting. Never read raw `x-forwarded-for`
  // ourselves: that header is client-controlled and would let an attacker
  // spoof their way past the allowlist.
  return req.ip ?? "";
}

/**
 * Blocks admin/superadmin requests when the tenant has an ipAllowlist
 * configured and the request IP isn't on it. Other roles are unaffected.
 */
export const requireAdminIp: RequestHandler = async (req, res, next) => {
  const user = req.currentUser;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.role !== "admin" && user.role !== "superadmin") {
    next();
    return;
  }
  const tenant = await getTenant(user.tenantId);
  const allowlist = tenant?.ipAllowlist?.trim();
  if (!allowlist) {
    next();
    return;
  }
  const ip = clientIp(req);
  const cidrs = allowlist
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (cidrs.some((c) => ipInCidr(ip, c))) {
    next();
    return;
  }
  res.status(403).json({
    error: "ip_not_allowed",
    message: "Votre adresse IP n'est pas autorisée à accéder à l'administration de cette agence.",
  });
};
