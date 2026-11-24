# Security

ReStart treats everything it displays as untrusted: bookmark titles and URLs (they can come from imported bookmark files or synced devices), titles of most visited sites, text typed in the search bar, and settings files imported by the user.

## How untrusted data is handled

| Input | Risk | Defense |
|---|---|---|
| Bookmark and folder titles, most visited titles | HTML/script injection | Inserted only as text nodes or attributes through DOM APIs. No `innerHTML`, no string-built HTML, no `eval`. Control characters and bidi-override characters (used to disguise text) are stripped; displayed text is capped at 300 characters. |
| Bookmark URLs | Script execution via `javascript:`, `data:`, `vbscript:`, `blob:` | Such bookmarks are displayed but have no `href` and can't be opened from ReStart (click, Enter, or "Open in new tab"). |
| Folder titles used as storage keys | Prototype pollution (`__proto__`, `constructor`…) | Lookups use objects created with `Object.create(null)` and `Object.hasOwn`. |
| Site icons | Tracking, script in icons | Icons come only from the browser: its favicon cache in Chromium (`_favicon` API), or the `data:image/…` URLs that Firefox returns for the most visited sites (any other value is ignored). They are rendered with `<img>`, where scripts never run. ReStart loads nothing from the network. |
| Search text | Injection, regex abuse, huge input | Compared with plain string matching (no regular expression built from input), limited to 200 characters, highlighted with text nodes. |
| Imported settings file | Injection, prototype pollution, quota abuse, data loss | Limited to 1 MB; every value is validated against an allow-list (known keys, known colors and icons, custom colors only as `#rrggbb`, numbers clamped, lists of short strings); unknown keys are dropped. If writing fails, the previous settings are restored. |
| Remembered theme (page local storage) | Tampered value | Only compared with `"dark"` and `"light"`; any other value falls back to the system theme. |
| Rename (bookmark or folder) | Injection | Saved through the bookmarks API and displayed as text; limited to 1,000 characters. |
| New folder name, title of a most visited site added to bookmarks | Injection, disguised text | Cleaned like titles (control and bidi characters stripped, length capped), saved through the bookmarks API and displayed as text. Script URLs can't be added. |

## Platform protections

- Manifest V3 default Content Security Policy: only the extension's own scripts can run; inline scripts and remote code are blocked.
- No `web_accessible_resources`: web pages can't load ReStart's files.
- No network requests at all.

## Reporting a vulnerability

Please open a GitHub issue without exploit details and ask for a private contact, or use GitHub's private vulnerability reporting if enabled on the repository.
