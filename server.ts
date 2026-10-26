import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { extname, join, normalize, sep } from "node:path";
import { DATA_DIR, db, getSetting, logEvent, setSetting } from "./lib/db";

const ROOT = import.meta.dir;
const PUBLIC_DIR = join(ROOT, "public");
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? "127.0.0.1";

const SESSION_DAYS = 30;
const BAN_HOURS = 5;
const MAX_FAILURES = 3;
const FAILURE_WINDOW_MINUTES = 15;
const COOKIE_NAME = "board_session";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

/* ------------------------------------------------------------------ */
/* Şifre                                                               */
/* ------------------------------------------------------------------ */

function ensurePassword(): void {
  if (getSetting("password_hash")) return;

  const initialPath = join(DATA_DIR, "initial-password.txt");
  let password: string;

  if (existsSync(initialPath)) {
    password = readFileSync(initialPath, "utf8").trim();
  } else {
    password = randomBytes(18).toString("base64url");
    writeFileSync(initialPath, `${password}\n`, { mode: 0o600 });
  }

  setSetting("password_hash", Bun.password.hashSync(password));
  console.log(`[board] ilk şifre: ${initialPath}`);
}

ensurePassword();

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

function sessionId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getSession(req: Request): boolean {
  const token = parseCookies(req.headers.get("cookie"))[COOKIE_NAME];
  if (!token) return false;
  const row = dbSessionGet(sessionId(token));
  return Boolean(row);
}

function dbSessionGet(id: string): unknown {
  return db.query("SELECT id FROM sessions WHERE id = ? AND expires_at > ?").get(id, Date.now());
}

function createSession(req: Request, ip: string): string {
  const token = randomBytes(32).toString("base64url");
  const id = sessionId(token);
  const now = Date.now();
  const expires = now + SESSION_DAYS * 86_400_000;
  dbSessionInsert(id, now, expires, ip, req.headers.get("user-agent") ?? "");
  return token;
}

function dbSessionInsert(
  id: string,
  createdAt: number,
  expiresAt: number,
  ip: string,
  ua: string,
): void {
  db.query(
    "INSERT INTO sessions(id, created_at, expires_at, ip, ua) VALUES(?, ?, ?, ?, ?)",
  ).run(id, createdAt, expiresAt, ip, ua);
}

function deleteSession(req: Request): void {
  const token = parseCookies(req.headers.get("cookie"))[COOKIE_NAME];
  if (!token) return;
  db.query("DELETE FROM sessions WHERE id = ?").run(sessionId(token));
}

function clientIp(req: Request, server: any): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return server.requestIP(req)?.address ?? "unknown";
}

function cookieHeader(token: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}`;
}

function clearCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function isAllowedOrigin(origin: string, req: Request): boolean {
  try {
    // Bazı mobil uygulama içi tarayıcılar/gizlilik araçları Origin: null
    // gönderebiliyor. Tek kullanıcılı, şifreli bir panelde bunu kabul et.
    if (origin === "null") return true;

    const normalize = (host: string) => host.toLowerCase().replace(/\.$/, "");
    const originUrl = new URL(origin);
    const requestUrl = new URL(req.url);
    // Aynı host, port/protokol farkı önemli değil. board.zeda.dev, localhost
    // ve ileride eklenecek alias'lar böylece çalışır.
    return normalize(originUrl.hostname) === normalize(requestUrl.hostname);
  } catch {
    return false;
  }
}

function withSecurityHeaders(response: Response, cache = "private, no-store"): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", cache);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function html(body: string, status = 200, extra: Record<string, string> = {}): Response {
  return withSecurityHeaders(
    new Response(body, {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", ...extra },
    }),
  );
}

function redirect(location: string, extra: Record<string, string> = {}): Response {
  return withSecurityHeaders(
    new Response(null, {
      status: 303,
      headers: { Location: location, ...extra },
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Giriş / ban                                                         */
/* ------------------------------------------------------------------ */

interface Attempt {
  ip: string;
  failures: number;
  window_start: number;
  banned_until: number;
}

function getAttempt(ip: string): Attempt | null {
  return (db.query("SELECT * FROM attempts WHERE ip = ?").get(ip) as Attempt | null) ?? null;
}

function banRemaining(ip: string): number {
  const attempt = getAttempt(ip);
  if (!attempt) return 0;
  return Math.max(0, attempt.banned_until - Date.now());
}

function recordFailure(ip: string): { banned: boolean; remaining: number; until: number } {
  const now = Date.now();
  const windowMs = FAILURE_WINDOW_MINUTES * 60_000;
  const attempt = getAttempt(ip);

  if (!attempt || now - attempt.window_start > windowMs) {
    db.query(
      "INSERT INTO attempts(ip, failures, window_start, banned_until) VALUES(?, 1, ?, 0) ON CONFLICT(ip) DO UPDATE SET failures = 1, window_start = excluded.window_start, banned_until = 0",
    ).run(ip, now);
    return { banned: false, remaining: MAX_FAILURES - 1, until: 0 };
  }

  const failures = attempt.failures + 1;
  if (failures >= MAX_FAILURES) {
    const until = now + BAN_HOURS * 3_600_000;
    db.query("UPDATE attempts SET failures = ?, banned_until = ? WHERE ip = ?").run(
      failures,
      until,
      ip,
    );
    logEvent(ip, "ban", `${BAN_HOURS}h`);
    return { banned: true, remaining: 0, until };
  }

  db.query("UPDATE attempts SET failures = ? WHERE ip = ?").run(failures, ip);
  return { banned: false, remaining: MAX_FAILURES - failures, until: 0 };
}

function clearFailures(ip: string): void {
  db.query("DELETE FROM attempts WHERE ip = ?").run(ip);
}

function formatDuration(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} saat ${rest} dakika` : `${hours} saat`;
  }
  return `${minutes} dakika`;
}

/* ------------------------------------------------------------------ */
/* HTML                                                                */
/* ------------------------------------------------------------------ */

function loginPage(options: { error?: string; next?: string; status?: number } = {}): Response {
  const error = options.error
    ? `<div class="alert">${esc(options.error)}</div>`
    : "";
  const next = esc(safeNext(options.next ?? "/"));

  return html(
    `<!doctype html>
<html lang="tr" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <title>Board — giriş</title>
  <link rel="stylesheet" href="/assets/board.css">
</head>
<body class="login-page">
  <main class="login-card">
    <a class="brand" href="/"><span class="brand-mark">◈</span><span>Board</span></a>
    <h1>Erişim</h1>
    <p>Bu alan özel. Devam etmek için şifreyi gir.</p>
    ${error}
    <form method="post" action="/login">
      <input type="hidden" name="next" value="${next}">
      <div class="field">
        <label for="password">Şifre</label>
        <input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
      </div>
      <button class="btn btn-accent" type="submit">Giriş yap</button>
    </form>
    <p class="login-note">3 hatalı denemede IP 5 saat engellenir. Oturum 30 gün sürer.</p>
  </main>
</body>
</html>`,
    options.status ?? 200,
  );
}

function notFoundPage(): Response {
  return html(
    `<!doctype html>
<html lang="tr" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Board — bulunamadı</title>
  <link rel="stylesheet" href="/assets/board.css">
</head>
<body class="login-page">
  <main class="login-card">
    <a class="brand" href="/"><span class="brand-mark">◈</span><span>Board</span></a>
    <h1>Bulunamadı</h1>
    <p>Aradığın sayfa yok veya kaldırılmış.</p>
    <a class="btn" href="/">Tüm raporlara dön</a>
  </main>
</body>
</html>`,
    404,
  );
}

/* ------------------------------------------------------------------ */
/* Statik dosyalar                                                     */
/* ------------------------------------------------------------------ */

function contentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

function serveFile(pathname: string, cache: string): Response {
  let relative = pathname.replace(/^\/+/, "");
  if (!relative || relative.endsWith("/")) relative += "index.html";

  let filePath = normalize(join(PUBLIC_DIR, relative));
  if (!filePath.startsWith(PUBLIC_DIR + sep)) {
    return withSecurityHeaders(new Response("Forbidden", { status: 403 }));
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return notFoundPage();
  }

  return withSecurityHeaders(
    new Response(Bun.file(filePath), {
      headers: {
        "Content-Type": contentType(filePath),
        "Cache-Control": cache,
      },
    }),
    cache,
  );
}

/* ------------------------------------------------------------------ */
/* İstek yönlendirme                                                   */
/* ------------------------------------------------------------------ */

async function handle(req: Request, server: any): Promise<Response> {
  const url = new URL(req.url);
  const pathname = decodeURIComponent(url.pathname);
  const ip = clientIp(req, server);

  if (pathname === "/health") {
    return new Response("ok", { headers: { "Content-Type": "text/plain" } });
  }

  if (pathname === "/robots.txt") {
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }

  if (pathname.startsWith("/assets/")) {
    return serveFile(pathname, "public, max-age=300");
  }

  if (pathname === "/login") {
    if (req.method === "POST") {
      const origin = req.headers.get("origin");
      if (origin && !isAllowedOrigin(origin, req)) {
        console.warn(
          `[board] rejected origin=${origin} host=${req.headers.get("host")} url=${req.url}`,
        );
        return html("Geçersiz istek kaynağı.", 403);
      }

      const remaining = banRemaining(ip);
      if (remaining > 0) {
        return loginPage({
          error: `Çok fazla hatalı deneme. ${formatDuration(remaining)} sonra tekrar dene.`,
          status: 429,
        });
      }

      const form = await req.formData();
      const password = String(form.get("password") ?? "");
      const next = safeNext(String(form.get("next") ?? "/"));
      const hash = getSetting("password_hash");

      let valid = false;
      if (hash && password) {
        try {
          valid = Bun.password.verifySync(password, hash);
        } catch {
          valid = false;
        }
      }

      if (!valid) {
        const result = recordFailure(ip);
        logEvent(ip, "login_fail", result.banned ? "banned" : "wrong");
        if (result.banned) {
          return loginPage({
            error: `3 hatalı deneme. IP ${BAN_HOURS} saat engellendi.`,
            status: 429,
          });
        }
        return loginPage({
          error: `Şifre yanlış. ${result.remaining} deneme hakkın kaldı.`,
          next,
          status: 401,
        });
      }

      clearFailures(ip);
      const token = createSession(req, ip);
      logEvent(ip, "login_ok");
      return redirect(next, { "Set-Cookie": cookieHeader(token) });
    }

    if (getSession(req)) return redirect("/");
    return loginPage({ next: url.searchParams.get("next") ?? "/" });
  }

  if (pathname === "/logout") {
    if (req.method !== "POST") return redirect("/");
    deleteSession(req);
    return redirect("/login", { "Set-Cookie": clearCookieHeader() });
  }

  if (!getSession(req)) {
    return redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  if (pathname === "/") {
    return serveFile("/index.html", "private, no-store");
  }

  return serveFile(pathname, "private, no-store");
}

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch(req, bunServer) {
    return handle(req, bunServer);
  },
  error(error) {
    console.error("[board] unhandled", error);
    return new Response("Internal Server Error", { status: 500 });
  },
});

console.log(`[board] listening on http://${HOST}:${server.port}`);
