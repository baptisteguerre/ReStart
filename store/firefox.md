# Firefox Add-ons (addons.mozilla.org)

Package: `dist/restart-firefox-<version>.zip`, built with `./build.sh`.

## Upload

- **Distribution:** on this site (listed).
- **Platforms:** Firefox for desktop only. Firefox for Android doesn't let extensions replace the new tab page.
- **Source code:** not needed. The package contains the source files as they are, with no minification, bundling or transpiling.

## Listing

- **Name and summary:** read from the package (`extName`, `appDesc` in `_locales`).
- **Description:** the same texts as the Chrome Web Store, in `listing.md`, one per language.
- **Category:** Bookmarks.
- **License:** MIT License.
- **Support site:** the GitHub repository; **support email:** optional.
- **Privacy policy:** `PRIVACY.md` on the GitHub repository (optional on AMO when no data is collected).
- **Screenshots:** the five images in `screenshots/` (1280x800). Note that in Firefox, only frequently visited sites show their real icon; the others show a colored letter.

## Data collection

The manifest declares `"data_collection_permissions": { "required": ["none"] }`: ReStart collects and transmits no data. Firefox shows this at install time and on the listing page.

## Notes to reviewer

> ReStart replaces the new tab page with the user's bookmarks, organized by the folders of the bookmarks toolbar. It makes no network requests and loads no remote code; all files are plain, unminified source.
> Permissions: bookmarks (display them, and rename, delete or add a bookmark or folder only when the user asks from the right-click menu), storage (preferences, local only), topSites (optional "Most visited" column, and the data: icons Firefox returns for those sites, used next to matching bookmarks since extensions can't read the favicon cache).
> Source and documentation: <GitHub repository URL>
