import { ICONS, UI } from "./icons.js";

// Firefox exposes the extension APIs as `browser` (promise-based), Chromium as `chrome`.
const ext = globalThis.browser ?? globalThis.chrome;
// The favicon cache API only exists in Chromium; Firefox builds use the most visited sites' icons.
const HAS_FAVICON_API = (ext.runtime.getManifest().permissions || []).includes("favicon");

/* ===================== Constants ===================== */

const PASTELS = [
  { id: "gray",   light: "#d1d1d6", dark: "#8e8e93" },
  { id: "red",    light: "#ffb3ad", dark: "#e8928b" },
  { id: "orange", light: "#ffcf9e", dark: "#e8b27a" },
  { id: "yellow", light: "#fbe49a", dark: "#dcc574" },
  { id: "green",  light: "#bde5b4", dark: "#93c78a" },
  { id: "mint",   light: "#ace3d5", dark: "#82c6b6" },
  { id: "teal",   light: "#abd9ee", dark: "#83bbd4" },
  { id: "blue",   light: "#b6cdf6", dark: "#8eabdf" },
  { id: "indigo", light: "#c9c0f3", dark: "#a69bdc" },
  { id: "purple", light: "#e2c0f1", dark: "#c39cd6" },
  { id: "pink",   light: "#f7bfd8", dark: "#d998b6" },
  { id: "brown",  light: "#dccab6", dark: "#bba68f" },
];
const LETTER_COUNT = PASTELS.length - 1;
const PASTEL_IDS = new Set(PASTELS.map((p) => p.id));
// Colors offered for page backgrounds: a very light neutral gray, then the folder pastels
// without brown and pink. With the "follows the hour" swatch first and the color picker
// last, they fill two rows of six.
const LIME = { id: "lime", light: "#dcefaa", dark: "#b6cc82" };
const BG_PASTELS = PASTELS.filter((p) => !["brown", "pink"].includes(p.id));
// Still accepted when saved by an earlier version, but no longer offered.
const BG_IDS = new Set([...BG_PASTELS.map((p) => p.id), "pink", "lime"]);

const STYLE_PREFIX = "folder:"; // storage key prefix for folder styles
const KEY_OTHER = "__other__";
const KEY_TOP = "__top__";
const KEY_SITES = "__sites__";
const SITES_LIMIT = 20; // beyond this, loose sites move into a wide card

const DEFAULT_SETTINGS = {
  theme: "auto",              // auto (follows the system) | light | dark
  focus: false,               // focus mode: only the background and the time
  focusClock: true,           // in focus mode, show the time and date
  clockFormat: "auto",        // auto (the language's usual format) | 12 | 24
  focusIcons: false,          // in focus mode, also show the sites above the search bar, as icons
  focusGray: true,            // ...in gray, as soft as the time (on by default)
  motion: 1,                  // speed of every movement (glow, rays, leaves, breeze): 0 still, 1 normal, 2 twice as fast
  glowStrength: 1,            // 0 .. 2, shown as 0-100 % with the default (1) at 50 %; multiplies the glow intensity
  colAlpha: 0.5,              // 0 .. 1
  letterIcons: false,
  hideTileNames: false,       // sites above the search bar as icons only (bigger), names in their tooltip         // a pastel letter for every site instead of its icon, for a calm, even look
  layout: "masonry",          // masonry (Mosaic, Keep-like, the default) | board (horizontal columns); wide windows only
  bg: { type: "glow", value: null }, // none | color | glow | rays (light rays); glow and rays share the color
};

const $ = (id) => document.getElementById(id);
const t = (key, ...subs) => ext.i18n.getMessage(key, subs.map(String)) || key;
const colorName = (id) => t(`c_${id}`);
const percent = new Intl.NumberFormat(ext.i18n.getUILanguage(), { style: "percent" });
// The welcome screen while it is open (see Welcome, below).
const welcome = { el: null, slide: 1, inert: [] };

const els = {
  search: $("search"),
  searchLabel: document.querySelector(".search"),
  searchEnter: $("search-enter"),
  barRow: $("bar-row"),
  board: $("board"),
  prev: $("nav-prev"),
  next: $("nav-next"),
  empty: $("empty-state"),
  popover: $("popover"),
  settingsBtn: $("settings-btn"),
  focusBtn: $("focus-btn"),
  awakeBtn: $("awake-btn"),
  focusView: $("focus-view"),
  page: document.querySelector(".page"),
  fileImport: $("file-import"),
};

const state = {
  bar: null,
  other: null,
  topSites: [],
  folderStyles: Object.create(null), // title -> { icon, color } (no prototype: titles are untrusted keys)
  settings: structuredClone(DEFAULT_SETTINGS),
  order: [],                 // column keys, user order
  hidden: [],                // column keys hidden
  open: new Set(),           // expanded subfolder ids
  openCols: new Set(),       // expanded columns in stacked layout
  closedCols: new Set(),     // collapsed columns in wide layouts (Mosaic, Board)
  highlighted: [],           // URLs of bookmarks pinned above the search bar (loose or inside folders)
  pinAfter: Object.create(null), // where each pinned tile sits among the loose sites: URL of the site it follows ("" = first)
  byId: new Map(),           // bookmark id → node, for the bars' and folders' children
  query: "",
  target: null,              // the single remaining link while filtering
};

const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const narrowQuery = matchMedia("(max-width: 640px)");

/* ===================== Helpers ===================== */

function svg(path, cls) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 -960 960 960");
  s.setAttribute("aria-hidden", "true");
  if (cls) s.setAttribute("class", cls);
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", path);
  s.append(p);
  return s;
}

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
}

const normalize = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function hash(str) {
  let x = 0;
  for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(x);
}

const isDark = () => {
  const theme = state.settings.theme;
  return theme === "dark" || (theme !== "light" && darkQuery.matches);
};
// The resolved theme is set on <html> (CSS reads it) and remembered for the next
// page load, so theme-boot.js can apply it before the first paint.
function applyTheme() {
  const theme = isDark() ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try { localStorage.setItem("restart-theme", state.settings.theme); } catch { /* storage unavailable */ }
}
// A folder color is a pastel id, or a custom "#rrggbb" picked by the user (a little deeper in dark mode, like the pastels).
const pastelOf = (id) => HEX_COLOR.test(id)
  ? { id, light: id, dark: rgbToHex(...mixRgb(rgbOf(id), [0, 0, 0], 0.12).map(Math.round)) }
  : PASTELS.find((c) => c.id === id) || (id === LIME.id ? LIME : PASTELS[0]);
const pastel = (id) => (isDark() ? pastelOf(id).dark : pastelOf(id).light);
const isWebUrl = (url) => /^(https?|ftp|file):/i.test(url);
// URLs a new tab page must never open: bookmarklets and inline documents.
const isScriptUrl = (url) => /^\s*(javascript|data|vbscript|blob):/i.test(url || "");
// Text from bookmarks, tab titles or imported files is untrusted. It is only ever
// inserted as text (never as HTML); here we also drop control and bidi-override
// characters (used to disguise text) and cap the length.
const MAX_TEXT = 300;
const cleanText = (value) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
  .slice(0, MAX_TEXT);

const hasIcon = (name) => typeof name === "string" && Object.hasOwn(ICONS, name);

// All settings live in the extension's local storage, on this device only.
// (Moving them to another device is done with Export / Import.)
const store = ext.storage.local;
const isPrefKey = (k) => ["settings", "order", "hidden", "highlighted", "pinAfter"].includes(k) || k.startsWith(STYLE_PREFIX);

// Where pinned tiles sit among the loose sites: { pinned URL: URL of the loose site it follows,
// or "" for the start }. Only strings, a bounded number of entries, no inherited keys.
function sanitizePinAfter(raw) {
  const out = Object.create(null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (n >= 1000) break;
    if (typeof v !== "string" || !k || k.length > 4096 || v.length > 4096) continue;
    out[k] = v;
    n++;
  }
  return out;
}
const saveLocal = (items) => store.set(items).catch((e) => console.warn("ReStart: could not save settings", e));

function openUrl(url, { newTab = false } = {}) {
  if (!url || isScriptUrl(url)) return; // bookmarklets can't run from a new tab page
  // Some internal pages can't be opened by extensions (Firefox refuses most about: pages).
  const fail = (e) => console.warn("ReStart: could not open", e);
  if (newTab) ext.tabs.create({ url, active: false }).catch(fail);
  else if (isWebUrl(url)) location.href = url;
  else ext.tabs.update({ url }).catch(fail);
}

/* ===================== Favicons ===================== */

function faviconUrl(pageUrl, size) {
  const u = new URL(ext.runtime.getURL("/_favicon/"));
  u.searchParams.set("pageUrl", pageUrl);
  u.searchParams.set("size", String(size));
  return u.toString();
}

// The favicon API returns a generic globe when it has nothing for a URL:
// fingerprint that image once and treat matches as "no favicon".
const fingerprints = new Map();
function fingerprint(img) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, 16, 16);
  return c.toDataURL();
}
function defaultFingerprint(size) {
  if (!fingerprints.has(size)) {
    fingerprints.set(size, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(fingerprint(img));
      img.onerror = () => resolve(null);
      img.src = faviconUrl("https://no-favicon.invalid/", size);
    }));
  }
  return fingerprints.get(size);
}

// A pastel square with a letter. Its color comes from the site's address, so a site keeps the
// same color everywhere. The letter is the site's (its host); with "letters instead of site
// icons", it is the bookmark's name instead, since that is what is read next to it.
function letterBadge(title, url) {
  const host = hostOf(url);
  const source = state.settings.letterIcons ? cleanText(title) || host : host || title;
  const ch = (source || "?").replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toLocaleUpperCase() || "?";
  const p = PASTELS[1 + (hash(host || title || "") % LETTER_COUNT)];
  return h("span", { class: "letter", style: `background-color:${isDark() ? p.dark : p.light}` }, ch);
}

// Firefox: icons of the most visited sites, as data: URLs returned by the
// topSites API (nothing is downloaded). Keyed by full URL and by host, so a
// bookmark to any page of a frequently visited site gets its icon.
const siteIcons = new Map();
const isImageData = (v) => typeof v === "string" && v.length < 200_000 && /^data:image\/(png|x-icon|vnd\.microsoft\.icon|svg\+xml|gif|jpeg|webp);/i.test(v);
async function loadSiteIcons() {
  if (HAS_FAVICON_API) return;
  try {
    const sites = await ext.topSites.get({ limit: 100, includeFavicon: true, onePerDomain: false });
    for (const s of sites) {
      if (!isImageData(s.favicon) || !isWebUrl(s.url)) continue;
      if (!siteIcons.has(s.url)) siteIcons.set(s.url, s.favicon);
      const host = hostOf(s.url);
      if (host && !siteIcons.has(host)) siteIcons.set(host, s.favicon);
    }
  } catch (e) {
    console.warn("ReStart: site icons unavailable", e);
  }
}

// Site icon from the browser, or a colored letter when there is none (or when the
// "letters instead of site icons" option is on).
function favicon(url, title, size) {
  if (state.settings.letterIcons || !isWebUrl(url)) return letterBadge(title, url);
  if (!HAS_FAVICON_API) {
    const data = siteIcons.get(url) || siteIcons.get(hostOf(url));
    if (!data) return letterBadge(title, url);
    const img = h("img", { class: "fav", alt: "", decoding: "async", draggable: "false" });
    img.addEventListener("error", () => img.replaceWith(letterBadge(title, url)), { once: true });
    img.src = data;
    return img;
  }
  const img = h("img", { class: "fav", alt: "", decoding: "async", draggable: "false" });
  img.addEventListener("load", async () => {
    const ref = await defaultFingerprint(size);
    if (ref && img.isConnected && fingerprint(img) === ref) img.replaceWith(letterBadge(title, url));
  }, { once: true });
  img.addEventListener("error", () => img.replaceWith(letterBadge(title, url)), { once: true });
  img.src = faviconUrl(url, size);
  return img;
}

/* ===================== Text highlight ===================== */

function highlighted(text, tokens) {
  text = cleanText(text);
  if (!tokens.length) return document.createTextNode(text);
  const lower = text.toLowerCase();
  const ranges = [];
  for (const t of tokens) {
    let i = lower.indexOf(t);
    while (i !== -1) { ranges.push([i, i + t.length]); i = lower.indexOf(t, i + t.length); }
  }
  if (!ranges.length) return document.createTextNode(text);
  ranges.sort((a, b) => a[0] - b[0]);
  const frag = document.createDocumentFragment();
  let pos = 0;
  for (const [s, e] of ranges) {
    if (s < pos) continue;
    frag.append(text.slice(pos, s), h("mark", {}, text.slice(s, e)));
    pos = e;
  }
  frag.append(text.slice(pos));
  return frag;
}

/* ===================== Filtering ===================== */

const tokensOf = (q) => normalize(q).split(/\s+/).filter(Boolean);

function matches(node, tokens) {
  const hay = normalize(`${node.title} ${node.url || ""}`);
  return tokens.every((t) => hay.includes(t));
}

function filterChildren(children, tokens) {
  if (!tokens.length) return children;
  const out = [];
  for (const c of children) {
    if (c.url) { if (matches(c, tokens)) out.push(c); continue; }
    if (matches(c, tokens)) { out.push({ ...c, _forceOpen: true }); continue; }
    const kids = filterChildren(c.children || [], tokens);
    if (kids.length) out.push({ ...c, children: kids, _forceOpen: true });
  }
  return out;
}

function collectLinks(node, out = []) {
  for (const c of node.children || []) c.url ? out.push(c) : collectLinks(c, out);
  return out;
}
const countLinks = (node) => collectLinks(node).length;

/* ===================== Folder glyph ===================== */

function folderGlyph(title, { icon, color } = state.folderStyles[title] || {}) {
  const wrap = h("span", { class: "folder-glyph" });
  const shape = svg(UI.folderShape, "shape");
  shape.style.fill = color ? pastel(color) : "var(--folder-default)";
  wrap.append(shape);
  if (hasIcon(icon)) wrap.append(svg(ICONS[icon], "sym"));
  return wrap;
}
const sitesGlyph = () => {
  const g = folderGlyph(null, {});
  g.append(svg(ICONS.bookmark, "sym"));
  return g;
};
const looseSites = () => state.bar.children.filter((c) => c.url);
// Almost no bookmarks yet: the page leans on the most visited sites and invites the
// user to build it (see the wide "Most visited" card and the start hint).
const SPARSE_BELOW = 3;
const isSparse = () => collectLinks(state.bar).length + collectLinks(state.other || {}).length < SPARSE_BELOW;
const sitesOverflow = () => looseSites().length > SITES_LIMIT;

// The tiles above the search bar: the loose sites (all of them, or only the pinned
// ones once there are too many), then the bookmarks pinned from folders and
// subfolders, in the order they appear in the bookmarks. Each URL is shown once.
function topRowSites() {
  const pinned = new Set(state.highlighted);
  const overflow = sitesOverflow();
  const loose = overflow ? [] : looseSites();
  const seen = new Set(loose.map((c) => c.url));
  const out = [];
  if (overflow) for (const c of looseSites()) if (pinned.has(c.url) && !seen.has(c.url)) { seen.add(c.url); out.push(c); }
  const walk = (node, depth = 0) => {
    if (depth > 64) return; // guard against pathological nesting
    for (const c of node.children || []) {
      if (c.url) {
        if (pinned.has(c.url) && !seen.has(c.url)) { seen.add(c.url); out.push(c); }
      } else walk(c, depth + 1);
    }
  };
  for (const c of state.bar.children) if (!c.url) walk(c);
  if (state.other) walk(state.other);
  // Pinned sites follow the order they were pinned or arranged in.
  const rank = (c) => state.highlighted.indexOf(c.url);
  out.sort((a, b) => rank(a) - rank(b));
  if (!loose.length) return out;
  // Loose sites keep the order of the bookmarks bar; each pinned site sits right after the
  // loose site it was placed after (or first), and at the end when it was never placed.
  const at = (c) => state.pinAfter[c.url];
  const looseUrls = new Set(loose.map((c) => c.url));
  const seq = out.filter((p) => at(p) === "");
  for (const c of loose) seq.push(c, ...out.filter((p) => at(p) === c.url));
  seq.push(...out.filter((p) => at(p) !== "" && !looseUrls.has(at(p))));
  return seq;
}

// A loose site is a bookmark of the bookmarks bar shown as a tile: it moves in the bookmarks bar
// itself. Pinned sites only change their place among the tiles (kept in ReStart).
const isLooseTile = (c) => !sitesOverflow() && c.parentId === state.bar.id;

// Put a tile before or after another one. Every tile can go anywhere: a loose site moves in the
// bookmarks bar (next to the closest loose site), and each pinned site remembers which loose
// site it follows, so the row looks exactly as it was arranged.
function placeTile(node, target, after) {
  if (node === target) return;
  const seq = topRowSites().filter((c) => c !== node);
  const i = seq.indexOf(target);
  if (i === -1) return;
  seq.splice(i + (after ? 1 : 0), 0, node);
  const pins = seq.filter((c) => !isLooseTile(c)).map((c) => c.url);
  state.highlighted = [...pins, ...state.highlighted.filter((u) => !pins.includes(u))];
  const pinAfter = Object.create(null);
  let last = "";
  for (const c of seq) {
    if (isLooseTile(c)) last = c.url;
    else pinAfter[c.url] = last;
  }
  state.pinAfter = pinAfter;
  saveLocal({ highlighted: state.highlighted, pinAfter });
  syncPinnedOrder(seq);
  if (isLooseTile(node)) {
    const k = seq.indexOf(node);
    const next = seq.slice(k + 1).find(isLooseTile);
    const prev = seq.slice(0, k).reverse().find(isLooseTile);
    const loose = looseSites();
    const j = loose.indexOf(node);
    // Move in the bookmarks bar only when its order among the loose sites changes.
    if (next && loose[j + 1] !== next) moveBookmark(node, next, false);
    else if (!next && prev && loose[j - 1] !== prev) moveBookmark(node, prev, true);
  }
  render();
}

// Pinned bookmarks that share a folder follow, in that folder, the order of their tiles: they
// swap the places they already hold there, so the other bookmarks don't move.
async function syncPinnedOrder(seq) {
  const groups = new Map();
  for (const c of seq) {
    if (isLooseTile(c) || !c.id || !c.parentId || c.unmodifiable) continue;
    groups.set(c.parentId, [...(groups.get(c.parentId) || []), c.id]);
  }
  for (const [parentId, wanted] of groups) {
    if (wanted.length < 2) continue;
    try {
      const ids = (await ext.bookmarks.getChildren(parentId)).map((c) => c.id);
      const ordered = [...new Set(wanted)].filter((id) => ids.includes(id));
      let k = 0;
      const next = ids.map((id) => (ordered.includes(id) ? ordered[k++] : id));
      if (next.some((id, i) => id !== ids[i])) await applyChildOrder(parentId, next);
    } catch (e) {
      console.warn("ReStart: move failed", e);
      scheduleReload();
    }
  }
}

function moveTile(node, delta) {
  const sibs = topRowSites();
  const target = sibs[sibs.indexOf(node) + delta];
  if (target) placeTile(node, target, delta > 0);
}

// An address typed by the user: a web address without its scheme gets https://. Scripts and
// inline documents are refused, like anything that is not a valid URL.
function normalizeUrl(value) {
  let v = String(value || "").trim();
  if (!v || v.length > 8192 || /[\u0000-\u001f\u007f]/.test(v)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = `https://${v}`;
  if (isScriptUrl(v)) return null;
  try {
    const u = new URL(v);
    if (/^(https?|ftp):$/.test(u.protocol) && !u.hostname) return null;
    return u.href;
  } catch {
    return null;
  }
}

// A pinned bookmark whose address changes stays pinned, at the same place.
function renamePinnedUrl(from, to) {
  if (!state.highlighted.includes(from) && !Object.values(state.pinAfter).includes(from)) return;
  state.highlighted = state.highlighted.map((u) => (u === from ? to : u));
  const pinAfter = Object.create(null);
  for (const [k, v] of Object.entries(state.pinAfter)) pinAfter[k === from ? to : k] = v === from ? to : v;
  state.pinAfter = pinAfter;
  saveLocal({ highlighted: state.highlighted, pinAfter });
}

/* ----- Moving bookmarks and folders, for real ----- */
// ReStart presents the bookmarks: reordering moves the browser's own bookmarks and
// folders, like renaming or deleting them. ReStart keeps no order of its own.

// Reorder a folder's children to `ids`. Moves run from left to right and only ever
// leftward, where every browser reads the target index the same way.
async function applyChildOrder(parentId, ids) {
  const cur = (await ext.bookmarks.getChildren(parentId)).map((c) => c.id);
  for (let k = 0; k < ids.length; k++) {
    const i = cur.indexOf(ids[k]);
    if (i === -1 || i === k) continue;
    await ext.bookmarks.move(ids[k], { parentId, index: k });
    cur.splice(i, 1);
    cur.splice(k, 0, ids[k]);
  }
}

// Show the new order at once; the reload after the browser's change events confirms it.
function showOrder(parent, children) {
  parent.children = children;
  render();
  refreshSettings();
}

// Put `node` just before or after `target`, in the same folder.
async function moveBookmark(node, target, after) {
  if (node === target || !node.parentId || !target.parentId) return;
  if (node.parentId !== target.parentId) return moveAcross(node, target, after);
  const parent = state.byId.get(node.parentId);
  if (parent) {
    const kids = parent.children.filter((c) => c !== node);
    kids.splice(kids.indexOf(target) + (after ? 1 : 0), 0, node);
    showOrder(parent, kids);
  }
  try {
    const ids = (await ext.bookmarks.getChildren(node.parentId)).map((c) => c.id).filter((id) => id !== node.id);
    const at = ids.indexOf(target.id);
    if (at === -1) return scheduleReload();
    ids.splice(at + (after ? 1 : 0), 0, node.id);
    await applyChildOrder(node.parentId, ids);
  } catch (e) {
    console.warn("ReStart: move failed", e);
    scheduleReload();
  }
}

// Into another folder, next to `target`.
async function moveAcross(node, target, after) {
  const to = state.byId.get(target.parentId);
  if (!canMoveInto(node, to)) return;
  const from = state.byId.get(node.parentId);
  if (from) from.children = from.children.filter((c) => c !== node);
  const kids = to.children.filter((c) => c !== node);
  kids.splice(kids.indexOf(target) + (after ? 1 : 0), 0, node);
  node.parentId = to.id;
  showOrder(to, kids);
  try {
    const fresh = await ext.bookmarks.getChildren(to.id);
    const at = fresh.findIndex((c) => c.id === target.id);
    await ext.bookmarks.move(node.id, at === -1 ? { parentId: to.id } : { parentId: to.id, index: at + (after ? 1 : 0) });
  } catch (e) {
    console.warn("ReStart: move failed", e);
    scheduleReload();
  }
}

// At the end of another folder.
async function moveInto(node, folder) {
  if (!canMoveInto(node, folder)) return;
  const from = state.byId.get(node.parentId);
  if (from) from.children = from.children.filter((c) => c !== node);
  node.parentId = folder.id;
  showOrder(folder, [...(folder.children || []).filter((c) => c !== node), node]);
  try {
    await ext.bookmarks.move(node.id, { parentId: folder.id });
  } catch (e) {
    console.warn("ReStart: move failed", e);
    scheduleReload();
  }
}

// Every folder something can be moved to: the bookmarks bar and its folders, Other bookmarks,
// with their subfolders; never the thing itself or what it contains.
function folderTargets(moving) {
  const out = [];
  const walk = (f, depth) => {
    if (!f || f === moving || f.unmodifiable || depth > 12) return;
    out.push({ f, depth });
    for (const c of f.children || []) if (isFolder(c)) walk(c, depth + 1);
  };
  walk(state.bar, 0);
  walk(state.other, 0);
  return out;
}

// "Move to…": the list of folders, the current one disabled.
function showMoveTo(node, x, y) {
  const list = h("div", { class: "menu-scroll" }, ...folderTargets(node).map(({ f, depth }) =>
    h("button", {
      class: "menu-item", role: "menuitem",
      style: `padding-left:${10 + depth * 14}px`,
      disabled: f.id === node.parentId || null,
      onclick: () => { closePopover({ restoreFocus: false }); moveInto(node, f); },
    }, svg(f === state.bar ? UI.bookmarkFill : ICONS.folder), h("span", { class: "menu-label" }, cleanText(f.title) || t("bookmarksBar")))));
  els.popover.replaceChildren(h("div", { class: "pop-section" }, t("moveTo")), list);
  els.popover.querySelector(".menu-item:not([disabled])")?.focus();
  placeAt(x, y);
}


// Columns: the folders of the bookmarks bar move in the bar, in the slots folders
// already occupy, so loose sites and separators stay where they are.
const isFolder = (c) => !c.url && c.type !== "separator";
async function reorderBarFolders(titles) {
  const bar = state.bar;
  const byTitle = new Map();
  for (const c of bar.children) if (!c.url) byTitle.set(c.title, [...(byTitle.get(c.title) || []), c]);
  const seq = [...new Set(titles)].flatMap((title) => byTitle.get(title) || []);
  for (const c of bar.children) if (!c.url && !seq.includes(c)) seq.push(c);
  let j = 0;
  showOrder(bar, bar.children.map((c) => (c.url ? c : seq[j++])));
  try {
    const fresh = await ext.bookmarks.getChildren(bar.id);
    const freshIds = new Set(fresh.filter(isFolder).map((c) => c.id));
    const seqIds = seq.map((c) => c.id).filter((id) => freshIds.has(id));
    for (const c of fresh) if (isFolder(c) && !seqIds.includes(c.id)) seqIds.push(c.id);
    let k = 0;
    await applyChildOrder(bar.id, fresh.map((c) => (isFolder(c) ? seqIds[k++] : c.id)));
  } catch (e) {
    console.warn("ReStart: move failed", e);
    scheduleReload();
  }
}

let dragItem = null;

// A folder can't go inside itself or one of its subfolders; managed (policy) bookmarks don't move.
function canMoveInto(node, folder) {
  if (!node || !folder || node.unmodifiable || folder.unmodifiable || !isFolder(folder)) return false;
  for (let id = folder.id, d = 0; id && d < 70; id = state.byId.get(id)?.parentId, d++) if (id === node.id) return false;
  return true;
}

function clearDropMarks() {
  document.querySelectorAll(".dragging, .drop-before, .drop-after, .drop-into")
    .forEach((n) => n.classList.remove("dragging", "drop-before", "drop-after", "drop-into"));
}

// Drag a bookmark or a subfolder (by its row): above or below another bookmark, in the same
// folder or another one, or into a subfolder (middle of its row) or a column. It moves in the
// browser's bookmarks.
function wireItemDrag(row, node, source = row) {
  source.draggable = true;
  source.addEventListener("dragstart", (e) => {
    if (e.target !== source) return;
    e.stopPropagation();
    dragItem = node;
    e.dataTransfer.effectAllowed = "copyMove";
    if (node.url) e.dataTransfer.setData("text/uri-list", node.url);
    e.dataTransfer.setData("text/plain", node.url || node.title || "");
    requestAnimationFrame(() => source.classList.add("dragging"));
  });
  source.addEventListener("dragend", (e) => {
    if (e.target !== source) return;
    dragItem = null;
    clearDropMarks();
  });
  const zone = (e) => {
    if (!dragItem || dragItem === node) return null;
    const r = row.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    const intoOk = !node.url && canMoveInto(dragItem, node);
    const sideOk = canMoveInto(dragItem, state.byId.get(node.parentId));
    if (intoOk && (y > 0.25 && y < 0.75 || !sideOk)) return "into";
    if (!sideOk) return null;
    return y < 0.5 ? "before" : "after";
  };
  row.addEventListener("dragover", (e) => {
    const z = zone(e);
    if (!z) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    row.classList.toggle("drop-before", z === "before");
    row.classList.toggle("drop-after", z === "after");
    row.classList.toggle("drop-into", z === "into");
  });
  row.addEventListener("dragleave", (e) => { if (!row.contains(e.relatedTarget)) row.classList.remove("drop-before", "drop-after", "drop-into"); });
  row.addEventListener("drop", (e) => {
    const z = zone(e);
    if (!z) return;
    e.preventDefault();
    e.stopPropagation();
    const moving = dragItem;
    clearDropMarks();
    if (z === "into") moveInto(moving, node);
    else moveBookmark(moving, node, z === "after");
  });
}

// A column (or the row of tiles) as a drop target: the bookmark goes at the end of that folder.
function wireDropInto(el, folder) {
  el.addEventListener("dragover", (e) => {
    if (!dragItem || !canMoveInto(dragItem, folder)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    el.classList.add("drop-into");
  });
  el.addEventListener("dragleave", (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove("drop-into"); });
  el.addEventListener("drop", (e) => {
    if (!dragItem || !canMoveInto(dragItem, folder)) return;
    e.preventDefault();
    const moving = dragItem;
    clearDropMarks();
    moveInto(moving, folder);
  });
}

const topGlyph = () => {
  const g = folderGlyph(null, {});
  g.append(svg(UI.trending, "sym"));
  return g;
};

/* ===================== Rendering ===================== */

function bookmarkLink(node, tokens, { cls = "item" } = {}) {
  const scriptUrl = isScriptUrl(node.url);
  const a = h("a", {
    class: cls,
    href: scriptUrl ? null : node.url, // bookmarklets are shown but never made clickable
    "aria-disabled": scriptUrl ? "true" : null,
    title: `${cleanText(node.title || node.url)}\n${cleanText(node.url)}`,
  });
  if (cls === "tile") {
    a.append(h("span", { class: "fav-box" }, favicon(node.url, node.title, 64)),
             h("span", { class: "tile-label" }, highlighted(node.title || hostOf(node.url), tokens)));
  } else {
    a.append(favicon(node.url, node.title, 32),
             h("span", { class: "item-title" }, highlighted(node.title || hostOf(node.url) || node.url, tokens)));
  }
  if (cls === "item" && state.byId.has(node.parentId) && !tokens.length && !node.unmodifiable) wireItemDrag(a, node);
  // Right-click: actions on bookmarks; "Most visited" entries can be added to the bookmarks.
  if (node.id) {
    const topSite = String(node.id).startsWith("top-");
    a.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      (topSite ? openTopSiteMenu : openBookmarkMenu)(node, a, e.clientX, e.clientY);
    });
  }
  // Internal pages (brave://, chrome://) can't be opened by a plain link from an extension page.
  if (!isWebUrl(node.url) && !isScriptUrl(node.url)) {
    a.addEventListener("click", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      openUrl(node.url, { newTab: e.metaKey || e.ctrlKey || e.shiftKey });
    });
  }
  return a;
}

// Folders without any bookmark (even deep inside) are not shown.
const renderChildren = (children, tokens) =>
  children.filter((c) => c.url || countLinks(c) > 0)
    .map((c) => (c.url ? bookmarkLink(c, tokens) : renderSubfolder(c, tokens)));

function renderSubfolder(node, tokens) {
  const isOpen = node._forceOpen || state.open.has(node.id);
  const wrap = h("div", { class: `sub${isOpen ? " open" : ""}` });
  const inner = h("div", { class: "inner" });
  let rendered = false;
  const fill = () => { if (!rendered) { inner.append(...renderChildren(node.children || [], tokens)); rendered = true; } };
  if (isOpen) fill();

  const toggle = h("button", {
    class: "item sub-toggle",
    "aria-expanded": String(isOpen),
    onclick: () => {
      const open = !wrap.classList.contains("open");
      if (open) fill();
      wrap.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      if (!tokens.length) {
        open ? state.open.add(node.id) : state.open.delete(node.id);
        store.set({ open: [...state.open] });
      }
    },
  },
    svg(UI.chevron, "chev"),
    svg(UI.subfolder, "sub-ico"),
    h("span", { class: "item-title" }, highlighted(node.title, tokens)),
    h("span", { class: "sub-count" }, String(countLinks(node))),
  );
  toggle.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openFolderMenu(node, toggle, e.clientX, e.clientY);
  });
  wrap.append(toggle, h("div", { class: "sub-children" }, inner));
  if (state.byId.has(node.parentId) && node.parentId !== state.bar.id && !tokens.length && !node.unmodifiable) wireItemDrag(toggle, node, wrap);
  return wrap;
}

/* ----- Columns ----- */

function renderColumn(col, tokens) {
  const { key, title, children, total, customizable, glyph, colorId, kind, node, spotlight } = col;
  const filtering = tokens.length > 0;

  const glyphBtn = h("button", {
    class: "folder-btn",
    "aria-label": customizable ? t("customizeIconOf", cleanText(title)) : cleanText(title),
    title: customizable ? t("customizeIcon") : null,
    disabled: !customizable,
    onclick: customizable ? (e) => openIconPicker(e.currentTarget, title) : null,
  }, glyph);

  const body = kind === "sites"
    ? h("div", { class: "col-body" }, h("div", { class: "tiles-grid" },
      children.map((c) => bookmarkLink(c, tokens, { cls: "tile" }))))
    : h("div", { class: "col-body" },
      children.length ? renderChildren(children, tokens) : h("div", { class: "col-empty" }, t("emptyFolder")));

  const stacked = narrowQuery.matches;
  // The wide Most visited card is the whole page: always open.
  // Wide layouts: open unless collapsed with its button. Narrow: closed unless opened.
  const expanded = filtering || spotlight || (stacked ? state.openCols.has(key) : !state.closedCols.has(key));
  const el = h("article", { class: `column${expanded ? "" : " collapsed"}${kind === "sites" ? " wide sites" : ""}${spotlight ? " spotlight" : ""}`, "data-key": key });
  if (node && !filtering) wireDropInto(el, node);
  if (spotlight) el.style.setProperty("--per-row", String(balancedPerRow(children.length, 10)));
  if (colorId) { el.classList.add("tinted"); el.style.setProperty("--tint", pastel(colorId)); }

  const toggle = h("button", {
    class: "col-toggle",
    tabindex: stacked ? null : "-1",
    "aria-expanded": String(expanded),
    onclick: () => {
      if (!narrowQuery.matches || filtering || spotlight) return;
      const open = el.classList.toggle("collapsed") === false;
      toggle.setAttribute("aria-expanded", String(open));
      open ? state.openCols.add(key) : state.openCols.delete(key);
      store.set({ openCols: [...state.openCols] });
    },
  },
    h("span", { class: "col-title", title: cleanText(title) }, highlighted(title, tokens)),
    h("span", { class: "col-count" }, String(total)),
    svg(UI.chevron, "col-chev"));

  // Wide layouts: a small button collapses the folder, in place of the count (which it
  // keeps in its tooltip). Not while filtering, and not on the Most visited card shown alone.
  const collapsible = !filtering && !spotlight && kind !== "sites";
  const label = () => `${t(el.classList.contains("collapsed") ? "expand" : "collapse")} (${total})`;
  const collapseBtn = collapsible ? h("button", {
    class: "col-collapse", type: "button", "aria-expanded": String(expanded),
    onclick: (e) => {
      e.stopPropagation();
      const open = el.classList.toggle("collapsed") === false;
      collapseBtn.setAttribute("aria-expanded", String(open));
      collapseBtn.title = label();
      collapseBtn.setAttribute("aria-label", label());
      open ? state.closedCols.delete(key) : state.closedCols.add(key);
      store.set({ closedCols: [...state.closedCols] });
      // Mosaic: lay the cards out again, so a folded card no longer leaves a hole below it.
      if (els.board.classList.contains("masonry")) relayoutSmoothly();
    },
  }, svg(UI.chevron)) : null;
  if (collapseBtn) { collapseBtn.title = label(); collapseBtn.setAttribute("aria-label", label()); }
  // Folded, a folder also offers to hide it altogether (shown again from Settings › Columns).
  const hideBtn = collapsible ? h("button", {
    class: "col-hide", type: "button", title: t("hideColumn"), "aria-label": t("hideColumn"),
    onclick: (e) => {
      e.stopPropagation();
      state.hidden = [...state.hidden.filter((k) => k !== key), key];
      saveLocal({ hidden: state.hidden });
      relayoutSmoothly();
    },
  }, svg(ICONS.visibility)) : null;

  const head = h("header", { class: "col-head", draggable: filtering ? null : "true" },
    glyphBtn, toggle, hideBtn, collapseBtn);
  // Right-click on a folder's header: rename or delete the folder (not on Other bookmarks).
  if (node && node.id !== state.other?.id) {
    head.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openFolderMenu(node, toggle, e.clientX, e.clientY);
    });
  }
  el.append(head, body);
  if (!filtering) wireDrag(el, head);
  return el;
}

function columnModels(tokens) {
  const filtering = tokens.length > 0;
  const models = [];
  const pushFolder = (node, key) => {
    const folderMatch = filtering && matches(node, tokens);
    const kids = folderMatch ? node.children || [] : filterChildren(node.children || [], tokens);
    if (filtering && !kids.length && !folderMatch) return;
    if (!countLinks(node)) return; // empty folders are hidden
    const style = state.folderStyles[node.title] || {};
    models.push({
      key,
      title: node.title,
      children: kids,
      total: filtering ? countLinks({ children: kids }) : countLinks(node),
      customizable: true,
      node,
      glyph: folderGlyph(node.title),
      colorId: style.color || null,
    });
  };

  if (sitesOverflow()) {
    const rest = looseSites().filter((c) => !state.highlighted.includes(c.url));
    const sites = rest.filter((c) => !filtering || matches(c, tokens));
    if (sites.length || (!filtering && rest.length)) {
      models.push({
        key: KEY_SITES, kind: "sites", title: state.bar.title, children: sites, total: sites.length,
        customizable: false, glyph: sitesGlyph(), colorId: null,
      });
    }
  }

  for (const c of state.bar.children) if (!c.url) pushFolder(c, c.title);
  if (state.other) pushFolder(state.other, KEY_OTHER);

  if (!state.hidden.includes(KEY_TOP) && state.topSites.length) {
    // When it would be the only column (no folder to show, and the bar's sites fit above the
    // search bar), the most visited sites take the stage: a wider card, as tiles.
    const shown = (key, node) => countLinks(node) > 0 && !state.hidden.includes(key);
    const sparse = !sitesOverflow()
      && !state.bar.children.some((c) => !c.url && shown(c.title, c))
      && !(state.other && shown(KEY_OTHER, state.other));
    const all = state.topSites.slice(0, sparse ? 20 : 10).map((s) => ({ id: `top-${s.url}`, title: s.title, url: s.url }));
    const sites = all.filter((s) => !filtering || matches(s, tokens));
    if (sites.length || !filtering) {
      models.push({
        key: KEY_TOP, title: t("mostVisited"), children: sites, total: sites.length,
        customizable: false, glyph: topGlyph(), colorId: null, kind: sparse ? "sites" : undefined, spotlight: sparse,
      });
    }
  }

  const seq = allColumnKeys();
  const visible = models.filter((m) => !state.hidden.includes(m.key));
  return visible.sort((a, b) => seq.indexOf(a.key) - seq.indexOf(b.key));
}

// Folder columns follow the bookmarks bar. The other columns (bar sites, Other bookmarks,
// Most visited) are not folders of the bar: ReStart remembers where they sit, after which folder.
const SPECIAL_KEYS = new Set([KEY_SITES, KEY_OTHER, KEY_TOP]);
function orderColumns(keys) {
  const folders = keys.filter((k) => !SPECIAL_KEYS.has(k));
  const specials = keys.filter((k) => SPECIAL_KEYS.has(k));
  const known = new Set(folders);
  const anchorOf = (s) => {
    const i = state.order.indexOf(s);
    if (i === -1) return s === KEY_SITES ? null : undefined; // defaults: bar sites first, the others last
    for (let j = i - 1; j >= 0; j--) if (known.has(state.order[j])) return state.order[j];
    return null;
  };
  const anchors = new Map(specials.map((s) => [s, anchorOf(s)]));
  const rank = (s) => { const i = state.order.indexOf(s); return i === -1 ? Infinity : i; };
  const at = (a) => specials.filter((s) => anchors.get(s) === a).sort((x, y) => rank(x) - rank(y));
  return [...at(null), ...folders.flatMap((f) => [f, ...at(f)]), ...at(undefined)];
}

// Every column the user can show, hide or move, in display order (hidden ones included).
function allColumnKeys() {
  const keys = sitesOverflow() ? [KEY_SITES] : [];
  keys.push(...state.bar.children.filter((c) => !c.url).map((c) => c.title));
  if (state.other?.children?.length) keys.push(KEY_OTHER);
  keys.push(KEY_TOP);
  return orderColumns([...new Set(keys)]);
}

// A new column order: folders move in the bookmarks bar, the other columns are remembered.
function saveOrder(keys) {
  state.order = keys;
  saveLocal({ order: keys });
  reorderBarFolders(keys.filter((k) => !SPECIAL_KEYS.has(k)));
}

function render() {
  if (!state.bar) return;
  const tokens = tokensOf(state.query);
  const filtering = tokens.length > 0;

  // Keep the sites row's height while filtering so the search bar below doesn't jump.
  if (filtering && !els.barRow.style.minHeight && els.barRow.offsetHeight) {
    els.barRow.style.minHeight = `${els.barRow.offsetHeight}px`;
  } else if (!filtering) {
    els.barRow.style.minHeight = "";
  }
  const loose = topRowSites().filter((c) => !filtering || matches(c, tokens));
  renderBar(loose, tokens);
  els.barRow.classList.toggle("reserved", filtering && !loose.length);

  const cols = columnModels(tokens).map((m) => renderColumn(m, tokens));
  const stacked = narrowQuery.matches;
  const masonry = !stacked && state.settings.layout === "masonry";
  els.board.classList.toggle("stack", stacked);
  els.board.classList.toggle("masonry", masonry);
  document.body.classList.toggle("layout-masonry", masonry);
  // The sites card takes the whole width when there is nothing else to show.
  const alone = cols.length === 1 && cols[0].classList.contains("wide");
  cols[0]?.classList.toggle("full", alone);
  if (masonry && !alone) layoutMasonry(cols);
  else { els.board.style.width = ""; els.board.replaceChildren(...cols); }
  els.board.hidden = !cols.length;
  els.empty.hidden = !(filtering && !cols.length && !loose.length);
  // An invitation to build the page, while there are almost no bookmarks.
  const hint = $("start-hint");
  const topShown = !state.hidden.includes(KEY_TOP) && state.topSites.length > 0;
  hint.hidden = filtering || !isSparse();
  if (!hint.hidden) hint.textContent = t(topShown ? "startHintTop" : "startHintEmpty");

  // Enter opens the result when only one link is left.
  const links = filtering ? [...document.querySelectorAll(".bar-row a.tile, .board a.item, .board a.tile")] : [];
  state.target = links.length === 1 ? links[0] : null;
  state.target?.classList.add("is-target");
  els.searchEnter.hidden = !state.target;

  renderFocusIcons();
  requestAnimationFrame(() => { updateBoardChrome(); updateFades(); });
}

// Long folders scroll inside their card (the page itself never grows with one big
// folder); a soft fade at the bottom shows there is more below.
function updateFades() {
  for (const body of els.board.querySelectorAll(".col-body")) {
    const more = body.scrollHeight - body.clientHeight - body.scrollTop > 4;
    body.classList.toggle("more-below", more);
  }
}
els.board.addEventListener("scroll", (e) => {
  if (e.target.classList?.contains("col-body")) updateFades();
}, { capture: true, passive: true });
els.board.addEventListener("click", () => requestAnimationFrame(updateFades)); // a subfolder or a column was opened or closed
addEventListener("resize", () => requestAnimationFrame(updateFades));

/* ===================== Focus mode ===================== */

// Focus mode hides everything but the background and shows the time, for a calm
// tab or a screen shared during a demo. It stays on, in every new tab, until the
// user turns it off with the same button.
// The locale of the translations in use, so the date matches the rest of the page.
const uiLocale = (ext.i18n.getMessage("@@ui_locale") || ext.i18n.getUILanguage()).replace("_", "-");
// Time: the language's usual format ("auto"), or 12-hour / 24-hour as chosen in the settings.
const timeFormats = {
  auto: new Intl.DateTimeFormat(uiLocale, { hour: "numeric", minute: "2-digit" }),
  12: new Intl.DateTimeFormat(uiLocale, { hour: "numeric", minute: "2-digit", hourCycle: "h12" }),
  24: new Intl.DateTimeFormat(uiLocale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
};
const dateFormat = new Intl.DateTimeFormat(uiLocale, { weekday: "long", month: "long", day: "numeric" });

function applyFocus() {
  const on = !!state.settings.focus;
  document.body.classList.toggle("focus", on);
  els.focusBtn.setAttribute("aria-pressed", String(on));
  els.focusView.hidden = !on;
  els.page.inert = on || !!welcome.el; // hidden bookmarks can't be reached with the keyboard either
  const showClock = state.settings.focusClock !== false;
  $("fc-time").hidden = $("fc-date").hidden = !showClock;
  if (!on || !showClock) return;
  const now = new Date();
  // AM / PM (in 12-hour locales) is shown smaller than the digits.
  const timeFormat = timeFormats[state.settings.clockFormat] || timeFormats.auto;
  $("fc-time").replaceChildren(...timeFormat.formatToParts(now).map((p) =>
    p.type === "dayPeriod" ? h("span", { class: "fc-period" }, p.value) : document.createTextNode(p.value)));
  const date = dateFormat.format(now);
  $("fc-date").textContent = date.charAt(0).toLocaleUpperCase(uiLocale) + date.slice(1);
}

// In focus mode, the sites above the search bar can stay available as plain icons:
// no names, no tooltips, no right-click menu.
function renderFocusIcons() {
  const row = $("fc-icons");
  if (!state.settings.focus || !state.settings.focusIcons) { row.replaceChildren(); return; }
  row.classList.toggle("gray", !!state.settings.focusGray);
  row.replaceChildren(...topRowSites().map((node) => {
    const scriptUrl = isScriptUrl(node.url);
    const a = h("a", {
      class: "fc-icon",
      href: scriptUrl ? null : node.url,
      "aria-label": cleanText(node.title || hostOf(node.url)),
    }, h("span", { class: "fc-glyph" }, favicon(node.url, node.title, 64)));
    a.addEventListener("contextmenu", (e) => e.preventDefault());
    if (!isWebUrl(node.url) && !scriptUrl) {
      a.addEventListener("click", (e) => { e.preventDefault(); openUrl(node.url, { newTab: e.metaKey || e.ctrlKey }); });
    }
    return a;
  }));
  // Balanced rows, like the tiles above the search bar (never 10 + 2).
  row.style.maxWidth = "";
  const first = row.firstElementChild;
  if (first) {
    const per = balancedPerRow(row.children.length, 8);
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    row.style.maxWidth = `${per * first.offsetWidth + (per - 1) * gap + 1}px`;
  }
}

/* ===================== Keep the screen on ===================== */
// Like the "caffeine" apps (a sun, in keeping with the nature theme): keeps the screen on and the computer awake, indefinitely or for a
// while. It uses the browser's Screen Wake Lock, which needs no permission but only works while
// a ReStart page is shown: the browser releases it when the page is hidden (another tab, a
// hidden window) and ReStart asks again when the page comes back. The menu says so.
// The state is shared by every ReStart tab ("awakeUntil" in local storage: 0 = off,
// -1 = until turned off, otherwise the end time). It is not a setting: never exported.
const AWAKE_ICON = ICONS.sunny; // a sun: daylight, keeping the page awake
const AWAKE_FOR = [15, 30, 60, 120, 240]; // minutes
const awake = { until: 0, lock: null, timer: 0 };
const awakeOn = () => awake.until === -1 || awake.until > Date.now();

// "42 min", "1 h 05": minutes left, rounded up.
function formatLeft(ms) {
  const mins = Math.max(1, Math.ceil(ms / 60000));
  const lang = t("lang");
  const unit = (u, n, display = "short") => {
    try { return new Intl.NumberFormat(lang, { style: "unit", unit: u, unitDisplay: display }).format(n); }
    catch { return `${n} ${u === "hour" ? "h" : "min"}`; }
  };
  if (mins < 60) return unit("minute", mins);
  const m = mins % 60;
  return m ? `${unit("hour", Math.floor(mins / 60), "narrow")} ${String(m).padStart(2, "0")}` : unit("hour", mins / 60, "narrow");
}
const formatDuration = (mins) => formatLeft(mins * 60000);

async function holdAwake() {
  if (!awakeOn() || awake.lock || document.visibilityState !== "visible") return;
  try {
    const lock = await navigator.wakeLock.request("screen");
    if (!awakeOn()) { lock.release().catch(() => {}); return; } // turned off meanwhile
    awake.lock = lock;
    lock.addEventListener("release", () => { if (awake.lock === lock) awake.lock = null; });
  } catch (e) {
    console.warn("ReStart: could not keep the screen on", e);
  }
}

function showAwake() {
  const on = awakeOn();
  if (!on && awake.until) awake.until = 0;
  if (!on && awake.lock) { awake.lock.release().catch(() => {}); awake.lock = null; }
  if (on) holdAwake();
  const timed = on && awake.until !== -1;
  const left = timed ? formatLeft(awake.until - Date.now()) : "";
  els.awakeBtn.setAttribute("aria-pressed", String(on));
  els.awakeBtn.classList.toggle("timed", timed);
  $("awake-left").textContent = left;
  const label = !on ? t("keepAwake") : timed ? t("awakeLeft", left) : t("awakeAlways");
  els.awakeBtn.title = label;
  els.awakeBtn.setAttribute("aria-label", label);
  clearTimeout(awake.timer);
  // Refresh the time left every 15 s, and switch off right on time.
  if (timed) awake.timer = setTimeout(showAwake, Math.min(15000, Math.max(250, awake.until - Date.now())));
}

function setAwake(until) {
  awake.until = until;
  saveLocal({ awakeUntil: until });
  showAwake();
}

function openAwakeMenu() {
  const on = awakeOn();
  const item = (label, onclick, cls = "") =>
    h("button", { class: `menu-item ${cls}`.trim(), role: "menuitem", onclick: () => { closePopover(); onclick(); } }, label);
  const status = !on ? null : awake.until === -1 ? t("awakeAlways") : t("awakeLeft", formatLeft(awake.until - Date.now()));
  openPopover(els.awakeBtn, [
    h("div", { class: "awake-head" },
      // How it works (only while ReStart is shown) sits in the (i) bubble, out of the way.
      h("div", { class: "awake-title" }, svg(AWAKE_ICON), t("keepAwake"), infoBtn("awake", t("awakeHow"))),
      status ? h("div", { class: "awake-status" }, status) : null),
    h("div", { class: "menu-sep" }),
    ...AWAKE_FOR.map((mins) => item(formatDuration(mins), () => setAwake(Date.now() + mins * 60000))),
    item(t("awakeUntilOff"), () => setAwake(-1)),
    on ? h("div", { class: "menu-sep" }) : null,
    on ? item(t("awakeStop"), () => setAwake(0)) : null,
  ].filter(Boolean), { cls: "menu awake-menu", align: "end" });
  els.popover.setAttribute("role", "menu");
}

if ("wakeLock" in navigator) {
  els.awakeBtn.hidden = false;
  els.awakeBtn.addEventListener("click", () =>
    (els.popover.hidden || popoverAnchor !== els.awakeBtn ? openAwakeMenu() : closePopover()));
  document.addEventListener("visibilitychange", showAwake);
  // Another ReStart tab turned it on or off.
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !("awakeUntil" in changes)) return;
    awake.until = sanitizeAwake(changes.awakeUntil.newValue);
    showAwake();
  });
  store.get("awakeUntil").then(({ awakeUntil }) => { awake.until = sanitizeAwake(awakeUntil); showAwake(); }).catch(() => {});
}
function sanitizeAwake(v) {
  return v === -1 || (Number.isFinite(v) && v > Date.now() && v < Date.now() + 25 * 3600000) ? v : 0;
}

els.focusBtn.addEventListener("click", () => {
  state.settings.focus = !state.settings.focus;
  if (state.settings.focus) { state.query = ""; els.search.value = ""; }
  saveSettings();
  render();
  refreshSettings();
});

/* ===================== Sites row (bookmarks outside folders) ===================== */

// Normal tiles while they fit in 2 rows, smaller tiles beyond that.
const TILE_GAP = 6;
const MAX_ROWS = 2;
let barCapacityKey = "";

function tilesPerRow(compact) {
  const style = getComputedStyle(els.barRow);
  // The room available, not the row's own width (which is narrowed to balance the rows).
  const room = Math.min(1100, els.barRow.parentElement.clientWidth);
  const inner = room - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const tile = compact ? 68 : (narrowQuery.matches ? 76 : 84);
  return Math.max(1, Math.floor((inner + TILE_GAP) / (tile + TILE_GAP)));
}

// Tiles per row: up to 6 on one row; beyond, balanced rows of at most `max` tiles,
// so the block stays compact and easy to scan instead of one very long line.
function balancedPerRow(n, max) {
  if (n <= 6) return Math.max(1, n);
  const rows = Math.max(2, Math.ceil(n / max));
  return Math.ceil(n / rows);
}

function renderBar(links, tokens) {
  const normalCap = tilesPerRow(false) * MAX_ROWS;
  barCapacityKey = `${normalCap}/${tilesPerRow(true) * MAX_ROWS}`;
  const compact = links.length > normalCap;
  els.barRow.classList.toggle("compact", compact);
  // Icons only, a little bigger; the names come back while filtering, to show what matched.
  els.barRow.classList.toggle("no-names", !!state.settings.hideTileNames && !tokens.length);
  els.barRow.style.setProperty("--per-row", String(Math.min(balancedPerRow(links.length, 8), tilesPerRow(compact))));
  const tiles = links.map((c) => bookmarkLink(c, tokens, { cls: "tile" }));
  if (!tokens.length) tiles.forEach((tile, i) => { if (!links[i].unmodifiable) wireTileDrag(tile, links[i]); });
  els.barRow.replaceChildren(...tiles);
}

// Drag a tile to change the order of the sites above the search bar: any tile can go anywhere
// (see placeTile).
let dragTile = null;
function wireTileDrag(tile, node) {
  tile.draggable = true;
  tile.addEventListener("dragstart", (e) => {
    dragTile = node;
    dragItem = node; // a tile can also go into a folder
    e.dataTransfer.effectAllowed = "copyMove";
    e.dataTransfer.setData("text/uri-list", node.url);
    requestAnimationFrame(() => tile.classList.add("dragging"));
  });
  tile.addEventListener("dragend", () => {
    dragTile = null;
    dragItem = null;
    clearDropMarks();
  });
  // A tile takes any other tile, or a bookmark from a folder (into the bookmarks bar, next to a loose site).
  const accepts = () => (dragTile
    ? dragTile !== node
    : !!dragItem && isLooseTile(node) && canMoveInto(dragItem, state.bar));
  tile.addEventListener("dragover", (e) => {
    if (!accepts()) return;
    e.stopPropagation();
    e.preventDefault();
    const r = tile.getBoundingClientRect();
    const before = e.clientX < r.left + r.width / 2;
    tile.classList.toggle("drop-before", before);
    tile.classList.toggle("drop-after", !before);
  });
  tile.addEventListener("dragleave", (e) => { if (!tile.contains(e.relatedTarget)) tile.classList.remove("drop-before", "drop-after"); });
  tile.addEventListener("drop", (e) => {
    if (!accepts()) return;
    e.preventDefault();
    e.stopPropagation();
    const after = tile.classList.contains("drop-after");
    const moving = dragTile || dragItem;
    clearDropMarks();
    if (dragTile) placeTile(moving, node, after);
    else moveBookmark(moving, node, after);
  });
}

// A bookmark dropped on the row of tiles, beside them: at the end of the bookmarks bar.
els.barRow.addEventListener("dragover", (e) => {
  if (dragTile || !dragItem || !state.bar || state.query || !canMoveInto(dragItem, state.bar)) return;
  e.preventDefault();
  els.barRow.classList.add("drop-into");
});
els.barRow.addEventListener("dragleave", (e) => { if (!els.barRow.contains(e.relatedTarget)) els.barRow.classList.remove("drop-into"); });
els.barRow.addEventListener("drop", (e) => {
  if (dragTile || !dragItem || !canMoveInto(dragItem, state.bar)) return;
  e.preventDefault();
  const moving = dragItem;
  clearDropMarks();
  moveInto(moving, state.bar);
});

// Recompute when the window width changes how many tiles fit.
new ResizeObserver(() => {
  if (!state.bar) return;
  const key = `${tilesPerRow(false) * MAX_ROWS}/${tilesPerRow(true) * MAX_ROWS}`;
  if (key !== barCapacityKey) render();
}).observe(els.barRow);

/* ===================== Masonry layout ===================== */

// Cards fill the available width in as many lanes as fit; each card goes to the
// shortest lane, in order, so reading left to right follows the column order.
const LANE_MIN = 250;
const LANE_GAP = 12;
let laneCount = 0;
let laneRoom = 0; // lanes the width allows, even when fewer are used

// The width the lanes can use: the board's room, not its own width, which is narrowed
// to the lanes in use so that a few folders sit centered under the search bar.
function masonryInner() {
  const wrap = els.board.parentElement;
  const ws = getComputedStyle(wrap);
  const bs = getComputedStyle(els.board);
  const room = Math.min(parseFloat(bs.maxWidth) || Infinity, wrap.clientWidth - parseFloat(ws.paddingLeft) - parseFloat(ws.paddingRight));
  return room - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight);
}

function lanesFor(width) {
  return Math.max(1, Math.floor((width + LANE_GAP) / (LANE_MIN + LANE_GAP)));
}

// Render again and let each card glide from its old place to its new one (FLIP), so a
// re-layout reads as a calm movement rather than a jump.
function relayoutSmoothly() {
  const before = new Map([...els.board.querySelectorAll(".column")].map((c) => [c.dataset.key, c.getBoundingClientRect()]));
  render();
  if (motionQuery.matches || (state.settings.motion ?? 1) === 0) return;
  for (const c of els.board.querySelectorAll(".column")) {
    const a = before.get(c.dataset.key);
    if (!a) continue;
    const b = c.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) continue;
    c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
      { duration: 280, easing: "cubic-bezier(.2,.7,.2,1)" });
  }
}

function layoutMasonry(cards) {
  cards = [...cards];
  els.board.style.width = "";
  const style = getComputedStyle(els.board);
  const inner = masonryInner();
  laneRoom = lanesFor(inner);
  // Fewer cards than lanes: keep the lanes' width but use only the lanes needed, and
  // narrow the board to them so the block stays centered (the sites card takes two lanes).
  const wide = cards.some((c) => c.classList.contains("wide")) && laneRoom >= 3;
  // A folded card shares its lane with the card that follows it (see below).
  const units = cards.filter((c, i) => !(c.classList.contains("collapsed") && i < cards.length - 1)).length;
  laneCount = Math.max(1, Math.min(laneRoom, units + (wide ? 1 : 0)));
  if (laneCount < laneRoom) {
    const laneW = (inner - (laneRoom - 1) * LANE_GAP) / laneRoom;
    const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    els.board.style.width = `${Math.floor(laneCount * laneW + (laneCount - 1) * LANE_GAP + pad)}px`;
  }
  const lanes = Array.from({ length: laneCount }, () => h("div", { class: "lane" }));
  els.board.replaceChildren(...lanes);
  const spacer = (height) => h("div", { class: "lane-spacer", style: `height:${height}px` });

  // The sites card keeps two lanes to itself (nothing below it) when there are
  // at least 3 lanes; it sits on the left or right depending on its place in the order.
  const wideIndex = cards.findIndex((c) => c.classList.contains("wide"));
  let free = lanes;
  if (wideIndex !== -1 && laneCount >= 3) {
    const wide = cards[wideIndex];
    const left = wideIndex <= (cards.length - 1) / 2;
    const at = left ? 0 : laneCount - 2;
    wide.classList.add("span-2", "pinned");
    lanes[at].classList.add("lane-wide");
    lanes[at].append(wide);
    free = lanes.filter((_, i) => i !== at && i !== at + 1);
    cards = cards.filter((c) => c !== wide);
  }

  let stick = null;
  for (const card of cards) {
    if (card.classList.contains("wide") && laneCount > 1) {
      stick = null;
      // Two lanes only: the sites card spans both, folders continue below.
      const [a, b] = [lanes[0], lanes[1]];
      const level = Math.max(a.offsetHeight, b.offsetHeight);
      if (a.offsetHeight < level) a.append(spacer(level - a.offsetHeight));
      if (b.offsetHeight < level) b.append(spacer(level - b.offsetHeight));
      card.classList.add("span-2");
      a.append(card);
      b.append(spacer(card.offsetHeight + LANE_GAP));
      continue;
    }
    // A folded folder keeps its place in the reading order, and the next card comes right
    // under it, in the same lane (instead of whatever card happens to land there later).
    let target = stick;
    if (!target) {
      target = free[0];
      for (const lane of free) if (lane.offsetHeight < target.offsetHeight) target = lane;
    }
    target.append(card);
    stick = card.classList.contains("collapsed") ? target : null;
  }
}

// Re-flow only when the number of lanes changes (not when a subfolder opens).
new ResizeObserver(() => {
  if (!els.board.classList.contains("masonry")) return;
  if (lanesFor(masonryInner()) !== laneRoom) render();
}).observe(els.board.parentElement);

/* ===================== Column reordering (drag & drop) ===================== */

let dragKey = null;


function wireDrag(col, head) {
  head.addEventListener("dragstart", (e) => {
    dragKey = col.dataset.key;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragKey);
    requestAnimationFrame(() => col.classList.add("dragging"));
  });
  head.addEventListener("dragend", () => {
    dragKey = null;
    document.querySelectorAll(".dragging, .drop-before, .drop-after")
      .forEach((n) => n.classList.remove("dragging", "drop-before", "drop-after"));
  });
  col.addEventListener("dragover", (e) => {
    if (!dragKey || dragKey === col.dataset.key) return;
    e.preventDefault();
    const r = col.getBoundingClientRect();
    const vertical = narrowQuery.matches || els.board.classList.contains("masonry");
    const before = vertical ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
    col.classList.toggle("drop-before", before);
    col.classList.toggle("drop-after", !before);
  });
  col.addEventListener("dragleave", (e) => {
    if (!col.contains(e.relatedTarget)) col.classList.remove("drop-before", "drop-after");
  });
  col.addEventListener("drop", (e) => {
    if (!dragKey) return;
    e.preventDefault();
    const before = col.classList.contains("drop-before");
    const keys = allColumnKeys().filter((k) => k !== dragKey);
    const at = keys.indexOf(col.dataset.key) + (before ? 0 : 1);
    keys.splice(at, 0, dragKey);
    saveOrder(keys);
  });
}

/* ===================== Board scrolling ===================== */

function updateBoardChrome() {
  const b = els.board;
  const max = b.scrollWidth - b.clientWidth;
  const left = b.scrollLeft;
  b.style.setProperty("--fade-l", left > 2 ? "32px" : "0px");
  b.style.setProperty("--fade-r", left < max - 2 ? "32px" : "0px");
  els.prev.classList.toggle("show", left > 2);
  els.next.classList.toggle("show", left < max - 2);
}

function pageBoard(dir) {
  const col = els.board.querySelector(".column");
  const step = col ? col.offsetWidth + 12 : 260;
  const n = Math.max(1, Math.floor(els.board.clientWidth / step));
  els.board.scrollBy({ left: dir * step * n, behavior: "smooth" });
}

els.board.addEventListener("wheel", (e) => {
  if (narrowQuery.matches || els.board.classList.contains("masonry") || e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
  const body = e.target.closest(".col-body");
  if (body && body.scrollHeight > body.clientHeight) return;
  if (els.board.scrollWidth <= els.board.clientWidth) return;
  e.preventDefault();
  els.board.scrollLeft += e.deltaY;
}, { passive: false });
els.board.addEventListener("scroll", updateBoardChrome, { passive: true });
addEventListener("resize", updateBoardChrome);
els.prev.addEventListener("click", () => pageBoard(-1));
els.next.addEventListener("click", () => pageBoard(1));

/* ===================== Appearance ===================== */

// A plain background color: a custom color as picked, or a pastel softened for
// the page (the swatches in the settings show this same color). It never changes
// with the time of day: only the glow and the rays do.
function plainColor(id) {
  if (HEX_COLOR.test(id)) return id;
  if (id === "gray" && !isDark()) return "#f5f5f5"; // a neutral, very light gray
  const c = pastel(id);
  return isDark() ? `color-mix(in srgb, ${c} 22%, #28282c)` : `color-mix(in srgb, ${c} 45%, #f7f6f4)`;
}
const plainBackground = (id) => `linear-gradient(${plainColor(id)}, ${plainColor(id)})`;

// Backgrounds drawn from the glow color: the glow itself and the light rays.
const isLit = (type) => type === "glow" || type === "rays";
// Backgrounds that can have a plain color underneath: the glow, the rays and the leaf shadows.
const hasUnderColor = (type) => isLit(type) || type === "leaves" || type === "snow";
// The page color that follows the hour, used when no color is chosen.
const pageBase = () => (isDark() ? "#2a2a2e" : "#f6f6f7"); // dark: a soft charcoal, never black

/* ----- Accent color: drawn from the background ----- */
// The accent (focus rings, selections, buttons, Focus and Keep Awake when on) takes the hue of
// the background: the glow or sky color, the chosen color or tint, or else the sky of the hour.
// Its lightness is then set for legibility: at least 4.5:1 against the cards and menus for
// text and rings (--accent), and against white text for filled buttons (--accent-fill).
const luminance = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function fromHsl([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255));
}
// Move the lightness one way until the color reaches `ratio` against `against`.
function legible([h, s, l], against, ratio, darker) {
  for (let i = 0; i < 100; i++) {
    const rgb = fromHsl([h, s, l]);
    if (contrast(rgb, against) >= ratio || l <= 0.05 || l >= 0.95) return rgb;
    l += darker ? -0.01 : 0.01;
  }
  return fromHsl([h, s, l]);
}
function accentSource(now) {
  const bg = state.settings.bg || {};
  const sky = () => skyAt(now)[0];
  const solid = (v) => (HEX_COLOR.test(v) ? rgbOf(v) : BG_IDS.has(v) && v !== "gray" ? rgbOf(pastelOf(v).light) : null);
  let rgb = null;
  if (isLit(bg.type)) { const g = glowOf(bg.value); rgb = g.id === "sky" ? sky() : g.id === "drift" ? driftColor(now) : rgbOf(g.base); }
  else if (bg.type === "color") rgb = solid(bg.value);
  else rgb = solid(bg.tint);
  // No color chosen, or one without a hue (gray): the sky of the hour.
  if (!rgb || toHsl(rgb)[1] < 0.08) rgb = sky();
  return rgb;
}
function applyAccent(now = new Date()) {
  let [h, s] = toHsl(accentSource(now));
  // Orange, gold and olive hues turn brown once darkened enough to read: take a sunset rose
  // instead, which keeps the warmth without the brown.
  if (h >= 15 && h < 75) h = 350;
  const hsl = [h, Math.min(0.85, Math.max(0.5, s)), isDark() ? 0.62 : 0.45];
  const white = [255, 255, 255];
  const surface = isDark() ? rgbOf("#36363a") : white;
  const text = legible(hsl, surface, 4.5, !isDark());
  const fill = legible([h, hsl[1], Math.min(hsl[2], 0.48)], white, 4.5, true);
  const css = (c) => `rgb(${c.join(",")})`;
  document.documentElement.style.setProperty("--accent", css(text));
  document.documentElement.style.setProperty("--accent-fill", css(fill));
}

function applyAppearance() {
  const s = state.settings;
  const root = document.documentElement.style;
  root.setProperty("--col-alpha", String(s.colAlpha));
  applyTheme();
  applyAccent();

  let layer = "none";
  let glow = { layer: "none", rays: [] };
  const { type, value } = s.bg || {};
  const lit = isLit(type);
  if (lit) {
    glow = glowLayer(new Date(), value, type === "rays");
    // Optional plain color under the glow or the rays; otherwise the page takes the hue of the hour.
    layer = s.bg.tint ? plainBackground(s.bg.tint) : hourWall(new Date(), pageBase());
  } else if (type === "leaves") {
    // Leaf shadows on a wall softly lit by the sun: a warm, very light tint by default.
    layer = s.bg.tint ? plainBackground(s.bg.tint) : hourWall(new Date(), pageBase());
    root.setProperty("--leaf-alpha", String(Math.min(1, (isDark() ? 0.5 : 0.17) * (s.glowStrength ?? 1))));
  } else if (type === "snow") {
    layer = s.bg.tint ? plainBackground(s.bg.tint) : hourWall(new Date(), pageBase());
  } else {
    // Color: a chosen color, or (none chosen) the page color that follows the hour.
    layer = type === "color" && value ? plainBackground(value) : hourWall(new Date(), pageBase());
  }
  document.body.classList.toggle("bg-snow", type === "snow");
  if (type === "snow") startSnow(value); else stopSnow();
  document.body.classList.toggle("bg-leaves", type === "leaves");
  for (const kind of LEAF_KINDS) document.body.classList.toggle(`leaves-${kind}`, type === "leaves" && value === kind);
  updateLeaves();
  root.setProperty("--bg-layer", layer);
  root.setProperty("--glow-layer", glow.layer);
  RAY_LAYERS.forEach((_, i) => root.setProperty(`--rays-${i + 1}`, glow.rays[i] || "none"));
  document.body.classList.toggle("glow-rays", type === "rays");
  document.body.classList.toggle("bg-grain", lit);
  if (lit) {
    const x = sunX(solarHour(new Date()));
    root.setProperty("--sun-x", `${x.toFixed(1)}%`);
    root.setProperty("--rays-origin", `${raysSource(x).ox.toFixed(1)}% ${RAYS_DEPTH}px`);
  }
  const motion = s.motion ?? 1;
  document.body.classList.toggle("glow-still", motion === 0);
  root.setProperty("--speed", String(Math.max(0.05, motion)));
  updateDrift();

  applyFocus();
}

// Glow at the top of the page, in the chosen color. It follows the sun: it rises
// on the left in the morning, crosses the top at midday and sets on the right in
// the evening (then drifts back during the night). Its color goes from soft in
// the morning, to pale at midday, to deep in the evening. A separate CSS
// animation makes it "breathe" very slowly.
// Swatch shown in settings (pastel) → base color of the glow (stronger, it gets washed out).
const GLOW_COLORS = [
  { id: "sky",    swatch: "linear-gradient(135deg, #ffc9a0, #a9d3f2 50%, #b6b0ee)", base: "#ffb08a" },
  // Pastels: drifts slowly from one color to the next (see driftColor).
  { id: "drift",  swatch: "linear-gradient(135deg, #ffcf9e, #f7bfd8 30%, #c9c0f3 55%, #abd9ee 78%, #ace3d5)", base: "#ff8c46" },
  { id: "orange", swatch: "#ffcf9e", base: "#ff8c46" },
  { id: "red",    swatch: "#ffb3ad", base: "#ff6b62" },
  { id: "pink",   swatch: "#f7bfd8", base: "#ff7eb6" },
  { id: "purple", swatch: "#e2c0f1", base: "#c77dff" },
  { id: "indigo", swatch: "#c9c0f3", base: "#8c7dff" },
  { id: "blue",   swatch: "#b6cdf6", base: "#6f9bff" },
  { id: "teal",   swatch: "#abd9ee", base: "#4cc3e6" },
  { id: "mint",   swatch: "#ace3d5", base: "#3fd1b0" },
  { id: "green",  swatch: "#bde5b4", base: "#7bd36a" },
  { id: "yellow", swatch: "#fbe49a", base: "#ffc93c" },
];
// Sky follows how high the sun is, in colors loosely inspired by traditional Japanese ones:
// wisteria at night (fuji), lilac before dawn (usu-murasaki), carnation pink at dawn and dusk
// (nadeshiko), a pale rosy peach for the low sun (usu-momo), white wisteria as the light rises
// (shira-fuji), then sky blue at midday (sora-iro), a pale aqua in winter (kame-nozoki).
// Morning and evening go through the same colors, in mirror. No greys, no ochres.
// [elevation -1 (deep night) .. 1 (high noon in summer), core, fringe, intensity]
const SKY_STOPS = [
  [-1,    "#a7a2d6", "#b9b3e3", 0.5],
  [-0.3,  "#b3a8dd", "#c6b5e2", 0.6],
  [-0.05, "#efb3c4", "#cdb6e6", 0.85],
  [ 0.1,  "#f8c8bd", "#e7c3e4", 0.85],
  [ 0.28, "#ecdff3", "#dfe9f6", 0.8],
  [ 0.55, "#bfe1ee", "#dcedf6", 0.8],
  [ 1,    "#a9d8ef", "#cfeaf8", 0.75],
];
// Fixed colors keep their hue; they are paler at midday and softer at night.
// [hour, depth 0..1 (low = washed toward white), intensity]
const FIXED_KEYS = [
  [ 0, 0.55, 0.6],
  [ 6, 0.6,  0.75],
  [10, 0.3,  0.9],
  [14, 0.25, 0.9],
  [18, 0.6,  0.95],
  [21, 0.7,  0.85],
  [23, 0.6,  0.65],
  [24, 0.55, 0.6],
];
const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixRgb = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
function keyAt(keys, t) {
  let i = 0;
  while (keys[i + 1][0] <= t) i++;
  const k = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  return [keys[i], keys[i + 1], k];
}
// A second, neighbouring tone for the fringe of a fixed color: a sky is never one color.
function fringeOf(rgb) {
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let hue = 0;
  if (d) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360 - 32) % 360;
  const sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs(((hue / 60) % 2) - 1)), m = l - c / 2;
  const [r1, g1, b1] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return [r1 + m, g1 + m, b1 + m].map((v) => Math.round(v * 255));
}
const DEFAULT_GLOW = "sky";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
// The glow is one of the presets, or a custom color picked by the user.
function glowOf(v) {
  if (v?.color === "custom" && HEX_COLOR.test(v.custom)) return { id: "custom", base: v.custom, swatch: v.custom };
  return GLOW_COLORS.find((c) => c.id === (v?.color || DEFAULT_GLOW)) || GLOW_COLORS[0];
}

/* ----- Seasons (northern hemisphere, no location needed) ----- */
// The sky's colors are written for a long day (sunrise 6:30, sunset 20:30). The clock hour is
// mapped onto that day with the season's real sunrise and sunset (about those of Paris, in local
// time): in late November, 10:00 is still the early morning light, and night falls at 17:00.
const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
function sunTimes(d) {
  const c = Math.cos((2 * Math.PI * (dayOfYear(d) - 172)) / 365); // 1 at the June solstice, -1 in December
  return [7.25 - 1.45 * c, 19.4 + 2.5 * c];
}
function solarHour(d) {
  const t = hourOf(d);
  const [rise, set] = sunTimes(d);
  if (t < rise) return (t / rise) * 6.5;
  if (t <= set) return 6.5 + ((t - rise) / (set - rise)) * 14;
  return 20.5 + ((t - set) / (24 - set)) * 3.5;
}
// How warm the season's light is: 1 in high summer, 0 in deep winter.
const seasonWarmth = (d) => 0.5 + 0.5 * Math.cos((2 * Math.PI * (dayOfYear(d) - 200)) / 365);
function seasonal(rgb, w) {
  // The season changes the hue more than the saturation: winter days drift toward a clear,
  // pale aqua (kame-nozoki), never toward grey.
  const grey = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2];
  const sat = 0.85 + 0.15 * w;
  const muted = rgb.map((v) => grey + (v - grey) * sat);
  return mixRgb(muted, rgbOf("#d9eef2"), (1 - w) * 0.25);
}

// How high the sun is, from the clock and the season: -1 deep night, 0 at sunrise and
// sunset, 1 at noon in summer (lower in winter). Twilight lasts about 2 h 30.
function sunElevation(d) {
  const t = solarHour(d);
  if (t >= 6.5 && t <= 20.5) return Math.sin((Math.PI * (t - 6.5)) / 14) * (0.6 + 0.4 * seasonWarmth(d));
  const fromEdge = t < 6.5 ? 6.5 - t : t - 20.5;
  return -Math.min(1, fromEdge / 2.5);
}

// The Sky color of a moment, before it is deepened for the page: [core, fringe, intensity].
function skyAt(d) {
  const e = sunElevation(d);
  let i = 0;
  while (i < SKY_STOPS.length - 2 && SKY_STOPS[i + 1][0] <= e) i++;
  const [a, b] = [SKY_STOPS[i], SKY_STOPS[i + 1]];
  const f = Math.max(0, Math.min(1, (e - a[0]) / (b[0] - a[0])));
  const w = seasonWarmth(d);
  return [
    seasonal(mixRgb(rgbOf(a[1]), rgbOf(b[1]), f), w),
    seasonal(mixRgb(rgbOf(a[2]), rgbOf(b[2]), f), w),
    (a[3] + (b[3] - a[3]) * f) * (0.8 + 0.2 * w),
  ];
}

function glowLayer(now, value, rays = false) {
  const t = solarHour(now);
  const warmth = seasonWarmth(now);
  const glow = glowOf(value);
  let core, fringe, k;
  if (glow.id === "sky") {
    [core, fringe, k] = skyAt(now);
    // The keys are pastels: deepen them so they read on the page. On a light page they
    // need more depth (a pastel on white barely shows); on a dark page, pale tints read as grey fog.
    const deepen = isDark() ? 1.5 : 1.9; // on a dark page, keep the light bright enough to glow
    [core, fringe] = [core, fringe].map((c) => c.map((v) => Math.max(0, 255 - (255 - v) * deepen)));
  } else {
    const [a, b, f] = keyAt(FIXED_KEYS, t);
    const depth = a[1] + (b[1] - a[1]) * f;
    k = a[2] + (b[2] - a[2]) * f;
    // Low depth = the color washed toward white. In dark mode a washed-out color turns
    // grey on the dark background: keep it more saturated.
    const mix = isDark() ? 0.8 + 0.2 * depth : 0.6 + 0.4 * depth;
    const base = glow.id === "drift" ? driftColor(now) : rgbOf(glow.base);
    core = base.map((c) => 255 + (c - 255) * mix);
    fringe = fringeOf(base).map((c) => 255 + (c - 255) * mix);
  }
  const strength = lightStrength(state.settings.glowStrength ?? 1, rays);
  const alpha = (isDark() ? 0.95 : 1) * k * strength;
  const x = sunX(t);
  if (!rays) return { layer: glowGradient(core, fringe, alpha, x, strength), rays: [] };
  // Light rays: a faint glow as the light source, and several sets of shafts.
  // Each set fades in and out on its own rhythm (see .ray in styles.css), so
  // shafts appear and vanish one after another, like sunlight under water.
  return {
    // Under the rays, only a faint glow (fainter on a light page, where it would hide them).
    layer: glowGradient(core, fringe, alpha * (isDark() ? 0.45 : 0.3), x, strength),
    // One powdery tone for every shaft: the core, nudged toward the fringe and softened
    // toward white, so the shafts stay calm instead of striping the page in two colors.
    rays: RAY_LAYERS.map((layer) => raysGradient(mixRgb(mixRgb(core, fringe, 0.3), [255, 255, 255], isDark() ? 0.1 : 0.25), alpha, x, layer)),
  };
}

// Pastels: the light goes slowly through peach, pink, lilac, blue, aqua, mint and gold, then
// round again, about 90 s from one color to the next at the normal Motion speed (a full round
// in about 10 minutes). Every tab follows the clock, so they all show the same color. With
// Motion at 0, it barely moves (it only changes with the minute refresh).
const DRIFT_STOPS = ["#ff8c46", "#ff7eb6", "#c77dff", "#6f9bff", "#4cc3e6", "#3fd1b0", "#ffc93c"].map(rgbOf);
const DRIFT_STEP = 90; // seconds per color, at the normal speed
function driftColor(now) {
  const speed = state.settings.motion ?? 1;
  const pos = ((now.getTime() / 1000) * Math.max(speed, 0.05)) / DRIFT_STEP;
  const i = Math.floor(pos) % DRIFT_STOPS.length;
  const f = pos - Math.floor(pos);
  const e = f * f * (3 - 2 * f); // ease from one color to the next
  return mixRgb(DRIFT_STOPS[i], DRIFT_STOPS[(i + 1) % DRIFT_STOPS.length], e);
}

// While Pastels is shown, refresh the light (and the accent) every few seconds, so the color
// moves smoothly; only while the page is visible and something moves.
let driftTimer = 0;
function updateDrift() {
  const bg = state.settings.bg || {};
  const on = isLit(bg.type) && glowOf(bg.value).id === "drift" && (state.settings.motion ?? 1) > 0
    && !motionQuery.matches && !document.hidden;
  if (on && !driftTimer) driftTimer = setInterval(refreshGlow, 2000);
  if (!on && driftTimer) { clearInterval(driftTimer); driftTimer = 0; }
}
function refreshGlow() {
  const { type, value } = state.settings.bg || {};
  if (!isLit(type)) return;
  const root = document.documentElement.style;
  const glow = glowLayer(new Date(), value, type === "rays");
  root.setProperty("--glow-layer", glow.layer);
  RAY_LAYERS.forEach((_, i) => root.setProperty(`--rays-${i + 1}`, glow.rays[i] || "none"));
  applyAccent();
}
document.addEventListener("visibilitychange", () => updateDrift());

// The intensity of the light. The setting is shown on a 0-100 scale with 1 in the middle, and
// the top of the scale always gives 2. The middle is set per kind of light: the glow is calmer
// (0.96, what 40 % gave in 1.3.0), the rays a little stronger (1.2, what 60 % gave in 1.2).
function lightStrength(v, rays = false) {
  const mid = rays ? 1.2 : 0.96;
  return v <= 1 ? mid * v : mid + (2 - mid) * (v - 1);
}

// Four sets of shafts, each spread across the fan so that the sets interleave.
// [angle from the fan's center in degrees, width in degrees, relative strength]
const RAY_LAYERS = [
  [[-26, 5, 0.8], [-9, 7, 1], [8, 4, 0.6], [22, 6, 0.9]],
  [[-20, 4, 0.6], [-3, 6, 0.9], [14, 8, 0.8], [29, 3, 0.5]],
  [[-31, 6, 0.7], [-14, 3, 0.5], [2, 5, 1], [18, 4, 0.7]],
  [[-23, 7, 0.9], [-6, 4, 0.6], [11, 6, 0.8], [26, 5, 0.7]],
];

function raysGradient([r, g, bl], alpha, x, layer) {
  const c = (m) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(bl)},${Math.min(1, alpha * m).toFixed(3)})`;
  // Shafts of light coming from far above, almost parallel, slanting away from the sun.
  const { ox, tilt } = raysSource(x);
  const k = isDark() ? 0.7 : 1.15; // on a light page, soft shafts need more contrast to show
  const stops = [];
  for (const [at, w, m] of layer) {
    const mid = 180 + tilt + at;
    // Soft edges: each shaft fades in and out instead of starting at a hard line.
    stops.push(`transparent ${(mid - w / 2).toFixed(2)}deg`, `${c(m * k * 0.45)} ${(mid - w / 4).toFixed(2)}deg`, `${c(m * k)} ${mid.toFixed(2)}deg`,
      `${c(m * k * 0.45)} ${(mid + w / 4).toFixed(2)}deg`, `transparent ${(mid + w / 2).toFixed(2)}deg`);
  }
  return `conic-gradient(from 0deg at ${ox.toFixed(1)}% ${RAYS_DEPTH}px, transparent 0deg, ${stops.join(", ")}, transparent 360deg)`;
}

// The light source sits far above the page, offset toward the sun's side.
const RAYS_DEPTH = -700;
function raysSource(x) {
  const tilt = (x - 50) * 0.35; // degrees: sun on the right, shafts lean to the left going down
  return { ox: x + (x - 50) * 0.8, tilt };
}

const hourOf = (d) => d.getHours() + d.getMinutes() / 60;

// Horizontal position of the glow (percent of the width) for a time of day.
const SUNRISE = 6;
const SUNSET = 21;
function sunX(t) {
  const [left, right] = [14, 86];
  if (t >= SUNRISE && t <= SUNSET) {
    // Smooth arc: slower near sunrise and sunset, faster around midday.
    const p = (t - SUNRISE) / (SUNSET - SUNRISE);
    return left + (right - left) * (1 - Math.cos(Math.PI * p)) / 2;
  }
  // Night: drift back from right to left until the next sunrise.
  const night = 24 - SUNSET + SUNRISE;
  const p = ((t - SUNSET + 24) % 24) / night;
  return right - (right - left) * p;
}

// A soft, atmospheric glow: many stops on a smooth curve (no visible edge), from the
// core color to the fringe color. Each stop is capped, so a stronger glow spreads further.
function glowGradient(core, fringe, alpha, x, strength = 1) {
  const stops = [];
  for (let i = 0; i <= 10; i++) {
    const p = i / 10;
    const fade = 1 - p * p * (3 - 2 * p); // smoothstep: a calm center, a long soft tail
    // The fringe tone only tints the outer part, and only halfway: a hint, never a band.
    const q = Math.max(0, Math.min(1, (p - 0.3) / 0.7));
    const [r, g, b] = mixRgb(core, fringe, 0.5 * q * q * (3 - 2 * q));
    const a = Math.min(1, alpha * fade);
    stops.push(`rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a.toFixed(3)}) ${Math.round(p * 100)}%`);
  }
  const size = Math.round(330 * (0.7 + 0.3 * strength));
  return `radial-gradient(ellipse 62% ${size}px at ${x.toFixed(1)}% -30px, ${stops.join(", ")})`;
}

// The page behind the glow, the rays or the leaves, when no color is chosen: the light of the hour, barely there.
// It takes a whisper of the Sky color of the moment (pink at dawn, warm white at midday,
// honey in the afternoon, rose at sunset, a cool blue-grey at night), and is a little
// brighter on the sun's side.
// The page behind every background (a color, the glow, the rays, the leaves, the breeze): a
// neutral base with a calm hint of the hour's and the season's hue. ("wall" is kept for a
// warmer variant, unused for now.)
function hourWall(now, base, kind = "page") {
  const t = solarHour(now);
  const sky = skyAt(now)[0];
  const dark = isDark();
  const wall = rgbOf(base);
  // Only the hue of the hour, never its brightness: the wall keeps its calm lightness.
  const grey = (sky[0] + sky[1] + sky[2]) / 3;
  const tint = wall.map((v, i) => Math.max(0, Math.min(255, v + (sky[i] - grey) * (kind === "page" ? (dark ? 0.2 : 0.3) : (dark ? 0.1 : 0.16)))));
  const lit = tint.map((v) => Math.min(255, v + (dark ? 4 : 5)));
  const css = (c) => `rgb(${c.map(Math.round).join(",")})`;
  const side = sunX(t) < 50 ? "to right" : "to left";
  return `linear-gradient(${side}, ${css(lit)}, ${css(tint)} 70%)`;
}

/* ===================== Breeze: snow, petals, seeds ===================== */
// Light things drifting in a slow, gusting wind: snowflakes, cherry petals or dandelion
// seeds ("Season" picks them by the date). What lands on a card, a tile or the search bar
// fades away where it touched. Drawn on one canvas behind the page; paused when the tab
// is hidden; still when animations are off.
// Leaf shadows: branches (the default, no value), palm fronds or bamboo. Kinds from 1.2.0
// (olive, monstera) fall back to branches.
const LEAF_KINDS = ["palm", "bamboo"];
const BREEZE_KINDS = ["season", "snow", "petals", "seeds", "leaves"];
const snow = { canvas: null, ctx: null, flakes: [], raf: 0, rects: [], rectsAt: 0, last: 0, w: 0, h: 0, sprites: null, spriteKey: "", kind: "snow", t: 0 };
const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");

// Season (northern hemisphere): petals in spring, seeds in summer, leaves in autumn, snow in winter.
function breezeKind(value, now = new Date()) {
  if (value && value !== "season") return value;
  const md = (now.getMonth() + 1) * 100 + now.getDate();
  if (md >= 320 && md < 621) return "petals";
  if (md >= 621 && md < 923) return "seeds";
  if (md >= 923 && md < 1221) return "leaves";
  return "snow";
}

const BREEZE = { // per kind: how many (per 100,000 px²), how fast, how long a landing takes to fade
  snow:   { density: 5.9, fade: 0.9 },
  petals: { density: 2.4, fade: 1.8 },
  seeds:  { density: 0.7, fade: 2.2 },
  leaves: { density: 1.7, fade: 1.8 },
};

function sprite(size, draw) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  return c;
}

function breezeSprites(kind, dark) {
  if (kind === "snow") {
    // On a light page, white flakes would vanish: a soft blue-grey instead.
    const rgb = dark ? "255,255,255" : "150,168,198";
    return [sprite(32, (g) => {
      const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, `rgba(${rgb},1)`);
      grad.addColorStop(0.45, `rgba(${rgb},.75)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 32);
    })];
  }
  if (kind === "petals") {
    // Cherry petals: a rounded drop with a small notch, powdery pink, lighter at the base.
    const tones = dark ? [["#f4c9d6", "#e9a9bd"], ["#f7d6df", "#eab3c4"]] : [["#fbd3de", "#f1aec2"], ["#fde0e7", "#f4bccb"]];
    return tones.map(([a, b]) => sprite(48, (g, n) => {
      g.translate(n / 2, n / 2);
      const grad = g.createLinearGradient(0, -18, 0, 18);
      grad.addColorStop(0, b);
      grad.addColorStop(1, a);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, 18);
      g.bezierCurveTo(-15, 8, -14, -12, -4, -17);
      g.lineTo(0, -13); // the notch
      g.lineTo(4, -17);
      g.bezierCurveTo(14, -12, 15, 8, 0, 18);
      g.fill();
    }));
  }
  if (kind === "leaves") {
    // Autumn leaves: a pointed oval with a fine midrib, in muted ochre, rust and gold.
    const tones = dark ? ["#c99d6c", "#bf8670", "#b3a46e"] : ["#e7c193", "#e0a991", "#d4c38f"];
    return tones.map((tone) => sprite(48, (g, n) => {
      g.translate(n / 2, n / 2);
      g.fillStyle = tone;
      g.beginPath();
      g.moveTo(0, 20);
      g.quadraticCurveTo(-15, 2, 0, -20);
      g.quadraticCurveTo(15, 2, 0, 20);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.35)";
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, 22); g.lineTo(0, -16); g.stroke();
    }));
  }
  // Dandelion seeds: a fine stem, the seed below, and an open dome of fine hairs, each
  // ending in a tiny bead of light.
  const ink = dark ? "rgba(244,242,236," : "rgba(118,110,100,";
  return [sprite(96, (g, n) => {
    g.translate(n / 2, n / 2);
    g.lineCap = "round";
    const top = -8;
    g.strokeStyle = `${ink}.55)`;
    g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(0, top); g.lineTo(0, 26); g.stroke(); // stem
    g.fillStyle = `${ink}.75)`;
    g.beginPath(); g.ellipse(0, 30, 2, 4.2, 0, 0, Math.PI * 2); g.fill(); // seed
    for (let k = 0; k <= 22; k++) { // hairs, from almost flat to almost upright
      const a = Math.PI * (1.06 + 0.88 * (k / 22));
      const len = 26 + 4 * Math.sin(k * 1.7);
      const x = Math.cos(a) * len, y = top + Math.sin(a) * len * 0.8;
      g.strokeStyle = `${ink}.32)`;
      g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(0, top); g.quadraticCurveTo(x * 0.5, top + (y - top) * 0.62, x, y); g.stroke();
      g.fillStyle = `${ink}.45)`;
      g.beginPath(); g.arc(x, y, 0.9, 0, Math.PI * 2); g.fill();
    }
  })];
}

function newFlake(top) {
  const kind = snow.kind;
  const f = { x: Math.random() * (snow.w + 200) - 100, y: top ? -20 - Math.random() * 40 : Math.random() * snow.h, phase: Math.random() * Math.PI * 2, melt: 0 };
  if (kind === "snow") {
    const r = 1 + Math.random() * 1.9; // bigger flakes are nearer: faster, more opaque
    return Object.assign(f, { r, size: r * 4, vy: 10 + r * 9 + Math.random() * 6, sway: 6 + Math.random() * 14, swaySpeed: 0.4 + Math.random() * 0.7, alpha: 0.35 + r * 0.18, drift: 0.5 + r / 3 });
  }
  if (kind === "petals" || kind === "leaves") {
    const near = Math.random();
    const big = kind === "leaves" ? 1.25 : 1;
    return Object.assign(f, {
      size: (18 + near * 12) * big, vy: 16 + near * 16, sway: 18 + Math.random() * 24, swaySpeed: 0.5 + Math.random() * 0.5,
      alpha: (isDark() ? 0.55 : 0.7) + near * 0.25, drift: 0.7 + near * 0.6,
      rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 1.6, flip: Math.random() * Math.PI * 2, flipSpeed: 0.8 + Math.random() * 1.4,
      variant: Math.floor(Math.random() * (kind === "leaves" ? 3 : 2)),
    });
  }
  const near = Math.random(); // seeds: float, drift with the wind, sometimes rise a little
  return Object.assign(f, {
    size: 24 + near * 12, vy: 5 + near * 7, sway: 10 + Math.random() * 14, swaySpeed: 0.25 + Math.random() * 0.3,
    alpha: 0.55 + near * 0.35, drift: 1.3 + near * 0.8, rot: 0, bob: 0.3 + Math.random() * 0.4,
  });
}

function sizeSnow() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  snow.w = innerWidth;
  snow.h = innerHeight;
  snow.canvas.width = Math.round(snow.w * dpr);
  snow.canvas.height = Math.round(snow.h * dpr);
  snow.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.min(180, Math.round((snow.w * snow.h) / 100000 * BREEZE[snow.kind].density * (state.settings.glowStrength ?? 1)));
  while (snow.flakes.length < count) snow.flakes.push(newFlake(false));
  snow.flakes.length = count;
}

// Where things land: the visible cards, tiles and search bar (in Focus mode: the clock and the icons).
function snowRects() {
  // In Focus mode the board is hidden (but still laid out): only the clock and the icons count.
  const sel = state.settings.focus ? ".fc-time:not([hidden]), .fc-date, .fc-icons a" : ".column, .bar-row .tile, .search";
  snow.rects = [...document.querySelectorAll(sel)]
    .map((el) => {
      if (!el.matches(".fc-time, .fc-date")) return el.getBoundingClientRect();
      const range = document.createRange(); // the text itself, not its full-width box
      range.selectNodeContents(el);
      return range.getBoundingClientRect();
    })
    .filter((r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < snow.h);
  snow.rectsAt = performance.now();
}

function drawSnow() {
  const { ctx } = snow;
  ctx.clearRect(0, 0, snow.w, snow.h);
  for (const f of snow.flakes) {
    const a = f.alpha * (f.melt ? Math.max(0, 1 - f.melt) : 1);
    if (a <= 0.01) continue;
    ctx.globalAlpha = a;
    const img = snow.sprites[f.variant || 0];
    if (snow.kind === "snow") { ctx.drawImage(img, f.x - f.size / 2, f.y - f.size / 2, f.size, f.size); continue; }
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    // Petals tumble: seen edge-on now and then.
    if (snow.kind === "petals" || snow.kind === "leaves") ctx.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(f.flip)));
    ctx.drawImage(img, -f.size / 2, -f.size / 2, f.size, f.size);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ---- Wind ----
// One wind for the leaf shadows and the breeze. Not a regular wave: its direction wanders
// slowly and turns now and then, puffs come at irregular moments, and calm stretches
// alternate with livelier ones. It is built from smooth noise (the same every time for a
// given moment), so it changes gently and never jumps.
function windNoise(x, seed) {
  const hash = (n) => { const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return v - Math.floor(v); };
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) + (hash(i + 1) - hash(i)) * u; // 0 .. 1
}
// The wind at time t (in seconds of motion), about -1.5 .. 1.5: the sign is the direction.
function windAt(t) {
  const drift = windNoise(t / 14, 1) * 2 - 1;                    // slow direction, turns every half minute or so
  const mood = windNoise(t / 45, 2);                              // calm or lively, over a minute or two
  const lively = Math.max(0, Math.min(1, (mood - 0.25) / 0.6));
  const puff = Math.max(0, (windNoise(t / 3.6, 3) - 0.42) / 0.58); // a gust now and then
  const flutter = windNoise(t / 1.4, 4) * 2 - 1;                  // small, quick changes
  return 0.6 * drift + Math.tanh(drift * 4) * (0.25 + 0.75 * lively) * puff * puff * 0.9 + 0.14 * flutter * (0.5 + lively);
}

// Leaf shadows moved by the wind. Each layer follows it like a branch on a spring, a little
// late and with a small rebound; the far layer is slower and gets each gust a moment later.
const leafWind = { raf: 0, last: 0, t: 0, near: { x: 0, v: 0 }, far: { x: 0, v: 0 } };
function springTo(b, target, k, c, dt) {
  b.v += (k * (target - b.x) - c * b.v) * dt;
  b.x += b.v * dt;
}
function placeLeaves() {
  const [near, far] = document.querySelectorAll(".leaves i");
  const n = leafWind.near.x, f = leafWind.far.x;
  near.style.transform = `translate(${(n * 3).toFixed(2)}px, ${(Math.abs(n) * 3).toFixed(2)}px) rotate(${(n * 1.2).toFixed(3)}deg) skewX(${(n * 0.9).toFixed(3)}deg)`;
  // The far layer is mirrored: its rotation is reversed so that it leans the same way.
  far.style.transform = `scaleX(-1) scale(1.12) translateY(${(Math.abs(f) * 4).toFixed(2)}px) rotate(${(-f * 1.1).toFixed(3)}deg)`;
}
function stepLeaves(now) {
  leafWind.raf = requestAnimationFrame(stepLeaves);
  // Motion speed scales time. At the default pace, the leaves move about as much as before,
  // on average, but some minutes are calmer and some livelier.
  const dt = Math.min(0.05, (now - (leafWind.last || now)) / 1000) * (state.settings.motion ?? 1);
  leafWind.last = now;
  leafWind.t += dt;
  // Several small steps keep the springs steady whatever the frame rate.
  for (let i = 0; i < 4; i++) {
    springTo(leafWind.near, windAt(leafWind.t), 3.2, 1.6, dt / 4);
    springTo(leafWind.far, 0.85 * windAt(leafWind.t - 1.2), 1.6, 1.3, dt / 4);
  }
  placeLeaves();
}
function updateLeaves() {
  const on = document.body.classList.contains("bg-leaves");
  const moving = on && (state.settings.motion ?? 1) > 0 && !motionQuery.matches && !document.hidden;
  if (moving && !leafWind.raf) {
    if (!leafWind.t) leafWind.t = (Date.now() / 1000) % 10000; // start somewhere in the wind, not always at the same place
    leafWind.last = 0;
    leafWind.raf = requestAnimationFrame(stepLeaves);
  }
  if (!moving && leafWind.raf) { cancelAnimationFrame(leafWind.raf); leafWind.raf = 0; }
  if (on && !moving) { leafWind.near = { x: 0, v: 0 }; leafWind.far = { x: 0, v: 0 }; placeLeaves(); }
}
document.addEventListener("visibilitychange", updateLeaves);
motionQuery.addEventListener("change", updateLeaves);

function stepSnow(now) {
  snow.raf = requestAnimationFrame(stepSnow);
  const dt = Math.min(0.05, (now - (snow.last || now)) / 1000) * (state.settings.motion ?? 1);
  snow.last = now;
  snow.t += dt;
  if (now - snow.rectsAt > 300) snowRects();
  // The same wind as the leaf shadows, with a light lean to one side so things keep drifting.
  const wind = 16 * windAt(snow.t) + 4;
  const fade = BREEZE[snow.kind].fade;
  for (let i = 0; i < snow.flakes.length; i++) {
    const f = snow.flakes[i];
    if (f.melt) {
      f.melt += dt / fade; // fades where it landed
      if (f.melt >= 1) snow.flakes[i] = newFlake(true);
      continue;
    }
    f.phase += f.swaySpeed * dt;
    f.x += (wind * f.drift + Math.cos(f.phase) * f.sway) * dt;
    f.y += f.vy * dt;
    if (snow.kind === "petals" || snow.kind === "leaves") { f.rot += f.spin * dt; f.flip += f.flipSpeed * dt; }
    if (snow.kind === "seeds") {
      f.y += Math.sin(f.phase * 1.7) * f.sway * f.bob * dt; // lifted now and then
      f.rot = Math.max(-0.5, Math.min(0.5, (wind * f.drift) / 80)); // leaning with the wind
    }
    if (f.y > snow.h + 30 || f.x < -140 || f.x > snow.w + 140) { snow.flakes[i] = newFlake(true); continue; }
    for (const r of snow.rects) {
      if (f.x >= r.left && f.x <= r.right && f.y >= r.top && f.y <= r.bottom) { f.melt = 0.001; f.y = Math.max(r.top, f.y - 2); break; }
    }
  }
  drawSnow();
}

function startSnow(value) {
  if (!snow.canvas) {
    snow.canvas = h("canvas", { class: "snow", "aria-hidden": "true" });
    snow.ctx = snow.canvas.getContext("2d");
    document.body.prepend(snow.canvas);
    addEventListener("resize", () => { if (document.body.classList.contains("bg-snow")) { sizeSnow(); snowRects(); if (!snow.raf) drawSnow(); } });
    document.addEventListener("visibilitychange", () => { if (document.body.classList.contains("bg-snow")) startSnow(state.settings.bg?.value); });
    motionQuery.addEventListener("change", () => { if (document.body.classList.contains("bg-snow")) startSnow(state.settings.bg?.value); });
  }
  const kind = breezeKind(value);
  const dark = isDark();
  if (kind !== snow.kind) { snow.kind = kind; snow.flakes = []; }
  if (snow.spriteKey !== `${kind}/${dark}`) { snow.sprites = breezeSprites(kind, dark); snow.spriteKey = `${kind}/${dark}`; }
  sizeSnow();
  snowRects();
  const moving = (state.settings.motion ?? 1) > 0 && !motionQuery.matches && !document.hidden;
  if (moving && !snow.raf) { snow.last = 0; snow.raf = requestAnimationFrame(stepSnow); }
  if (!moving) { cancelAnimationFrame(snow.raf); snow.raf = 0; drawSnow(); }
}

function stopSnow() {
  if (!snow.canvas) return;
  cancelAnimationFrame(snow.raf);
  snow.raf = 0;
  snow.ctx.clearRect(0, 0, snow.w, snow.h);
}

function scheduleClock() {
  applyAppearance(); // refreshes the glow or rays (position and color follow the time) and the clock
  setTimeout(scheduleClock, 60000 - (Date.now() % 60000) + 50);
}

/* ===================== Popovers ===================== */

let popoverAnchor = null;

function placePopover(anchor, align) {
  const r = anchor.getBoundingClientRect();
  const p = els.popover.getBoundingClientRect();
  let left = align === "end" ? r.right - p.width : r.left;
  left = Math.max(8, Math.min(left, innerWidth - p.width - 8));
  let top = r.bottom + 6;
  if (top + p.height > innerHeight - 8) top = Math.max(8, Math.min(r.top - p.height - 6, innerHeight - p.height - 8));
  els.popover.style.left = `${left}px`;
  els.popover.style.top = `${top}px`;
}

function openPopover(anchor, content, { align = "start", cls = "", at = null } = {}) {
  closePopover({ restoreFocus: false });
  popoverAnchor = anchor;
  els.popover.className = `popover ${cls}`.trim();
  els.popover.removeAttribute("aria-labelledby"); // set by the delete confirmation only
  els.popover.replaceChildren(...content);
  els.popover.hidden = false;
  if (at) placeAt(at.x, at.y);
  else placePopover(anchor, align);
  anchor.setAttribute("aria-expanded", "true");
}

function placeAt(x, y) {
  const p = els.popover.getBoundingClientRect();
  els.popover.style.left = `${Math.max(8, Math.min(x, innerWidth - p.width - 8))}px`;
  els.popover.style.top = `${Math.max(8, Math.min(y, innerHeight - p.height - 8))}px`;
}

/* ----- Bookmark context menu ----- */

function openBookmarkMenu(node, anchor, x, y) {
  const isLoose = node.parentId === state.bar.id;
  const editable = !node.unmodifiable; // managed (policy) bookmarks can't be changed
  const canOpen = !isScriptUrl(node.url);
  const pinned = state.highlighted.includes(node.url);
  const item = (label, icon, onclick, cls = "") =>
    h("button", { class: `menu-item ${cls}`.trim(), role: "menuitem", onclick }, icon ? svg(icon) : h("span", { class: "menu-ico" }), label);

  const tileMoves = () => {
    if (!anchor.closest?.(".bar-row") || state.query) return [];
    const urls = topRowSites().map((c) => c.url);
    const i = urls.indexOf(node.url);
    const move = (d) => () => { closePopover({ restoreFocus: false }); moveTile(node, d); };
    return [
      i > 0 ? item(t("moveLeft"), null, move(-1)) : null,
      i !== -1 && i < urls.length - 1 ? item(t("moveRight"), null, move(1)) : null,
    ];
  };

  const showMain = () => {
    const del = item(t("delete"), UI.trash, () => {
      if (!del.classList.contains("armed")) {
        del.classList.add("armed");
        del.lastChild.textContent = t("confirmDelete");
        return;
      }
      closePopover({ restoreFocus: false });
      ext.bookmarks.remove(node.id).catch((e) => console.warn("ReStart: delete failed", e));
    }, "danger");
    els.popover.replaceChildren(...[
      canOpen ? item(t("openNewTab"), UI.openNew, () => { closePopover(); openUrl(node.url, { newTab: true }); }) : null,
      item(t("copyLink"), UI.link, () => { navigator.clipboard?.writeText(node.url).catch(() => {}); closePopover(); }),
      // Pinning is offered everywhere except on loose sites that are already all shown above the search bar.
      !isLoose || sitesOverflow() || pinned
        ? item(pinned ? t("unhighlight") : t("highlight"), pinned ? UI.starOff : UI.star, () => {
          state.highlighted = pinned ? state.highlighted.filter((u) => u !== node.url) : [...state.highlighted, node.url];
          if (pinned) delete state.pinAfter[node.url]; // pinned again later, it starts at the end
          saveLocal({ highlighted: state.highlighted, pinAfter: state.pinAfter });
          closePopover({ restoreFocus: false });
          render();
        })
        : null,
      // Tiles above the search bar: move left or right.
      ...tileMoves(),
      editable && !state.query && state.byId.has(node.parentId) ? item(t("moveTo"), UI.subfolder, () => showMoveTo(node, x, y)) : null,
      editable ? h("div", { class: "menu-sep" }) : null,
      editable ? item(t("edit"), UI.edit, showEdit) : null,
      editable ? del : null,
    ].filter(Boolean));
  };

  // Edit the name and the address of the bookmark, in the browser's bookmarks.
  // Bookmarklets keep their address: only their name can be changed here.
  const showEdit = () => {
    const withUrl = !isScriptUrl(node.url);
    const name = h("input", { class: "icon-filter", type: "text", maxlength: "1000", value: node.title || "", "aria-label": t("name") });
    const address = withUrl
      ? h("input", { class: "icon-filter", type: "url", maxlength: "8192", value: node.url || "", "aria-label": t("url"), spellcheck: "false", autocapitalize: "off" })
      : null;
    const error = h("p", { class: "edit-error", role: "alert", hidden: true });
    const save = () => {
      const title = name.value.trim();
      const changes = {};
      if (title && title !== node.title) changes.title = title;
      if (address) {
        const url = normalizeUrl(address.value);
        if (!url) {
          error.textContent = t("invalidUrl");
          error.hidden = false;
          address.setAttribute("aria-invalid", "true");
          address.focus();
          return;
        }
        if (url !== node.url) changes.url = url;
      }
      closePopover({ restoreFocus: false });
      if (!Object.keys(changes).length) return;
      if (changes.url) renamePinnedUrl(node.url, changes.url);
      ext.bookmarks.update(node.id, changes).catch((e) => console.warn("ReStart: edit failed", e));
    };
    for (const input of [name, address].filter(Boolean)) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); save(); }
        if (e.key === "Escape") { e.stopPropagation(); closePopover(); }
      });
    }
    els.popover.replaceChildren(...[
      h("div", { class: "pop-section" }, t("name")),
      name,
      address ? h("div", { class: "pop-section" }, t("url")) : null,
      address,
      error,
      h("div", { class: "btn-row", style: "justify-content:flex-end" },
        h("button", { class: "text-btn", onclick: () => closePopover() }, t("cancel")),
        h("button", { class: "text-btn primary", onclick: save }, t("save"))),
    ].filter(Boolean));
    els.popover.classList.add("form-pop"); // a small form: more room than a menu (reset on the next popover)
    name.focus();
    name.select();
  };

  openPopover(anchor, [], { cls: "menu", at: { x, y } });
  els.popover.setAttribute("role", "menu");
  showMain();
  placeAt(x, y);
}

/* ----- Folder context menu: rename or delete a folder ----- */

function openFolderMenu(node, anchor, x, y) {
  if (node.unmodifiable) return; // managed (policy) folders can't be changed
  const item = (label, icon, onclick, cls = "") =>
    h("button", { class: `menu-item ${cls}`.trim(), role: "menuitem", onclick }, svg(icon), label);
  const count = countLinks(node);

  const showMain = () => {
    const remove = () => {
      closePopover({ restoreFocus: false });
      ext.bookmarks.removeTree(node.id).catch((e) => console.warn("ReStart: delete failed", e));
    };
    // A folder with something inside asks first, plainly; an empty one is deleted with a second click.
    const del = item(t("delete"), UI.trash, () => {
      if (node.children?.length) { showConfirmDelete(remove); return; }
      if (!del.classList.contains("armed")) {
        del.classList.add("armed");
        del.lastChild.textContent = t("confirmDelete");
        placeAt(x, y);
        return;
      }
      remove();
    }, "danger");
    const moveTo = !state.query && state.byId.has(node.parentId) ? item(t("moveTo"), UI.subfolder, () => showMoveTo(node, x, y)) : null;
    els.popover.replaceChildren(...[moveTo, h("div", { class: "menu-sep" }), item(t("rename"), UI.edit, showRename), del].filter(Boolean));
  };

  // The folder and all it holds go to the browser's bookmarks bin of no return: say so before.
  const showConfirmDelete = (remove) => {
    const cancel = h("button", { class: "text-btn", onclick: () => closePopover() }, t("cancel"));
    els.popover.replaceChildren(
      h("div", { class: "del-title", id: "del-title" }, t("deleteFolderQ", cleanText(node.title) || t("folderName"))),
      h("p", { class: "del-warn" }, t("deleteFolderWarn")),
      count ? h("p", { class: "del-count" }, count === 1 ? t("oneBookmarkInside") : t("bookmarksInside", String(count))) : null,
      h("div", { class: "btn-row", style: "justify-content:flex-end" },
        cancel,
        h("button", { class: "text-btn danger", onclick: remove }, svg(UI.trash), t("delete"))),
    );
    els.popover.setAttribute("role", "alertdialog");
    els.popover.setAttribute("aria-labelledby", "del-title");
    els.popover.classList.add("form-pop");
    placeAt(x, y);
    cancel.focus(); // the safe choice is the default
  };

  const showRename = () => {
    const input = h("input", { class: "icon-filter", type: "text", maxlength: "100", value: node.title || "", "aria-label": t("rename") });
    const save = () => {
      const title = cleanText(input.value.trim());
      closePopover({ restoreFocus: false });
      if (!title || title === node.title) return;
      // Folder customizations, order and visibility are keyed by title: carry them over.
      if (node.parentId === state.bar.id) moveFolderPrefs(node.title, title);
      ext.bookmarks.update(node.id, { title }).catch((e) => console.warn("ReStart: rename failed", e));
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); save(); }
      if (e.key === "Escape") { e.stopPropagation(); closePopover(); }
    });
    els.popover.replaceChildren(
      h("div", { class: "pop-section" }, t("rename")),
      input,
      h("div", { class: "btn-row", style: "justify-content:flex-end" },
        h("button", { class: "text-btn", onclick: () => closePopover() }, t("cancel")),
        h("button", { class: "text-btn primary", onclick: save }, t("save"))),
    );
    els.popover.classList.add("form-pop");
    placeAt(x, y);
    input.focus();
    input.select();
  };

  openPopover(anchor, [], { cls: "menu", at: { x, y } });
  els.popover.setAttribute("role", "menu");
  showMain();
  placeAt(x, y);
}

function moveFolderPrefs(from, to) {
  const swap = (list) => list.map((k) => (k === from ? to : k));
  const items = { order: swap(state.order), hidden: swap(state.hidden) };
  state.order = items.order;
  state.hidden = items.hidden;
  if (state.openCols.has(from)) { state.openCols.delete(from); state.openCols.add(to); items.openCols = [...state.openCols]; }
  if (state.closedCols.has(from)) { state.closedCols.delete(from); state.closedCols.add(to); items.closedCols = [...state.closedCols]; }
  const style = state.folderStyles[from];
  if (style && !Object.hasOwn(state.folderStyles, to)) {
    state.folderStyles[to] = style;
    delete state.folderStyles[from];
    items[STYLE_PREFIX + to] = style;
    store.remove(STYLE_PREFIX + from).catch(() => {});
  }
  saveLocal(items);
}

/* ----- Most visited context menu: add the site to the bookmarks ----- */

function bookmarkedUrls() {
  const urls = new Set();
  const walk = (node, depth = 0) => {
    if (depth > 64) return;
    for (const c of node?.children || []) c.url ? urls.add(c.url) : walk(c, depth + 1);
  };
  walk(state.bar);
  walk(state.other);
  return urls;
}

function openTopSiteMenu(node, anchor, x, y) {
  const canOpen = !isScriptUrl(node.url);
  const known = bookmarkedUrls().has(node.url);
  const title = cleanText(node.title || hostOf(node.url) || node.url);
  const item = (label, icon, onclick, opts = {}) =>
    h("button", { class: "menu-item", role: "menuitem", onclick, disabled: opts.disabled || null }, icon ? svg(icon) : h("span", { class: "menu-ico" }), label);

  const add = (parentId) => {
    closePopover({ restoreFocus: false });
    ext.bookmarks.create({ parentId, title, url: node.url }).catch((e) => console.warn("ReStart: could not add bookmark", e));
  };

  const showMain = () => {
    els.popover.replaceChildren(...[
      canOpen ? item(t("openNewTab"), UI.openNew, () => { closePopover(); openUrl(node.url, { newTab: true }); }) : null,
      item(t("copyLink"), UI.link, () => { navigator.clipboard?.writeText(node.url).catch(() => {}); closePopover(); }),
      canOpen ? h("div", { class: "menu-sep" }) : null,
      canOpen ? item(known ? t("alreadyBookmarked") : t("addBookmark"), UI.bookmarkAdd, showFolders, { disabled: known }) : null,
    ].filter(Boolean));
  };

  // Where to add it: the bookmarks bar, one of its folders, Other bookmarks, or a new folder.
  const showFolders = () => {
    const targets = [state.bar, ...state.bar.children.filter((c) => !c.url), state.other]
      .filter((f) => f && !f.unmodifiable);
    els.popover.replaceChildren(
      h("div", { class: "pop-section" }, t("addTo")),
      ...targets.map((f) => item(cleanText(f.title) || t("bookmarksBar"), f === state.bar ? UI.bookmarkAdd : ICONS.folder, () => add(f.id))),
      h("div", { class: "menu-sep" }),
      item(t("newFolder"), UI.newFolder, showNewFolder),
    );
    els.popover.querySelector(".menu-item")?.focus();
    placeAt(x, y);
  };

  // New folder at the end of the bookmarks bar, with the site inside.
  const showNewFolder = () => {
    const input = h("input", { class: "icon-filter", type: "text", maxlength: "100", placeholder: t("folderName"), "aria-label": t("folderName") });
    const create = async () => {
      const name = cleanText(input.value.trim());
      if (!name) { input.focus(); return; }
      closePopover({ restoreFocus: false });
      try {
        const folder = await ext.bookmarks.create({ parentId: state.bar.id, title: name });
        await ext.bookmarks.create({ parentId: folder.id, title, url: node.url });
      } catch (e) {
        console.warn("ReStart: could not create folder", e);
      }
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); create(); }
      if (e.key === "Escape") { e.stopPropagation(); closePopover(); }
    });
    els.popover.replaceChildren(
      // The menu item ends with an ellipsis ("New folder…"); the form's title doesn't.
      h("div", { class: "pop-section" }, t("newFolder").replace(/(…|\.\.\.)$/, "")),
      input,
      h("div", { class: "btn-row", style: "justify-content:flex-end" },
        h("button", { class: "text-btn", onclick: () => closePopover() }, t("cancel")),
        h("button", { class: "text-btn primary", onclick: create }, t("create"))),
    );
    els.popover.classList.add("form-pop");
    placeAt(x, y);
    input.focus();
  };

  openPopover(anchor, [], { cls: "menu", at: { x, y } });
  els.popover.setAttribute("role", "menu");
  showMain();
  placeAt(x, y);
}

function closePopover({ restoreFocus = true } = {}) {
  hideTip();
  if (els.popover.hidden) return;
  els.popover.hidden = true;
  els.popover.setAttribute("role", "dialog");
  popoverAnchor?.setAttribute("aria-expanded", "false");
  if (restoreFocus && popoverAnchor?.isConnected) popoverAnchor.focus({ preventScroll: true });
  popoverAnchor = null;
}

document.addEventListener("pointerdown", (e) => {
  if (!els.popover.hidden && !els.popover.contains(e.target) && !popoverAnchor?.contains(e.target)) closePopover();
});

/* ----- Folder icon picker ----- */

function saveFolderStyle(title, patch) {
  const next = { ...(state.folderStyles[title] || {}), ...patch };
  for (const k of Object.keys(next)) if (next[k] == null) delete next[k];
  const key = STYLE_PREFIX + title;
  if (Object.keys(next).length) {
    state.folderStyles[title] = next;
    saveLocal({ [key]: next });
  } else {
    delete state.folderStyles[title];
    store.remove(key);
  }
  render();
}

function openIconPicker(anchor, title) {
  const current = () => state.folderStyles[title] || {};
  const iconNames = Object.keys(ICONS);

  // Last swatch: a color of your own, with the same picker as the background colors.
  openPicker = null;
  const cur = current().color;
  const pickerBox = h("div", { class: "folder-cp" });
  let saveTimer = 0, drawQueued = false;
  const customSwatch = h("button", {
    class: "swatch swatch-custom", title: t("customColor"), "aria-label": t("customColor"),
    style: HEX_COLOR.test(cur) ? `background:${cur}` : null,
    "aria-pressed": String(HEX_COLOR.test(cur)), "aria-expanded": "false",
    onclick: () => {
      if (openPicker === "folder") { closeFolderPicker(); return; }
      openPicker = "folder";
      customSwatch.setAttribute("aria-expanded", "true");
      const c = current().color;
      pickerBox.replaceChildren(colorPickerPanel("folder", HEX_COLOR.test(c) ? c : null, pastelOf(c || "blue").light, (color) => {
        // Live: the folder takes the color while you drag; saved once you pause.
        state.folderStyles[title] = { ...current(), color };
        if (!drawQueued) { drawQueued = true; requestAnimationFrame(() => { drawQueued = false; render(); }); }
      }, {
        afterPick: () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveFolderStyle(title, {}), 300); },
        onClose: () => closeFolderPicker(),
      }));
    },
  });
  const closeFolderPicker = () => {
    openPicker = null;
    customSwatch.setAttribute("aria-expanded", "false");
    pickerBox.replaceChildren();
    customSwatch.focus();
  };

  const swatches = h("div", { class: "swatches", role: "group", "aria-label": t("color") },
    PASTELS.map((p) => h("button", {
      class: "swatch",
      style: `background:${pastel(p.id)}`,
      "aria-label": colorName(p.id),
      title: colorName(p.id),
      "aria-pressed": String((current().color || "gray") === p.id),
      onclick: (e) => {
        swatches.querySelectorAll(".swatch").forEach((s) => s.setAttribute("aria-pressed", "false"));
        e.currentTarget.setAttribute("aria-pressed", "true");
        if (openPicker === "folder") closeFolderPicker();
        clearTimeout(saveTimer);
        saveFolderStyle(title, { color: p.id === "gray" ? null : p.id });
      },
    })), customSwatch);

  const grid = h("div", { class: "icon-grid", role: "group", "aria-label": t("icon") });
  const drawGrid = (filter = "") => {
    const f = normalize(filter).replace(/\s+/g, "_");
    grid.replaceChildren(...iconNames.filter((n) => !f || n.includes(f)).map((n) =>
      h("button", {
        class: "icon-cell",
        title: n.replace(/_/g, " "),
        "aria-label": n.replace(/_/g, " "),
        "aria-pressed": String(current().icon === n),
        onclick: (e) => {
          const same = current().icon === n;
          grid.querySelectorAll(".icon-cell").forEach((c) => c.setAttribute("aria-pressed", "false"));
          if (!same) e.currentTarget.setAttribute("aria-pressed", "true");
          saveFolderStyle(title, { icon: same ? null : n });
        },
      }, svg(ICONS[n]))));
  };
  drawGrid();

  const filter = h("input", { class: "icon-filter", type: "search", placeholder: t("searchIcons"), "aria-label": t("searchIcons") });
  filter.addEventListener("input", () => drawGrid(filter.value));

  openPopover(anchor, [
    h("div", { class: "pop-head" },
      h("span", { class: "pop-title" }, cleanText(title)),
      // Back to the default look (no color, the folder symbol): a reset arrow, not a trash can,
      // since the folder itself stays.
      h("button", { class: "icon-btn", "aria-label": t("resetStyle"), title: t("resetStyle"),
        onclick: () => { saveFolderStyle(title, { icon: null, color: null }); closePopover(); } }, svg(UI.restart))),
    h("div", { class: "pop-section" }, t("color")),
    swatches,
    pickerBox,
    h("div", { class: "pop-section" }, t("icon")),
    filter,
    grid,
  ]);
  filter.focus();
}

/* ----- Settings ----- */

// The four kinds of background offered in Settings and on the welcome screen.
const bgGroup = () => { const type = state.settings.bg.type; return type === "none" ? "color" : isLit(type) ? "light" : type; };
function chooseBackground(v) {
  const bg = state.settings.bg;
  if (!["color", "light", "leaves", "snow"].includes(v)) return;
  if (v === bgGroup()) return;
  // Light opens on the glow, or stays on the kind of light already chosen. Between the
  // backgrounds that have a color underneath, that color is kept.
  if (v === "light") v = isLit(bg.type) ? bg.type : "glow";
  const keep = isLit(v) && isLit(bg.type);
  const keepTint = hasUnderColor(v) && hasUnderColor(bg.type) && bg.tint;
  state.settings.bg = { type: v, value: keep ? bg.value : null, ...(keepTint ? { tint: bg.tint } : {}) };
  saveSettings();
}

function saveSettings() {
  clearTimeout(saveTimer);
  saveLocal({ settings: state.settings });
  applyAppearance();
}
// For continuous inputs (sliders): apply now, save once settled.
let saveTimer;
function saveSettingsSoon() {
  applyAppearance();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveLocal({ settings: state.settings }), 400);
}

function segmented(options, value, onChange) {
  const wrap = h("div", { class: "segmented", role: "group" });
  for (const [v, label] of options) {
    wrap.append(h("button", {
      "aria-pressed": String(v === value),
      onclick: (e) => {
        wrap.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
        e.currentTarget.setAttribute("aria-pressed", "true");
        onChange(v);
      },
    }, label));
  }
  return wrap;
}

function switchRow(id, label, checked, onChange) {
  const sw = h("input", { type: "checkbox", class: "switch", id });
  sw.checked = checked;
  sw.addEventListener("change", () => onChange(sw.checked));
  return h("label", { class: "setting-row", for: id }, h("span", { class: "set-label" }, label), sw);
}

// Explanations stay out of the way: a small (i) next to a title shows them in a small
// bubble on hover or keyboard focus (and on tap). The bubble lives on <body>, so the
// scrolling settings panel never clips it.
const INFO_ICON = "M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z";
const tip = h("div", { class: "info-tip", id: "info-tip", role: "tooltip", hidden: true });
document.body.append(tip);
let tipFor = null;
function showTip(btn, text) {
  tip.textContent = text;
  tip.hidden = false;
  tipFor = btn;
  const r = btn.getBoundingClientRect();
  const w = tip.offsetWidth, hgt = tip.offsetHeight;
  const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8));
  const below = r.bottom + 8 + hgt < innerHeight - 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${below ? r.bottom + 8 : r.top - hgt - 8}px`;
}
function hideTip() { tip.hidden = true; tipFor = null; }
const infoBtn = (key, text) => {
  const btn = h("button", { class: "info-btn", type: "button", "aria-label": t("moreInfo"), "aria-describedby": "info-tip", "data-key": key }, svg(INFO_ICON));
  btn.addEventListener("mouseenter", () => showTip(btn, text));
  btn.addEventListener("mouseleave", hideTip);
  btn.addEventListener("focus", () => showTip(btn, text));
  btn.addEventListener("blur", hideTip);
  btn.addEventListener("click", () => (tipFor === btn && !tip.hidden ? hideTip() : showTip(btn, text)));
  return btn;
};
els.popover.addEventListener("scroll", hideTip, { passive: true });

function rangeRow(label, min, max, step, value, onInput, format) {
  const input = h("input", { type: "range", min, max, step, value, "aria-label": label });
  const out = format ? h("output", { class: "range-value" }, format(value)) : null;
  input.addEventListener("input", () => {
    const v = Number(input.value);
    if (out) out.textContent = format(v);
    onInput(v);
  });
  return h("div", { class: "range-row" }, h("span", {}, label),
    h("div", { class: "range-track" }, input, out));
}

let settingsMsg = "";

// A rounded box grouping related settings, like macOS System Settings.
const group = (...children) => h("div", { class: "set-group" }, ...children.flat().filter(Boolean));

/* ----- Color picker: ReStart's own, so it looks and works the same in every browser ----- */

let openPicker = null; // the picker open in the settings: "glow" | "tint" | "color"

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const hexToRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
function rgbToHsv(r, g, b) {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let hue = 0;
  if (d) {
    hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return [hue, max ? d / max : 0, max];
}
function hsvToRgb(hue, sat, val) {
  const f = (n) => { const k = (n + hue / 60) % 6; return (val - val * sat * Math.max(0, Math.min(k, 4 - k, 1))) * 255; };
  return [f(5), f(3), f(1)];
}
// A hex code typed by hand ("eadef7", "#EADEF7" or "eaf"), as #rrggbb, or null.
function parseHex(text) {
  const v = String(text).trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
  if (/^[0-9a-f]{3}$/.test(v)) return `#${[...v].map((c) => c + c).join("")}`;
  return null;
}

// Last swatch of a color row: shows the custom color and opens the picker below the row.
function customColorSwatch(key, current, cls) {
  const custom = HEX_COLOR.test(current) ? current : null;
  return h("button", {
    class: `${cls} swatch-custom`, title: t("customColor"), "aria-label": t("customColor"),
    style: custom ? `background:${custom}` : null,
    "aria-pressed": String(!!custom), "aria-expanded": String(openPicker === key),
    onclick: () => { openPicker = openPicker === key ? null : key; refreshSettings(); },
  });
}

// Saturation/brightness area, hue slider and hex field (shown first, as the main input).
// Used in the settings (glow, tint, page color) and in a folder's style popover: opts.onClose
// and opts.afterPick replace the settings' own refresh and save.
function colorPickerPanel(key, current, fallback, onPick, opts = {}) {
  if (openPicker !== key) return null;
  let [hue, sat, val] = rgbToHsv(...hexToRgb(HEX_COLOR.test(current) ? current : fallback));
  const knob = h("span", { class: "cp-knob" });
  const area = h("div", { class: "cp-area", tabindex: "0", role: "slider", "aria-label": t("customColor") }, knob);
  const hueInput = h("input", { type: "range", class: "cp-hue", min: "0", max: "359", step: "1", value: String(Math.round(hue)), "aria-label": t("hue") });
  const preview = h("span", { class: "cp-preview" });
  const hex = h("input", { type: "text", class: "cp-hex", maxlength: "7", spellcheck: "false", autocomplete: "off", "aria-label": "HEX" });

  const draw = (fromHex = false) => {
    const color = rgbToHex(...hsvToRgb(hue, sat, val));
    area.style.setProperty("--hue", String(hue));
    knob.style.left = `${sat * 100}%`;
    knob.style.top = `${(1 - val) * 100}%`;
    preview.style.background = color;
    area.setAttribute("aria-valuetext", color);
    if (!fromHex) { hex.value = color.slice(1); hex.classList.remove("invalid"); }
    return color;
  };
  // A change made by the user: apply it, and show it as the selected swatch of the row.
  const commit = (fromHex = false) => {
    const color = draw(fromHex);
    const swatch = els.popover.querySelector('.swatch-custom[aria-expanded="true"]');
    if (swatch) {
      swatch.parentElement.querySelectorAll("[aria-pressed]").forEach((el) => el.setAttribute("aria-pressed", "false"));
      swatch.style.background = color;
      swatch.setAttribute("aria-pressed", "true");
    }
    onPick(color);
    (opts.afterPick || saveSettingsSoon)();
  };
  const close = () => { openPicker = null; (opts.onClose || refreshSettings)(); };

  const fromPointer = (e) => {
    const r = area.getBoundingClientRect();
    sat = clamp01((e.clientX - r.left) / r.width);
    val = 1 - clamp01((e.clientY - r.top) / r.height);
    commit();
  };
  area.addEventListener("pointerdown", (e) => { area.setPointerCapture(e.pointerId); fromPointer(e); });
  area.addEventListener("pointermove", (e) => { if (area.hasPointerCapture(e.pointerId)) fromPointer(e); });
  area.addEventListener("keydown", (e) => {
    const d = e.shiftKey ? 0.1 : 0.02;
    const step = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
    if (!step) return;
    e.preventDefault();
    sat = clamp01(sat + step[0]);
    val = clamp01(val + step[1]);
    commit();
  });
  hueInput.addEventListener("input", () => { hue = Number(hueInput.value); commit(); });
  hex.addEventListener("input", () => {
    const parsed = parseHex(hex.value);
    hex.classList.toggle("invalid", !!hex.value.trim() && !parsed);
    if (!parsed) return;
    [hue, sat, val] = rgbToHsv(...hexToRgb(parsed));
    hueInput.value = String(Math.round(hue));
    commit(true);
  });
  hex.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); close(); } });

  draw();
  return h("div", { class: "cp" },
    h("div", { class: "cp-row" },
      preview, h("span", { class: "cp-hash" }, "#"), hex,
      h("button", { class: "text-btn primary cp-done", onclick: close }, t("done"))),
    area, hueInput);
}

function settingsContent() {
  const s = state.settings;
  const bg = s.bg || { type: "color", value: null };

  // Background choices
  let bgExtra = null;
  if (hasUnderColor(bg.type)) {
    const lit = isLit(bg.type);
    const leaves = bg.type === "leaves";
    const snowy = bg.type === "snow";
    const plainUnder = leaves || snowy; // no glow color to pick
    const glow = glowOf(bg.value);
    const selected = glow.id;
    const customGlow = glow.id === "custom" ? glow.base : null;
    const customSwatch = customColorSwatch("glow", customGlow, "swatch");
    const tintSwatch = customColorSwatch("tint", bg.tint, "bg-preset");
    const withTint = (value) => (s.bg.tint ? { type: bg.type, value, tint: s.bg.tint } : { type: bg.type, value });
    bgExtra = h("div", {},
      lit ? h("div", { class: "leaf-kind" }, segmented([["glow", t("bgGlow")], ["rays", t("styleRays")]], bg.type,
        // Switching between the glow and the rays keeps the color and the color underneath.
        (v) => { s.bg = { ...s.bg, type: v }; saveSettings(); refreshSettings(); })) : null,
      snowy ? h("div", { class: "leaf-kind" }, segmented(BREEZE_KINDS.map((k) => [k, k === "season" ? [svg(ICONS.sunny, "seg-sun"), t("breeze_season")] : t(`breeze_${k}`)]), BREEZE_KINDS.includes(bg.value) ? bg.value : "season",
        (v) => { s.bg = { ...s.bg, value: v === "season" ? null : v }; saveSettings(); })) : null,
      leaves ? h("div", { class: "leaf-kind" }, segmented([["leaves", t("leafKindLeaves")], ["palm", t("leafKindPalm")], ["bamboo", t("leafKindBamboo")]], LEAF_KINDS.includes(bg.value) ? bg.value : "leaves",
        (v) => { s.bg = { ...s.bg, value: LEAF_KINDS.includes(v) ? v : null }; saveSettings(); })) : null,
      plainUnder ? null : h("div", { class: "swatches", role: "group", "aria-label": t("glowColor") },
        GLOW_COLORS.map((c) => h("button", {
        class: "swatch", title: colorName(c.id), "aria-label": colorName(c.id),
        style: `background:${c.swatch}`,
        "aria-pressed": String(c.id === selected),
        onclick: () => { s.bg = { type: bg.type, value: { color: c.id, custom: bg.value?.custom }, tint: bg.tint }; saveSettings(); refreshSettings(); },
      }, c.id === "sky" ? svg(ICONS.sunny, "swatch-sun") : null)), customSwatch),
      plainUnder ? null : colorPickerPanel("glow", customGlow || (HEX_COLOR.test(bg.value?.custom) ? bg.value.custom : null), "#ff8c46",
        (v) => { s.bg = withTint({ color: "custom", custom: v }); }),
      h("div", { class: "set-label tint-label" }, t("bgTint")),
      h("div", { class: "bg-presets tint-presets" },
        // No chosen color: the background follows the hour (marked with a small sun, like Sky).
        h("button", {
          class: "bg-preset bg-preset-auto", title: t("hourColor"), "aria-label": t("hourColor"),
          "aria-pressed": String(!bg.tint),
          onclick: () => { delete s.bg.tint; saveSettings(); refreshSettings(); },
        }, svg(ICONS.sunny, "swatch-sun")),
        BG_PASTELS.map((p) => h("button", {
          class: "bg-preset", title: colorName(p.id), "aria-label": colorName(p.id),
          style: `background:${plainColor(p.id)}`,
          "aria-pressed": String(bg.tint === p.id),
          onclick: () => { s.bg.tint = p.id; saveSettings(); refreshSettings(); },
        })),
        tintSwatch),
      colorPickerPanel("tint", bg.tint, "#dfe8f7", (v) => { s.bg.tint = v; }),
      // Shown on a 0-100 scale, the default intensity sitting in the middle.
      rangeRow(t("intensity"), 0, 100, 5, Math.round((s.glowStrength ?? 1) * 50), (v) => { s.glowStrength = v / 50; saveSettingsSoon(); },
        (v) => percent.format(v / 100)),
      // Speed of the movement, on the same 0-100 scale: 0 is still, the middle is the normal pace.
      rangeRow(t("motion"), 0, 100, 5, Math.round((s.motion ?? 1) * 50), (v) => { s.motion = v / 50; saveSettingsSoon(); },
        (v) => (v === 0 ? t("motionStill") : percent.format(v / 100))));
  } else if (bg.type === "color") {
    const colorSwatch = customColorSwatch("color", bg.value, "bg-preset");
    bgExtra = h("div", {}, h("div", { class: "bg-presets" },
      // First: no chosen color, the page follows the hour (a small sun, like elsewhere).
      h("button", {
        class: "bg-preset bg-preset-auto", title: t("hourColor"), "aria-label": t("hourColor"),
        "aria-pressed": String(!bg.value),
        onclick: () => { s.bg = { type: "color", value: null }; saveSettings(); refreshSettings(); },
      }, svg(ICONS.sunny, "swatch-sun")),
      BG_PASTELS.map((p) => h("button", {
        class: "bg-preset", title: colorName(p.id), "aria-label": colorName(p.id),
        style: `background:${plainColor(p.id)}`,
        "aria-pressed": String(bg.value === p.id),
        onclick: () => { s.bg = { type: "color", value: p.id }; saveSettings(); refreshSettings(); },
      })),
      colorSwatch),
      colorPickerPanel("color", bg.value, "#dfe8f7", (v) => { s.bg = { type: "color", value: v }; }));
  }

  // Column list: show/hide and reorder (drag the handle, or use the arrows).
  const keys = allColumnKeys();
  const move = (key, delta) => {
    const next = keys.filter((k) => k !== key);
    const at = Math.max(0, Math.min(next.length, keys.indexOf(key) + delta));
    next.splice(at, 0, key);
    saveOrder(next);
    refreshSettings();
  };
  const colList = h("div", { class: "col-list" });
  let dragging = null;
  keys.forEach((key, index) => {
    const rawLabel = labelForKey(key);
    if (!rawLabel) return;
    const label = cleanText(rawLabel);
    const id = `col-${hash(key)}`;
    const empty = isEmptyKey(key);
    const sw = h("input", { type: "checkbox", class: "switch", id, "aria-label": t("showColumn", label) });
    sw.checked = !empty && !state.hidden.includes(key);
    sw.disabled = empty;
    sw.addEventListener("change", async () => {
      state.hidden = sw.checked ? state.hidden.filter((k) => k !== key) : [...state.hidden, key];
      await saveLocal({ hidden: state.hidden });
      if (key === KEY_TOP && sw.checked && !state.topSites.length) await loadTopSites();
      render();
    });
    const glyph = key === KEY_TOP ? topGlyph() : key === KEY_SITES ? sitesGlyph() : folderGlyph(key === KEY_OTHER ? state.other?.title : key);
    const row = h("div", { class: `setting-row col-row${empty ? " is-empty" : ""}`, draggable: "true", "data-key": key, title: empty ? t("emptyHint") : null },
      h("span", { class: "drag-handle", title: t("dragToReorder"), "aria-hidden": "true" }, svg(UI.drag)),
      h("span", { class: "row-label" }, glyph, h("span", {}, label), empty ? h("span", { class: "empty-tag" }, t("emptyTag")) : null),
      h("span", { class: "row-moves" },
        h("button", { class: "mini-btn", "aria-label": `${t("moveUp")} : ${label}`, title: t("moveUp"), disabled: index === 0, onclick: () => move(key, -1) }, "↑"),
        h("button", { class: "mini-btn", "aria-label": `${t("moveDown")} : ${label}`, title: t("moveDown"), disabled: index === keys.length - 1, onclick: () => move(key, 1) }, "↓")),
      sw);
    row.addEventListener("dragstart", (e) => { dragging = key; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", key); row.classList.add("dragging"); });
    row.addEventListener("dragend", () => { dragging = null; colList.querySelectorAll(".col-row").forEach((r) => r.classList.remove("dragging", "drop-before", "drop-after")); });
    row.addEventListener("dragover", (e) => {
      if (!dragging || dragging === key) return;
      e.preventDefault();
      const r = row.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      row.classList.toggle("drop-before", before);
      row.classList.toggle("drop-after", !before);
    });
    row.addEventListener("dragleave", (e) => { if (!row.contains(e.relatedTarget)) row.classList.remove("drop-before", "drop-after"); });
    row.addEventListener("drop", (e) => {
      if (!dragging) return;
      e.preventDefault();
      const before = row.classList.contains("drop-before");
      const next = keys.filter((k) => k !== dragging);
      next.splice(next.indexOf(key) + (before ? 0 : 1), 0, dragging);
      saveOrder(next);
      refreshSettings();
    });
    colList.append(row);
  });

  return [
    h("div", { class: "settings-title" }, t("settings")),

    h("div", { class: "set-section" }, t("appearance")),
    group(
      h("div", { class: "set-field" },
        h("div", { class: "set-label" }, t("theme")),
        segmented([["auto", t("themeAuto")], ["light", t("themeLight")], ["dark", t("themeDark")]], s.theme, (v) => {
          s.theme = v; saveSettings(); render(); refreshSettings();
        })),
      h("div", { class: "set-field" },
        h("div", { class: "set-label" }, t("background"), hasUnderColor(bg.type) ? infoBtn("bg", t(bg.type === "leaves" ? "leavesHint" : bg.type === "snow" ? "snowHint" : "glowHint")) : null),
        segmented([["color", t("bgColor")], ["light", t("bgLight")], ["leaves", t("bgLeaves")], ["snow", t("bgSnow")]], bgGroup(), (v) => {
          chooseBackground(v);
          refreshSettings();
        }),
        bgExtra),
      h("div", { class: "set-field" },
        rangeRow(t("colOpacity"), 0, 1, 0.05, s.colAlpha, (v) => { s.colAlpha = v; saveSettingsSoon(); },
          (v) => percent.format(v))),
      switchRow("set-letter-icons", t("letterIcons"), !!s.letterIcons, (v) => { s.letterIcons = v; saveSettings(); render(); }),
      switchRow("set-tile-names", t("hideTileNames"), !!s.hideTileNames, (v) => { s.hideTileNames = v; saveSettings(); render(); }),
      h("div", { class: "set-field" },
        h("div", { class: "set-label" }, t("layout"), narrowQuery.matches ? infoBtn("layout", t("layoutNarrowHint")) : null),
        segmented([["masonry", t("layoutMasonry")], ["board", t("layoutBoard")]], s.layout, (v) => { s.layout = v; saveSettings(); render(); }),
        null),
    ),

    h("div", { class: "set-section" }, t("focusMode"), infoBtn("focus", t("focusHint"))),
    group(
      switchRow("set-focus-clock", t("focusClock"), s.focusClock !== false, (v) => { s.focusClock = v; saveSettings(); refreshSettings(); }),
      s.focusClock !== false ? h("div", { class: "set-field" },
        h("div", { class: "set-label" }, t("clockFormat")),
        segmented([["auto", t("clockAuto")], ["12", t("clock12")], ["24", t("clock24")]], s.clockFormat || "auto",
          (v) => { s.clockFormat = v; saveSettings(); })) : null,
      switchRow("set-focus-icons", t("focusIcons"), !!s.focusIcons, (v) => { s.focusIcons = v; saveSettings(); render(); refreshSettings(); }),
      s.focusIcons ? switchRow("set-focus-gray", t("focusGray"), !!s.focusGray, (v) => { s.focusGray = v; saveSettings(); render(); }) : null,
    ),

    h("div", { class: "set-section" }, t("columns"), infoBtn("columns", t("columnsHint"))),
    group(colList),

    h("div", { class: "set-section" }, t("data"), infoBtn("data", t("dataHint"))),
    group(
      h("div", { class: "btn-row" },
        h("button", { class: "text-btn", onclick: exportData }, svg(UI.download), t("export")),
        h("button", { class: "text-btn", onclick: () => els.fileImport.click() }, svg(UI.upload), t("import"))),
      settingsMsg ? h("p", { class: "set-msg", role: "status" }, settingsMsg) : null,
    ),
    h("div", { class: "btn-row" },
      h("button", { class: "text-btn", onclick: () => { closePopover({ restoreFocus: false }); showWelcome(); } },
        svg(UI.restart), t("welcomeAgain"))),
  ].filter(Boolean);
}

// Folders without any bookmark: hidden on the page, listed as disabled in the settings.
function isEmptyKey(k) {
  if (k === KEY_OTHER) return !countLinks(state.other || {});
  const folder = state.bar.children.find((c) => !c.url && c.title === k);
  return !!folder && !countLinks(folder);
}

function labelForKey(k) {
  if (k === KEY_TOP) return t("mostVisited");
  if (k === KEY_SITES) return sitesOverflow() ? state.bar.title : null;
  if (k === KEY_OTHER) return state.other?.title || t("otherBookmarks");
  return state.bar.children.some((c) => !c.url && c.title === k) ? k : null;
}

function openSettings() {
  settingsMsg = "";
  openPicker = null;
  openPopover(els.settingsBtn, settingsContent(), { align: "end", cls: "settings" });
}
function refreshSettings() {
  if (els.popover.hidden || popoverAnchor !== els.settingsBtn) return;
  const y = els.popover.scrollTop;
  // Rebuild the content in place: the panel keeps its position and scroll, so
  // nothing moves under the pointer while settings are changed.
  hideTip(); // its (i) is about to be replaced
  els.popover.replaceChildren(...settingsContent());
  els.popover.scrollTop = y;
}
els.settingsBtn.addEventListener("click", () =>
  (els.popover.hidden || popoverAnchor !== els.settingsBtn ? openSettings() : closePopover()));

/* ----- Export / import ----- */

async function exportData() {
  const all = await store.get(null);
  const prefs = Object.fromEntries(Object.entries(all).filter(([k]) => isPrefKey(k)));
  // Save the column order as shown, so the backup knows every folder that exists now.
  if (state.bar) prefs.order = allColumnKeys();
  // "sync" is kept as the field name so files exported by pre-release builds stay compatible.
  const data = { app: "restart", version: 1, exportedAt: new Date().toISOString(), sync: prefs };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `restart-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// What the import could apply: folder customizations are matched by folder name, so
// say which named folders were not found, and which current folders the file doesn't know.
function importSummary(prefs) {
  const special = new Set([KEY_TOP, KEY_SITES, KEY_OTHER]);
  const named = new Set();
  for (const k of [...(prefs.order || []), ...(prefs.hidden || [])]) if (!special.has(k)) named.add(k);
  for (const k of Object.keys(prefs)) if (k.startsWith(STYLE_PREFIX)) named.add(k.slice(STYLE_PREFIX.length));
  const present = new Set(state.bar.children.filter((c) => !c.url).map((c) => c.title));
  const missing = [...named].filter((k) => !present.has(k));
  const found = [...named].filter((k) => present.has(k) && !isEmptyKey(k)).length;
  const list = (names) => {
    const shown = names.slice(0, 6).map((n) => cleanText(n) || "?");
    if (names.length > 6) shown.push(`+${names.length - 6}`);
    try { return new Intl.ListFormat(t("lang"), { type: "conjunction" }).format(shown); }
    catch { return shown.join(", "); }
  };
  const lines = [!missing.length ? t("importAll") : found ? t("importPartial", found) : t("importDone")];
  if (missing.length) lines.push(t("importMissing", list(missing)));
  const unknown = [...present].filter((k) => !named.has(k) && !isEmptyKey(k));
  if (prefs.order?.length && unknown.length) lines.push(t("importNew", list(unknown)));
  return lines.join("\n");
}

els.fileImport.addEventListener("change", async () => {
  const file = els.fileImport.files?.[0];
  els.fileImport.value = "";
  if (!file) return;
  try {
    if (file.size > 1_000_000) throw new Error("size");
    const data = JSON.parse(await file.text());
    if (!["restart", "launchmark", "ruby-start"].includes(data?.app) /* pre-release names */ || !data.sync || typeof data.sync !== "object") throw new Error("format");
    const clean = sanitizeImport(data.sync);
    const all = await store.get(null);
    const previous = Object.fromEntries(Object.entries(all).filter(([k]) => isPrefKey(k)));
    await store.remove(Object.keys(previous));
    try {
      await store.set(clean);
    } catch (e) {
      await store.set(previous); // don't lose the current setup if the import fails
      throw e;
    }
    await loadStorage();
    applyAppearance();
    render();
    settingsMsg = importSummary(clean);
  } catch {
    settingsMsg = t("importFailed");
  }
  refreshSettings();
});

/* ===================== Search ===================== */

let searchTimer;
els.search.addEventListener("input", () => {
  els.searchLabel.classList.toggle("has-value", !!els.search.value);
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.query = els.search.value; render(); els.board.scrollLeft = 0; }, 60);
});

els.search.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  clearTimeout(searchTimer);
  if (state.query !== els.search.value) { state.query = els.search.value; render(); }
  if (!state.target) return;
  e.preventDefault();
  const url = state.target.getAttribute("href");
  openUrl(url, { newTab: e.metaKey || e.ctrlKey });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (welcome.el) { closeWelcome(); return; }
    if (!els.popover.hidden) { closePopover(); return; }

    if (els.search.value) { els.search.value = ""; els.search.dispatchEvent(new Event("input")); }
    els.search.blur();
    return;
  }
  const t = e.target;
  const typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable;
  if (!typing && !welcome.el && !state.settings.focus && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && els.popover.hidden) {
    els.search.focus();
  }
});

/* ===================== Welcome ===================== */

// Three slides over the dimmed page, shown once on the first new tab and again from Settings.
// Skip, Esc or the last button close it. "welcomed" is a device flag, not a preference:
// it is not exported nor imported. All the text comes from the extension's own messages.
const WELCOME_KICKERS = [null, "w2Kicker", "w3Kicker"];

function localize(root) {
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  for (const attr of ["aria-label", "title", "placeholder"]) {
    root.querySelectorAll(`[data-i18n-${attr}]`).forEach((el) => el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`))));
  }
}

function welcomeGo(n) {
  const el = welcome.el;
  if (!el) return;
  welcome.slide = n = Math.min(3, Math.max(1, n));
  el.querySelectorAll(".wl-slide").forEach((s) => { s.hidden = Number(s.dataset.slide) !== n; });
  const card = el.querySelector(".wl-card");
  card.setAttribute("aria-labelledby", `wl-title-${n}`);
  card.scrollTop = 0; // small windows: each slide starts at its top
  el.querySelector("[data-wl-kicker]").textContent = n === 1 ? t("welcomeTitle", t("appName")) : t(WELCOME_KICKERS[n - 1]);
  el.querySelectorAll(".wl-steps i").forEach((d, i) => d.classList.toggle("on", i === n - 1));
  el.querySelector(".wl-back").style.visibility = n === 1 ? "hidden" : "";
  el.querySelector(".wl-next").textContent = t(n === 3 ? "welcomeStart" : "wNext");
  // On the backgrounds slide the page dims less, so the background picked shows behind.
  el.classList.toggle("see-through", n === 2);
  syncWelcomePicks();
  // Back is hidden on the first slide: don't leave the focus on it.
  if (!el.contains(document.activeElement) || document.activeElement.style.visibility === "hidden") el.querySelector(".wl-next").focus();
}

function syncWelcomePicks() {
  const group = bgGroup();
  welcome.el?.querySelectorAll(".wl-pick").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.bg === group)));
}

function closeWelcome() {
  if (welcome.el) {
    welcome.el.remove();
    welcome.el = null;
    for (const [node, was] of welcome.inert) node.inert = was;
    welcome.inert = [];
    els.page.inert = !!state.settings.focus;
    if (!state.settings.focus) els.search.focus();
  }
  if (!state.welcomed) { state.welcomed = true; saveLocal({ welcomed: true }); }
}

function showWelcome() {
  if (welcome.el) return;
  const el = $("welcome-tpl").content.firstElementChild.cloneNode(true);
  localize(el);

  // Slide 3: the time and date as Focus mode shows them, and the real Keep Awake menu.
  const now = new Date();
  el.querySelector("[data-wl-time]").textContent = (timeFormats[state.settings.clockFormat] || timeFormats.auto).format(now);
  el.querySelector("[data-wl-date]").textContent = dateFormat.format(now);
  if ("wakeLock" in navigator) {
    el.querySelector("[data-wl-sun]").setAttribute("d", AWAKE_ICON);
    el.querySelector("[data-wl-left]").textContent = formatLeft(84 * 60000);
    el.querySelector("[data-wl-menu]").replaceChildren(
      ...AWAKE_FOR.map((mins) => h("span", { class: mins === 120 ? "on" : null }, formatDuration(mins))),
      h("span", {}, t("awakeUntilOff")));
  } else {
    // Keep Awake exists only where the browser offers Screen Wake Lock.
    el.querySelector("[data-wl-awake]").remove();
    el.querySelector(".wl-feats").classList.add("single");
  }

  el.addEventListener("click", (e) => {
    const pick = e.target.closest(".wl-pick");
    if (pick) { chooseBackground(pick.dataset.bg); syncWelcomePicks(); return; }
    const action = e.target.closest("[data-wl]")?.dataset.wl;
    if (action === "skip") closeWelcome();
    else if (action === "back") welcomeGo(welcome.slide - 1);
    else if (action === "next") welcome.slide === 3 ? closeWelcome() : welcomeGo(welcome.slide + 1);
  });

  // Tab and Shift+Tab go round the card's buttons.
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const stops = [...el.querySelectorAll("button")].filter((b) => !b.closest("[hidden]") && b.style.visibility !== "hidden");
    const i = stops.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? stops.length - 1 : i - 1) : (i === -1 || i === stops.length - 1 ? 0 : i + 1);
    e.preventDefault();
    stops[next]?.focus();
  });

  // Modal: everything else is out of reach until the welcome screen closes.
  welcome.inert = [els.page, $("focus-view"), document.querySelector(".topbar")].map((n) => [n, n.inert]);
  for (const [node] of welcome.inert) node.inert = true;
  closePopover({ restoreFocus: false });
  document.body.append(el);
  welcome.el = el;
  welcomeGo(1);
  el.querySelector(".wl-card").focus(); // the dialog itself, so no button looks pressed at first
}

/* ===================== Data ===================== */

// Firefox adds separators and "place:" queries (smart folders) to the tree: keep
// only real bookmarks and folders.
function cleanTree(node, depth = 0) {
  if (depth > 64 || !node.children) return node;
  node.children = node.children
    .filter((c) => c.type !== "separator" && !(c.url && /^place:/i.test(c.url)))
    .map((c) => cleanTree(c, depth + 1));
  return node;
}

async function loadBookmarks() {
  const [root] = await ext.bookmarks.getTree();
  const kids = cleanTree(root).children || [];
  // Chromium: folderType (recent versions) or ids "1" and "2". Firefox: fixed root ids.
  state.bar = kids.find((n) => n.folderType === "bookmarks-bar") || kids.find((n) => n.id === "1" || n.id === "toolbar_____") || kids[0];
  state.other = kids.find((n) => n.folderType === "other") || kids.find((n) => n.id === "2" || n.id === "unfiled_____") || null;
  state.byId = new Map();
  const index = (node, depth = 0) => {
    if (depth > 64 || !node?.children) return;
    state.byId.set(node.id, node);
    for (const c of node.children) index(c, depth + 1);
  };
  index(state.bar);
  index(state.other);
}

async function loadTopSites() {
  try { state.topSites = (await ext.topSites.get()).slice(0, 20); }
  catch { state.topSites = []; }
}

/* Stored data can come from an imported file or another device: accept only known shapes. */

const stringList = (v, max = 500) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.length < 2048).slice(0, max) : []);

function sanitizeSettings(raw) {
  const s = structuredClone(DEFAULT_SETTINGS);
  if (!raw || typeof raw !== "object") return s;
  if (Number.isFinite(raw.motion)) s.motion = Math.min(2, Math.max(0, raw.motion));
  else if (raw.animateGlow === false) s.motion = 0; // 1.1 had an on/off switch
  if (typeof raw.focus === "boolean") s.focus = raw.focus;
  if (typeof raw.focusIcons === "boolean") s.focusIcons = raw.focusIcons;
  if (typeof raw.focusClock === "boolean") s.focusClock = raw.focusClock;
  if (["auto", "12", "24"].includes(raw.clockFormat)) s.clockFormat = raw.clockFormat;
  if (typeof raw.focusGray === "boolean") s.focusGray = raw.focusGray;
  if (typeof raw.letterIcons === "boolean") s.letterIcons = raw.letterIcons;
  if (typeof raw.hideTileNames === "boolean") s.hideTileNames = raw.hideTileNames;
  if (["auto", "light", "dark"].includes(raw.theme)) s.theme = raw.theme;
  if (Number.isFinite(raw.glowStrength)) s.glowStrength = Math.min(2, Math.max(0, raw.glowStrength));
  if (Number.isFinite(raw.colAlpha)) s.colAlpha = Math.min(1, Math.max(0, raw.colAlpha));
  if (["board", "masonry"].includes(raw.layout)) s.layout = raw.layout;
  const bg = raw.bg;
  // "None" was merged into Color: no chosen color is the page color that follows the hour.
  if (bg?.type === "none") s.bg = { type: "color", value: null };
  if (isLit(bg?.type)) {
    // Pre-release builds stored the rays as a separate "glowStyle" setting.
    const type = bg.type === "glow" && raw.glowStyle === "rays" ? "rays" : bg.type;
    const v = bg.value;
    if (v?.color === "custom" && HEX_COLOR.test(v.custom)) s.bg = { type, value: { color: "custom", custom: v.custom.toLowerCase() } };
    else s.bg = { type, value: GLOW_COLORS.some((c) => c.id === v?.color) ? { color: v.color } : null };
    if (BG_IDS.has(bg.tint)) s.bg.tint = bg.tint;
    else if (HEX_COLOR.test(bg.tint)) s.bg.tint = bg.tint.toLowerCase();
  }
  if (bg?.type === "leaves" || bg?.type === "snow") {
    s.bg = bg.type === "snow"
      ? { type: "snow", value: ["snow", "petals", "seeds"].includes(bg.value) ? bg.value : null }
      : { type: "leaves", value: LEAF_KINDS.includes(bg.value) ? bg.value : null };
    if (BG_IDS.has(bg.tint)) s.bg.tint = bg.tint;
    else if (HEX_COLOR.test(bg.tint)) s.bg.tint = bg.tint.toLowerCase();
  }
  if (bg?.type === "color") {
    const v = bg.value;
    s.bg = { type: "color", value: BG_IDS.has(v) ? v : HEX_COLOR.test(v) ? v.toLowerCase() : null };
  }
  if ("showTopSites" in raw) s.showTopSites = raw.showTopSites === true; // migrated below
  return s;
}

function sanitizeFolderStyle(raw) {
  if (!raw || typeof raw !== "object") return null;
  const style = {};
  if (hasIcon(raw.icon)) style.icon = raw.icon;
  if (PASTEL_IDS.has(raw.color) && raw.color !== "gray") style.color = raw.color;
  else if (typeof raw.color === "string" && HEX_COLOR.test(raw.color)) style.color = raw.color.toLowerCase();
  return Object.keys(style).length ? style : null;
}

// Keeps only what ReStart understands from an exported file.
function sanitizeImport(prefs) {
  const out = { settings: sanitizeSettings(prefs.settings) };
  delete out.settings.showTopSites;
  for (const key of ["order", "hidden", "highlighted"]) if (key in prefs) out[key] = stringList(prefs[key]);
  if ("pinAfter" in prefs) out.pinAfter = sanitizePinAfter(prefs.pinAfter);
  // A file exported by 1.1 may hold an order of the tiles: keep it as the order of the pinned sites.
  const tiles = stringList(prefs.tileOrder);
  if (tiles.length && out.highlighted) {
    const rank = (u) => { const i = tiles.indexOf(u); return i === -1 ? Infinity : i; };
    out.highlighted.sort((a, b) => rank(a) - rank(b));
  }
  for (const [k, v] of Object.entries(prefs)) {
    if (!k.startsWith(STYLE_PREFIX) || k.length > 512) continue;
    const style = sanitizeFolderStyle(v);
    if (style) out[k] = style;
  }
  return out;
}

// Pre-release builds kept settings in ext.storage.sync: move them here once.
async function migrateFromSync() {
  const { migratedFromSync } = await store.get("migratedFromSync");
  if (migratedFromSync) return;
  if (!HAS_FAVICON_API) { await store.set({ migratedFromSync: true }); return; } // Firefox: no pre-release data
  try {
    const old = await ext.storage.sync.get(null);
    const prefs = sanitizeImport(old);
    const local = await store.get(null);
    if (!Object.keys(local).some(isPrefKey) && Object.keys(old).length) await store.set(prefs);
    await ext.storage.sync.clear();
  } catch (e) {
    console.warn("ReStart: migration skipped", e);
  }
  await store.set({ migratedFromSync: true });
}

// Pre-release builds cached site icon URLs; that feature was removed.
const dropLegacyIconCache = () => store.remove("favicons").catch(() => {});

async function loadStorage() {
  const data = await store.get(null);
  const saved = data.settings || {};
  // Mutate in place: open settings controls keep a reference to this object.
  for (const k of Object.keys(state.settings)) delete state.settings[k];
  Object.assign(state.settings, sanitizeSettings(saved));
  state.order = stringList(data.order);
  state.hidden = stringList(data.hidden);
  state.highlighted = stringList(data.highlighted);
  state.pinAfter = sanitizePinAfter(data.pinAfter);
  // 1.1 kept its own order of the tiles ("tileOrder"; test builds also had "itemOrder"). Bookmarks
  // now move for real: the bar's sites follow the bookmarks bar, and the tile order is kept as the
  // order of the pinned sites. Nothing is written to the bookmarks.
  if ("tileOrder" in data || "itemOrder" in data) {
    const old = stringList(data.tileOrder);
    if (old.length) {
      const rank = (u) => { const i = old.indexOf(u); return i === -1 ? Infinity : i; };
      state.highlighted = [...state.highlighted].sort((a, b) => rank(a) - rank(b));
      saveLocal({ highlighted: state.highlighted });
    }
    store.remove(["tileOrder", "itemOrder"]).catch(() => {});
  }
  state.welcomed = data.welcomed === true;
  // Pre-release builds stored a boolean for the Most visited column: migrate it once, then drop it,
  // otherwise it would hide the column again on every load.
  if ("showTopSites" in saved) {
    if (saved.showTopSites === false && !state.hidden.includes(KEY_TOP)) state.hidden.push(KEY_TOP);
    delete state.settings.showTopSites;
    saveLocal({ settings: state.settings, hidden: state.hidden });
  }
  state.folderStyles = Object.create(null);
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith(STYLE_PREFIX)) continue;
    const style = sanitizeFolderStyle(v);
    if (style) state.folderStyles[k.slice(STYLE_PREFIX.length)] = style;
  }

  state.open = new Set(stringList(data.open, 5000));
  state.openCols = new Set(stringList(data.openCols));
  state.closedCols = new Set(stringList(data.closedCols));
}

let reloadTimer;
function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => { await loadBookmarks(); render(); }, 120);
}
for (const ev of ["onCreated", "onRemoved", "onChanged", "onMoved", "onChildrenReordered", "onImportEnded"]) {
  ext.bookmarks[ev]?.addListener(scheduleReload);
}

// Another open tab (or an import) can change settings: stay in step.
let storageTimer;
ext.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !Object.keys(changes).some(isPrefKey)) return;
  clearTimeout(storageTimer);
  storageTimer = setTimeout(async () => {
    await loadStorage();
    applyAppearance();
    render();
  }, 150);
});

darkQuery.addEventListener("change", () => { applyAppearance(); render(); refreshSettings(); });
narrowQuery.addEventListener("change", render);

/* ===================== Init ===================== */

document.documentElement.lang = ext.i18n.getUILanguage();
document.title = t("newTab");
localize(document);
$("settings-path").setAttribute("d", UI.tune);
$("focus-path").setAttribute("d", UI.focus);
$("awake-path").setAttribute("d", AWAKE_ICON);
$("search-path").setAttribute("d", UI.search);
$("enter-path").setAttribute("d", UI.enter);

(async function init() {
  await migrateFromSync();
  dropLegacyIconCache();
  await loadStorage();
  applyAppearance();
  await Promise.all([loadBookmarks(), loadSiteIcons(), state.hidden.includes(KEY_TOP) ? null : loadTopSites()]);
  render();
  scheduleClock();
  if (!state.welcomed && !state.settings.focus) showWelcome();
  requestAnimationFrame(() => document.body.classList.add("ready"));
  els.search.focus();
})();
