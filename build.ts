import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import hljs from "highlight.js/lib/common";
import { marked } from "marked";
import { gfmHeadingId } from "marked-gfm-heading-id";
import { markedHighlight } from "marked-highlight";

const ROOT = import.meta.dir;
const REPORTS_DIR = join(ROOT, "reports");
const PUBLIC_DIR = join(ROOT, "public");
const TEMPLATES_DIR = join(ROOT, "templates");

marked.use(gfmHeadingId());
marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
);

export interface Report {
  slug: string;
  title: string;
  summary: string;
  date: string;
  tags: string[];
  html: string;
}

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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function asDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 10);
  return today();
}

function asTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function buildToc(html: string): string {
  const headings = [...html.matchAll(/<h([23])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi)];
  if (!headings.length) return "";
  const items = headings
    .map(([, level, id, text]) => {
      const label = esc(stripTags(text));
      return `<li class="toc-h${level}"><a href="#${esc(id)}">${label}</a></li>`;
    })
    .join("");
  return `<ul>${items}</ul>`;
}

function renderTemplate(file: string, vars: Record<string, string>): string {
  const template = readFileSync(join(TEMPLATES_DIR, file), "utf8");
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function loadReports(): Report[] {
  if (!existsSync(REPORTS_DIR)) return [];

  const reports: Report[] = [];

  for (const entry of readdirSync(REPORTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(REPORTS_DIR, entry.name);
    const mdPath = join(dir, "report.md");
    const htmlPath = join(dir, "report.html");

    let body = "";
    let data: Record<string, unknown> = {};

    if (existsSync(mdPath)) {
      const parsed = matter(readFileSync(mdPath, "utf8"));
      body = parsed.content;
      data = parsed.data as Record<string, unknown>;
    } else if (existsSync(htmlPath)) {
      body = readFileSync(htmlPath, "utf8");
    } else {
      continue;
    }

    if (data.draft === true) continue;

    const html = existsSync(mdPath) ? (marked.parse(body) as string) : body;
    const title = String(data.title ?? entry.name);
    const summary = String(data.summary ?? "").trim();
    const date = asDate(data.date);

    reports.push({
      slug: entry.name,
      title,
      summary,
      date,
      tags: asTags(data.tags),
      html,
    });
  }

  return reports.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    return byDate !== 0 ? byDate : a.title.localeCompare(b.title, "tr");
  });
}

function renderReport(report: Report): string {
  const tags = report.tags
    .map((tag) => `<span class="badge badge-soft">${esc(tag)}</span>`)
    .join("");

  return renderTemplate("layout.html", {
    slug: esc(report.slug),
    title: esc(report.title),
    summary: esc(report.summary),
    date: esc(report.date),
    tags,
    toc: buildToc(report.html),
    content: report.html,
  });
}

function renderIndex(reports: Report[]): string {
  const cards = reports
    .map((report) => {
      const tags = report.tags
        .map((tag) => `<span class="badge badge-soft">${esc(tag)}</span>`)
        .join("");
      return `<article class="report-card">
  <a href="/${esc(report.slug)}">
    <div class="report-card-top">
      <span class="badge">${esc(report.date)}</span>
      <span class="report-arrow">↗</span>
    </div>
    <h2>${esc(report.title)}</h2>
    <p>${esc(report.summary)}</p>
    <div class="tags">${tags}</div>
  </a>
</article>`;
    })
    .join("\n");

  const content = cards || `<div class="empty-state">Henüz yayınlanmış bir rapor yok.</div>`;

  return renderTemplate("index.html", { content });
}

export function buildReports(only?: string): Report[] {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  const reports = loadReports();
  const selected = only ? reports.filter((report) => report.slug === only) : reports;

  if (only && selected.length === 0) {
    throw new Error(`Rapor bulunamadı: ${only}`);
  }

  for (const report of selected) {
    const outDir = join(PUBLIC_DIR, report.slug);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "index.html"), renderReport(report), "utf8");

    const srcAssets = join(REPORTS_DIR, report.slug, "assets");
    const outAssets = join(outDir, "assets");
    if (existsSync(srcAssets)) {
      rmSync(outAssets, { recursive: true, force: true });
      cpSync(srcAssets, outAssets, { recursive: true });
    }
  }

  const known = new Set(reports.map((report) => report.slug));
  for (const entry of readdirSync(PUBLIC_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "assets") continue;
    if (!known.has(entry.name)) {
      rmSync(join(PUBLIC_DIR, entry.name), { recursive: true, force: true });
    }
  }

  writeFileSync(join(PUBLIC_DIR, "index.html"), renderIndex(reports), "utf8");
  writeFileSync(
    join(PUBLIC_DIR, "robots.txt"),
    "User-agent: *\nDisallow: /\n",
    "utf8",
  );

  return selected;
}

if (import.meta.main) {
  const only = process.argv[2];
  const reports = buildReports(only);
  console.log(`board: ${reports.length} rapor üretildi${only ? ` (${only})` : ""}`);
}
