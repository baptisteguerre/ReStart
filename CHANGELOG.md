# Changelog

All notable changes to ReStart. Versions follow [semantic versioning](https://semver.org).

## 1.4.0

### Added

- **A welcome screen** replaces the small welcome card. Three slides on a card over the dimmed page, with *Skip* always at hand.

### Removed

- The welcome card's tip on right-clicking a site or a folder for quick actions.

## 1.3.2

No change from 1.3.1. Firefox Add-ons never accepts the same version number twice, and an earlier build of 1.3.1 had already been sent there, so the final 1.3.1 is published again as 1.3.2.

## 1.3.1

### Added

- **Pastels, a color that drifts.** Next to *Sky*, the glow and the rays can take *Pastels*: the light goes slowly through peach, pink, lilac, blue, aqua, mint and gold, about 90 seconds per color at the normal *Motion* speed (a full round in about 10 minutes). Every tab shows the same color at the same time.
- **Collapse a folder** in Mosaic and Board: a small chevron in each folder's header, in place of the number of sites (still shown in its tooltip), folds the folder down to its header.
- **Hide tile names**: the sites above the search bar show icons only, a little bigger to make up for it. Names stay in each tile's tooltip, and come back while you filter. Focus mode is not affected.
- **Keep Awake in the welcome card.** The welcome card has a fourth line for *Keep Awake* (only where the browser supports it); the *Focus* line is back to its own sentence.

### Changed

- **Sky in Japanese-inspired colors.** Sky's palette is redrawn, loosely inspired by traditional Japanese colors, with no greys and no ochres: wisteria at night, lilac before dawn, carnation pink at dawn and dusk, a pale rosy peach for the low sun (no more gold turning caramel), white wisteria as the light rises, sky blue at midday. The seasons change the hue rather than draining the color: winter days turn to a pale, clear aqua instead of a warm grey. In dark mode, Sky keeps a little more color.
- **Halo is now called Glow**.
- **A calmer glow by default.** The middle of the *Intensity* slider (shown as 50 %) now gives the glow what 40 % gave in 1.3.0. The top of the slider is unchanged, and so are the rays.
- **The accent never turns brown.** Orange, gold and olive hues become a sunset rose, so the accent stays fresh with every background.

### Fixed

- **Column opacity really makes columns see-through.** At low opacity, the columns kept their frosted blur, so the background stayed hidden behind them even at 0 %. The blur now follows the opacity: at 0 %, the background shows through, sharp.
- **The tab icon is no longer cropped.** The small icons (16, 32 and 48 px) filled their whole square, so the browser tab cut their rounded corners and they looked too big. They now keep the same margin as the large icon.
- **The settings panel is a little wider** (440 px instead of 360 px), so the labels fit in every language.

## 1.3.0

### Added

- **Keep the screen on.** A *Keep Awake* button next to *Focus* keeps the screen on and the computer awake for 15 minutes, 30 minutes, 1, 2 or 4 hours, or until you turn it off, like the *Caffeine* apps. The time left shows next to its label, and every ReStart tab shares the same state. It uses the browser's Screen Wake Lock: no permission is needed, but it only works while a ReStart page is shown. It pauses when you switch to another tab or hide the window, and starts again when you come back; the menu explains this. The welcome card mentions it.
- **Letters instead of site icons**: every site gets a pastel square with the first letter of its name, for a calm, even look. Each site keeps the same color everywhere. No icon is requested while it is on.
- **Edit a bookmark's address.** *Rename* in a bookmark's right-click menu becomes *Edit*: the name and the address, saved in the browser's bookmarks. An address typed without a scheme gets `https://`; scripts, inline documents and invalid addresses are refused. A pinned bookmark stays pinned, at the same place. Bookmarklets keep their address: only their name can be edited. The welcome card says *edit* instead of *rename*.

### Changed

- **Tiles above the search bar can go anywhere.** Pinned sites and sites of the bookmarks bar are no longer two separate groups: drag any tile before or after any other (or use *Move left* / *Move right*). Sites of the bookmarks bar still move in the bar itself.
- **An accent color drawn from the background.** The accent (focus rings, selections, buttons) takes the hue of the background instead of a fixed blue: the halo or Sky color of the moment, the chosen color or tint, or else the sky of the hour. Its lightness is adjusted to stay legible (at least 4.5:1 against cards and menus, and behind white text on buttons).
- **Clearer on and off.** *Focus* and *Keep Awake* take the accent color when they are on, in light and dark mode; off, they stay neutral.

### Fixed

- **Mosaic stays centered.** With fewer folders than the width allows, the cards kept their width but started on the left, leaving an empty space on the right. They are now centered under the search bar.
- **More room in small forms.** Editing a bookmark and renaming a folder open with the padding of a panel instead of the tight edges of a menu.

## 1.2.1

### Added

- **Sky follows the sun and the seasons** (northern hemisphere, no location needed). Its colors now follow the height of the sun, in one continuous arc, the same in mirror morning and evening: slate blue at night, rose then gold as the sun rises, a whitening light, then a clear sky at midday.
- **Bamboo leaf shadows:** tall culms with nodes and sprays of long, narrow leaves, next to branches and palm fronds.
- **Motion speed.** A *Motion* slider sets the pace of the halo's breathing, the rays, the leaves and the breeze, from still to twice the normal pace. It replaces the on/off animation switch; an animation turned off before stays still.

### Changed

- **Light** groups the halo and the rays: the background is now a color, light, leaf shadows or breeze, and *Halo* and *Rays* are the kinds of light, as branches, palm fronds and bamboo are for the leaves.
- **A more natural wind.** Leaf shadows no longer swing back and forth on a fixed rhythm: they follow a wind that changes direction now and then, comes in gusts, and has calmer and livelier moments.
- In Focus mode, the time, the date and the site icons stand out a little more, in light and dark mode.
- Dark mode is a soft charcoal rather than near black (cards included), and the halo and rays glow a little brighter on it.
- The halo's second tone is only a hint at its edge, instead of a grey-blue band.
- Olive and monstera shadows are replaced by bamboo (olive was too close to the branches); a page set to one of them shows branches.
- Airier branch shadows, with fewer leaves on the right, and leaves that sway more slowly by default.
- **Lighter settings panel.** Explanations no longer sit under every section: a small (i) next to a title shows them in a bubble on hover, keyboard focus or tap.
- Site tiles have a frosted, slightly translucent background, so the background shows through.

## 1.2.0

First version submitted to the Chrome Web Store and to addons.mozilla.org.

### Added

- **Move bookmarks and folders, for real.** Drag a bookmark or a subfolder between two others, onto a column, into a subfolder (middle of its row) or onto the row of tiles; or use *Move to…* in the right-click menu, with a list of every folder. A folder can't be moved into itself; bookmarks managed by a policy never move. A rounded bar shows where the item will land.
- **Breeze background.** Light things drifting in a slow, gusting wind: snow, cherry petals, dandelion seeds or autumn leaves. *Season*, the default (marked with a small sun), picks them by the date: petals in spring, seeds in summer, leaves in autumn, snow in winter. They fade where they land on a card, a tile or the search bar (in Focus mode, on the clock and the icons). The intensity sets how many there are; they stand still when animations are off or the system asks for reduced motion, and the animation pauses when the tab is hidden.
- **Two more leaf shadows:** olive twigs and monstera leaves, next to branches and palm fronds. Like them, original drawings, generated by the scripts in `tools/`.
- **Sky, a halo color that follows the day**, now the default: dawn pink, pale gold, almost white at midday, apricot, rose then lavender at sunset, a soft blue at night, fainter. Its swatch is marked with a small sun.
- **A page color that follows the hour.** When no background color is chosen (the swatch with a small sun), the page takes a whisper of the hour's hue, at the same lightness: under a plain *Color* background, the halo, the rays, the leaf shadows and the breeze.
- **A short welcome card** on the first new tab, with three lines on what ReStart does. *Get started*, the close button or Esc dismisses it for good; *Show the introduction again* in the settings brings it back.
- **A friendlier start with few bookmarks.** When *Most visited* would be the only column, it becomes a wide card of up to 20 sites in two balanced rows, sized to its tiles and always open in narrow windows. With fewer than 3 bookmarks, a short hint explains how to fill the page.
- **Import report.** After an import, the settings say what was restored, which folders of the file were not found in your bookmarks (folders are matched by name), and which current folders the file does not know.
- **A very light neutral gray** (`#f5f5f5` in light mode) among the background colors.

### Changed

- **Reordering moves your real bookmarks.** Moving a folder's column moves the folder in the bookmarks bar, and dragging a tile of the bar moves that site in the bar, so ReStart, the browser and every synced device show the same order. ReStart only remembers where the columns that are not folders of the bar sit (*Most visited*, *Other bookmarks*, the card of bar sites), and the order of pinned sites. Orders saved by an earlier version are never written to your bookmarks: folder columns and bar sites now follow the bookmarks bar, and a tile order from 1.1 is kept as the order of the pinned sites. The *Original order* button is gone.
- **Calmer, more visible halo and rays.** Fixed colors no longer get deeper in the evening: they are paler at midday and softer at night. The halo has two tones and a smooth falloff with no visible edge, and a faint fixed grain removes banding. Rays take a single powdery tone, have softer edges, and sway slowly from side to side, each set on its own rhythm. Both read better on a light page.
- **Leaf shadows** sit on a wall that takes the light of the hour when no color is chosen.
- **Balanced rows of tiles** above the search bar and in Focus mode: up to 6 on one row, then rows of at most 8 (for example 4 + 3, 6 + 6, 7 + 7 + 6) instead of one very long line.
- **Long folders** keep a fixed height in every layout and scroll inside, with a soft fade at the bottom when more sites follow.
- *Mosaic* is now the default layout for wide windows, and comes first in the settings. A layout you already chose is kept.
- Background colors fit two rows of six with the color picker: pink and lime are no longer offered (a page already set to one of them keeps it).
- Export saves the column order as shown, so a backup knows every folder present at that time. The settings explain that the file holds ReStart's own settings, while the bookmarks and their order are saved by the browser.

### Fixed

- No scrollbar in Focus mode.

## 1.1.0

### Added

- **Focus mode.** A *Focus* button next to the settings hides your bookmarks and keeps only the background, for a calm tab or a screen shared during a demo. It stays on in every new tab until you turn it off. Options:
  - the time and date in large, faint type, in the language's format: automatic, 12-hour or 24-hour (on by default, can be hidden);
  - the sites above the search bar kept as icons, without names or tooltips, in soft gray by default.
- **Leaf shadows background.** Soft shadows of branches or palm fronds on a lightly tinted wall, swaying slowly in the wind. The drawings are original to ReStart.
- **Reorder the sites above the search bar** by dragging them, or with *Move left* / *Move right* in the right-click menu (the order was kept by ReStart only; since 1.2, bar sites move in the bar itself).
- **ReStart's own color picker**, the same in every browser: hex code first (`eadef7`, `#EADEF7` or `eaf`), then shade and hue. Used for all custom colors.

### Changed

- Plain background colors are shown exactly as chosen, at any time of day. The background swatches in the settings show the exact color you'll get.

### Removed

- The optional warmer evening tint for plain backgrounds (it also tinted the page when no background color was chosen).

### Fixed

- The settings panel no longer shifts by a few pixels when a setting changes.

## 1.0.1

First release, for Brave, Chrome, Edge and other Chromium-based browsers, and for Firefox.

- Your bookmarks bar as a start page: folders become columns, in your exact order; subfolders expand in place; empty folders are hidden.
- Sites outside folders as tiles above the search bar; past 20, they move into a scrollable card. Any bookmark can be pinned above the search bar.
- Two layouts for wide windows, *Board* and *Mosaic*, and a compact list for narrow windows.
- Instant filter by title or URL; Enter opens the last result left.
- Pastel color and icon for each folder.
- Right-click actions: open in a new tab, copy link, pin, rename and delete bookmarks; rename and delete folders; add a *Most visited* site to your bookmarks, in an existing folder or a new one.
- Reorder or hide columns, without touching your bookmarks.
- Optional *Most visited* column.
- Appearance: light, dark or automatic theme; background none, plain color, halo or light rays following the sun, with intensity, optional color underneath and a gentle animation; adjustable column opacity.
- Site icons from the browser, with a colored letter when there is none.
- Export and import of your customizations.
- 7 languages: English, French, Spanish, Portuguese (Brazil and Portugal), Dutch, Italian, German.
- Private by design: no account, no server, no tracking, no network requests.
