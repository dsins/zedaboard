import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { buildReports, loadReports } from "./build";
import { DATA_DIR, db, setSetting } from "./lib/db";

const ROOT = import.meta.dir;
const REPORTS_DIR = join(ROOT, "reports");
const PUBLIC_DIR = join(ROOT, "public");
const BASE_URL = "https://board.zeda.dev";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function usage(): void {
  console.log(`board — rapor yayın aracı

Kullanım:
  board new <slug> --title "Başlık" [--summary "Özet"] [--tags "a,b"]
  board build [slug]
  board publish <slug>
  board list
  board url <slug>
  board delete <slug> --yes
  board passwd [--password "yeni-şifre"]

Örnek:
  board new opencode-kurulum-2jk43k --title "OpenCode Kurulum" --tags "opencode,setup"
  # reports/opencode-kurulum-2jk43k/report.md düzenle
  board publish opencode-kurulum-2jk43k
`);
}

function fail(message: string): never {
  console.error(`board: ${message}`);
  process.exit(1);
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function validateSlug(slug: string): void {
  if (!SLUG_RE.test(slug) || slug.length < 3 || slug.length > 80) {
    fail("slug 3-80 karakter, küçük harf/rakam ve tire olmalı. Örn: opencode-kurulum-2jk43k");
  }
}

function newReport(args: string[]): void {
  const slug = args[0];
  if (!slug) fail("slug gerekli. Örnek: board new opencode-kurulum-2jk43k");
  validateSlug(slug);

  const title = flag(args, "--title");
  if (!title) fail("--title gerekli");

  const summary = flag(args, "--summary") ?? "";
  const tagsRaw = flag(args, "--tags") ?? "";
  const tags = tagsRaw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const dir = join(REPORTS_DIR, slug);
  const file = join(dir, "report.md");
  if (existsSync(file)) fail(`rapor zaten var: ${file}`);

  mkdirSync(dir, { recursive: true });

  const content = `---
title: ${JSON.stringify(title)}
summary: ${JSON.stringify(summary)}
date: ${JSON.stringify(today())}
tags: ${JSON.stringify(tags)}
draft: false
---

## Özet

Kısa bir giriş. Ana bulguyu ve kararı burada söyle.

## Bulgular

| Alan | Durum | Not |
| --- | --- | --- |
| Örnek | ✅ | Açıklama |

## Detay

Gerekli detaylar, kod blokları, tablolar ve grafikler.

\`\`\`bash
echo "merhaba"
\`\`\`

> Önemli bir not.
`;

  writeFileSync(file, content, "utf8");
  console.log(`oluşturuldu: ${file}`);
  console.log(`sonraki adım: board publish ${slug}`);
}

function listReports(): void {
  const reports = loadReports();
  if (!reports.length) {
    console.log("henüz rapor yok");
    return;
  }
  for (const report of reports) {
    console.log(`${report.date}  ${report.slug.padEnd(40)}  ${report.title}`);
  }
}

function build(args: string[]): void {
  const slug = args[0];
  const reports = buildReports(slug);
  console.log(`üretildi: ${reports.length} rapor${slug ? ` (${slug})` : ""}`);
}

function publish(args: string[]): void {
  const slug = args[0];
  if (!slug) fail("slug gerekli. Örnek: board publish opencode-kurulum-2jk43k");
  validateSlug(slug);
  if (!existsSync(join(REPORTS_DIR, slug, "report.md"))) {
    fail(`rapor kaynağı yok: reports/${slug}/report.md`);
  }
  buildReports(slug);
  console.log(`${BASE_URL}/${slug}`);
}

function url(args: string[]): void {
  const slug = args[0];
  if (!slug) fail("slug gerekli");
  validateSlug(slug);
  console.log(`${BASE_URL}/${slug}`);
}

function remove(args: string[]): void {
  const slug = args[0];
  if (!slug) fail("slug gerekli");
  validateSlug(slug);

  if (!args.includes("--yes")) {
    fail("silmek için --yes ekle. Örnek: board delete <slug> --yes");
  }

  const reportDir = join(REPORTS_DIR, slug);
  const publicDir = join(PUBLIC_DIR, slug);

  if (!existsSync(reportDir)) fail(`rapor yok: ${slug}`);

  rmSync(reportDir, { recursive: true, force: true });
  rmSync(publicDir, { recursive: true, force: true });
  buildReports();
  console.log(`silindi: ${slug}`);
}

function passwd(args: string[]): void {
  const explicit = flag(args, "--password");
  const password = explicit ?? randomBytes(18).toString("base64url");

  if (password.length < 12) fail("şifre en az 12 karakter olmalı");

  setSetting("password_hash", Bun.password.hashSync(password));
  db.query("DELETE FROM sessions").run();

  const initialPath = join(DATA_DIR, "initial-password.txt");
  if (existsSync(initialPath)) rmSync(initialPath, { force: true });

  console.log("şifre güncellendi; tüm oturumlar kapatıldı.");
  if (!explicit) console.log(`yeni şifre: ${password}`);
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case "new":
    newReport(rest);
    break;
  case "build":
    build(rest);
    break;
  case "publish":
    publish(rest);
    break;
  case "list":
    listReports();
    break;
  case "url":
    url(rest);
    break;
  case "delete":
    remove(rest);
    break;
  case "passwd":
    passwd(rest);
    break;
  case "help":
  case undefined:
    usage();
    break;
  default:
    fail(`bilinmeyen komut: ${command}`);
}
