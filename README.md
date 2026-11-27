# ReStart

**A calm, simple start page built around your bookmarks, in their real order. As it always should have been.**

ReStart replaces the new tab page of Firefox (version 140 or later) and of Chromium-based browsers that let extensions do so (Brave, Chrome, Edge…, version 116 or later) with a macOS-inspired start page built from your existing bookmarks bar. No feeds, no widgets, no distractions. No account, no server, no tracking, no network requests.

![ReStart: bookmarks as cards in the Mosaic layout, under a glow in the colors of the hour](store/screenshots/1-mosaic-light.png)

<table>
  <tr>
    <td><img src="store/screenshots/2-board-dark.png" alt="Board layout in dark mode, with night light rays"></td>
    <td><img src="store/screenshots/3-bamboo-menu.png" alt="Right-click menu on a bookmark, over bamboo shadows"></td>
  </tr>
  <tr>
    <td align="center">Board layout, dark mode, rays</td>
    <td align="center">Right-click menu, bamboo shadows</td>
  </tr>
  <tr>
    <td><img src="store/screenshots/4-customize-folder.png" alt="Pastel color and icon for a folder"></td>
    <td><img src="store/screenshots/5-focus-petals.png" alt="Focus mode with gray site icons and drifting cherry petals"></td>
  </tr>
  <tr>
    <td align="center">Folder color and icon</td>
    <td align="center">Focus mode, breeze of petals</td>
  </tr>
</table>

<table>
  <tr>
    <td><img src="store/extra/focus-light.png" alt="Focus mode: only the background and the time"></td>
    <td><img src="store/extra/focus-dark-icons.png" alt="Focus mode in dark mode, with gray site icons and light rays"></td>
  </tr>
  <tr>
    <td align="center">Focus mode, morning glow</td>
    <td align="center">Focus mode with site icons, night rays</td>
  </tr>
  <tr>
    <td><img src="store/extra/leaves-branches.png" alt="Branch shadows"></td>
    <td><img src="store/extra/focus-palm.png" alt="Focus mode on palm leaf shadows"></td>
  </tr>
  <tr>
    <td align="center">Branch shadows</td>
    <td align="center">Focus mode, palm shadows</td>
  </tr>
  <tr>
    <td><img src="store/extra/move-to.png" alt="Move a bookmark to another folder"></td>
    <td><img src="store/extra/breeze-snow-dark.png" alt="Snow drifting over the Board layout in dark mode"></td>
  </tr>
  <tr>
    <td align="center">Move to another folder</td>
    <td align="center">Breeze of snow</td>
  </tr>
</table>

<p align="center"><img src="store/extra/narrow-window.png" alt="Narrow windows, in light and dark mode" width="640"></p>
<p align="center">Narrow windows</p>

## Features

- **Your bookmarks, as you organized them.** Folders of the bookmarks bar become columns, in the exact order you set. Subfolders expand in place. Drag a bookmark or a subfolder to reorder it, or to move it to another folder. Sites outside folders appear as tiles above the search bar.
- **Two layouts** for wide windows: *Mosaic* (cards filling the width, Google Keep-style, the default) or *Board* (horizontal columns, Trello-style). Narrow windows show a compact list of collapsible folders.
- **Reorder or hide columns** by dragging their header or from the settings. Moving a folder's column moves the folder in your bookmarks bar.
- **Most visited** column, optional. Right-click a site there to add it to your bookmarks, which helps build the page from your browsing habits.
- **Instant filter.** Type in the search bar to filter bookmarks by title or URL. When a single bookmark is left in the results, press Enter to open it.
- **Folder icons and colors.** Give each top-level folder a pastel color, or any color with the color picker, and a symbol (Material Symbols).
- **Focus mode.** The *Focus* button next to the settings hides everything but the background: for a calm tab, or a screen shared during a demo. It stays on in every new tab until you turn it off.
- **Keep the screen on.** The *Keep Awake* button next to *Focus* stops the screen from turning off and the computer from going to sleep, for 15 minutes to 4 hours or until you turn it off.
- **Appearance.** Light and dark mode follow the system, or can be fixed to light or dark. Background: a color, light effects, leaf shadows or breeze. The glow and the rays follow the sun: they move from the left in the morning to the right in the evening. With the default color, *Sky*, they follow the height of the sun, in colors loosely inspired by traditional Japanese ones. Sky also follows the seasons (northern hemisphere, without asking for your location): sunrise and sunset move with the date, and winter days turn to a pale, clear aqua instead of summer's sky blue.
- **Site icons** from the browser, with a colored letter when there is none. Chromium-based browsers provide icons from their favicon cache. Firefox gives extensions no access to that cache, so ReStart uses the icons Firefox returns with your most visited sites (up to 100), matched by site; other bookmarks show a colored letter. Nothing is ever downloaded.
- **Export and import** of your customizations (folder icons and colors, hidden columns, pinned sites and their place among the tiles, the place of the extra columns, appearance, focus mode) as a JSON file, to back them up or move them to another device. The file holds how ReStart shows your bookmarks, not the bookmarks themselves: your browser saves those, with its sync or its bookmark export.
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
| `bookmarks` | Read your bookmarks to display them; edit (name and address), move, delete or add a bookmark, or rename, move, create or delete a folder, when you ask (right-click menu, or dragging to reorder). |
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
  img/                Icons and the leaf-shadow drawings (SVG)
  _locales/           Translations
store/                Chrome Web Store listing texts, permission justifications,
                      screenshots (1280x800), extra screenshots (narrow window, focus mode, leaf shadows, breeze, move to),
                      promo tiles and store icon; firefox.md for addons.mozilla.org
platforms/firefox/    Firefox manifest
tools/                Scripts that draw the leaf shadows: original drawings, generated (python3 tools/bamboo.py)
CHANGELOG.md          What changed in each version
build.sh              Builds dist/restart-chrome-<version>.zip and dist/restart-firefox-<version>.zip
.github/workflows/    Release workflow: builds the zips and attaches them to each GitHub release
```

Plain HTML, CSS and JavaScript (ES modules), no compilation. `build.sh` only copies `src/` and picks the manifest for each browser. To release a new version:

1. Change `version` in `src/manifest.json` and add the version's notes to [CHANGELOG.md](CHANGELOG.md).
2. Publish a GitHub release with the version as its tag (for example `1.3.0`; `v1.3.0` works too). The *Release packages* workflow (`.github/workflows/release.yml`) checks that the tag matches the version, runs `build.sh` and attaches both zips to the release. You can also run `sh build.sh` locally.
3. Upload each zip to its store.

## Contributing

Issues and pull requests are welcome. Translations live in `src/_locales/<lang>/messages.json`; to add a language, copy `en/messages.json` and translate the `message` values.

## License

[MIT](LICENSE). Icons: [Material Symbols](https://fonts.google.com/icons) by Google, under the Apache License 2.0 (see `src/LICENSE-material-symbols.txt`).
