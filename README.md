# ReStart

**A calm, simple start page built around your bookmarks, in their real order. As it always should have been.**

ReStart replaces the new tab page of Firefox (version 140 or later) and of Chromium-based browsers that let extensions do so (Brave, Chrome, Edge…, version 116 or later) with a macOS-inspired start page built from your existing bookmarks bar. No feeds, no widgets, no distractions. No account, no server, no tracking, no network requests.

![ReStart: bookmarks as columns, with a halo following the sun](store/screenshots/1-board-light.png)

<table>
  <tr>
    <td><img src="store/screenshots/2-board-dark.png" alt="Dark mode with light rays"></td>
    <td><img src="store/screenshots/3-mosaic.png" alt="Mosaic layout"></td>
  </tr>
  <tr>
    <td align="center">Dark mode, light rays</td>
    <td align="center">Mosaic layout</td>
  </tr>
  <tr>
    <td><img src="store/screenshots/4-customize-folder.png" alt="Pastel color and icon for a folder"></td>
    <td><img src="store/screenshots/5-bookmark-menu.png" alt="Right-click menu on a bookmark"></td>
  </tr>
  <tr>
    <td align="center">Folder color and icon</td>
    <td align="center">Right-click menu</td>
  </tr>
</table>

<table>
  <tr>
    <td><img src="store/extra/focus-light.png" alt="Focus mode: only the background and the time"></td>
    <td><img src="store/extra/focus-dark-icons.png" alt="Focus mode in dark mode, with gray site icons"></td>
  </tr>
  <tr>
    <td align="center">Focus mode</td>
    <td align="center">Focus mode with site icons, light rays</td>
  </tr>
  <tr>
    <td><img src="store/extra/leaves.png" alt="Leaf shadows background"></td>
    <td><img src="store/extra/focus-palm.png" alt="Focus mode on palm leaf shadows"></td>
  </tr>
  <tr>
    <td align="center">Leaf shadows</td>
    <td align="center">Focus mode, palm shadows</td>
  </tr>
</table>

<p align="center"><img src="store/extra/narrow-window.png" alt="Narrow windows, in light and dark mode" width="640"></p>
<p align="center">Narrow windows</p>

## Features

- **Your bookmarks, as you organized them.** Folders of the bookmarks bar become columns, in the exact order you set (never alphabetical). Subfolders expand in place. *Other bookmarks* get their own column when they contain bookmarks. Empty folders are hidden (they appear, disabled, in the settings' column list).
- **Sites outside folders** appear as tiles above the search bar. Past 20, they move into a wide, scrollable card, and you can pin the ones you want to keep on top. Any bookmark from a folder or subfolder can also be pinned above the search bar from the right-click menu; it stays in its folder as well. Drag the tiles (or use *Move left* / *Move right* in the right-click menu) to reorder them; this order only affects ReStart, never your bookmarks.
- **Two layouts** for wide windows: *Board* (horizontal columns, Trello-style) or *Mosaic* (cards filling the width, Google Keep-style). Narrow windows show a compact list of collapsible folders.
- **Instant filter.** Type in the search bar to filter bookmarks by title or URL; once the page has focus, typing anywhere on it works too. When a single result is left, press Enter to open it.
- **Folder icons and colors.** Give each top-level folder a pastel color and a symbol (Material Symbols).
- **Right-click actions** on any bookmark: open in a new tab, copy link, pin above the search bar, rename, delete. On a *Most visited* site: add it to your bookmarks, in the bookmarks bar, one of its folders or a new folder. On a folder's header or a subfolder: rename or delete the folder.
- **Focus mode.** The *Focus* button next to the settings hides everything but the background: for a calm tab, or a screen shared during a demo. It stays on in every new tab until you turn it off. Options: the time and date in large, faint type (automatic, 12-hour or 24-hour format), and the sites above the search bar kept as icons, without names or tooltips, in soft gray by default (they regain their color on hover).
- **Reorder or hide columns** by dragging their header or from the settings. This only affects ReStart, never your bookmarks.
- **Most visited** column, optional. Right-click a site there to add it to your bookmarks, which helps build the page from your browsing habits, even when starting with no bookmarks.
- **Appearance.** Light and dark mode follow the system, or can be fixed to light or dark. Background: none, a plain color, a halo, rays (diffuse shafts of light, like sunlight under water) or leaf shadows (branches or palm fronds swaying slowly on a softly tinted wall). The halo and the rays follow the sun: they move from the left in the morning to the right in the evening and change color with the time of day; plain colors never change. Halo, rays and leaf shadows have an adjustable intensity, an optional color underneath and a gentle animation (optional, and off when the system asks for reduced motion). Colors: 10 presets for the halo and the rays, pastels for backgrounds, or any color with ReStart's own color picker (hex code, hue, shade), the same in every browser. Column opacity is adjustable.
- **Site icons** from the browser, with a colored letter when there is none. Chromium-based browsers provide icons from their favicon cache. Firefox gives extensions no access to that cache, so ReStart uses the icons Firefox returns with your most visited sites (up to 100), matched by site; other bookmarks show a colored letter. Nothing is ever downloaded.
- **Export and import** of your customizations (icons, colors, column and tile order, hidden columns, pinned sites, appearance, focus mode) as a JSON file, to back them up or move them to another device. Customizations are stored on the device only.
- **7 languages:** English, French, Spanish, Portuguese (Brazil and Portugal), Dutch, Italian, German.

## Install

### From the stores

- Chrome Web Store (Brave, Chrome, Edge…): *coming soon.*
- Firefox Add-ons: *coming soon.*

### From source

Brave, Chrome, Edge…:

1. Download or clone this repository.
2. Open `brave://extensions` (or `chrome://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the `src` folder.
4. Open a new tab. If the browser asks whether to keep the new tab page change, confirm.

Firefox:

1. Run `sh build.sh` (it creates `dist/firefox/`).
2. Open `about:debugging#/runtime/this-firefox` and click **Load Temporary Add-on…**.
3. Select `dist/firefox/manifest.json`. A temporary add-on stays installed until Firefox restarts.

## Permissions

| Permission | Why |
|---|---|
| `bookmarks` | Read your bookmarks to display them; rename, delete or add a bookmark, or rename, create or delete a folder, when you ask from the right-click menu. |
| `favicon` | Chromium-based browsers only: show site icons from the browser's favicon cache. |
| `storage` | Save settings and folder customizations, on the device only. |
| `topSites` | Show the optional *Most visited* column. In Firefox, also provides the icons of the most visited sites. |

See [PRIVACY.md](PRIVACY.md) for details, and [SECURITY.md](SECURITY.md) for how untrusted data is handled. What changed in each version is in [CHANGELOG.md](CHANGELOG.md).

## Project structure

```
src/                  The extension, shared by all browsers (load this folder in Chromium)
  manifest.json       Chromium manifest; its "version" is the version of both builds
  newtab.html         New tab page
  theme-boot.js       Applies the theme before the first paint
  app.js              Page logic
  styles.css
  icons.js            Embedded Material Symbols (subset)
  _locales/           Translations
store/                Chrome Web Store listing texts, permission justifications,
                      screenshots (1280x800), extra screenshots (narrow window, focus mode, leaf shadows),
                      promo tiles and store icon; firefox.md for addons.mozilla.org
platforms/firefox/    Firefox manifest
CHANGELOG.md          What changed in each version
build.sh              Builds dist/restart-chrome-<version>.zip and dist/restart-firefox-<version>.zip
.github/workflows/    Release workflow: builds the zips and attaches them to each GitHub release
```

Plain HTML, CSS and JavaScript (ES modules), no compilation. `build.sh` only copies `src/` and picks the manifest for each browser. To release a new version:

1. Change `version` in `src/manifest.json` and add the version's notes to [CHANGELOG.md](CHANGELOG.md).
2. Publish a GitHub release with the tag `v<version>` (for example `v1.0.1`). The *Release packages* workflow (`.github/workflows/release.yml`) checks that the tag matches the version, runs `build.sh` and attaches both zips to the release. You can also run `sh build.sh` locally.
3. Upload each zip to its store.

## Contributing

Issues and pull requests are welcome. Translations live in `src/_locales/<lang>/messages.json`; to add a language, copy `en/messages.json` and translate the `message` values.

## License

[MIT](LICENSE). Icons: [Material Symbols](https://fonts.google.com/icons) by Google, under the Apache License 2.0 (see `src/LICENSE-material-symbols.txt`).
