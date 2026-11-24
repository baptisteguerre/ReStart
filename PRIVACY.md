# ReStart privacy policy

*Last updated: November 24, 2026*

ReStart is a new tab page that displays your browser bookmarks. It has no server, no account, no analytics and no advertising, and it makes no network requests. The developer receives no data from ReStart.

## Data ReStart uses

| Data | What for | Where it stays |
|---|---|---|
| Your bookmarks | Displayed on the new tab page. Changed only when you choose an action from the right-click menu: rename or delete a bookmark or a folder, or add a most visited site to your bookmarks (optionally in a new folder). | In your browser. ReStart reads and edits them through the browser's bookmarks API. |
| Most visited sites | Displayed in the optional *Most visited* column. In Firefox, also used to show the icons of those sites next to matching bookmarks. | In your browser, read on demand, never stored by ReStart. |
| Site icons | Displayed next to each bookmark. | Read from your browser: its favicon cache in Chromium-based browsers, the icons of your most visited sites in Firefox. ReStart does not download or store them. |
| Your settings and customizations (folder icons and colors, column and tile order, hidden columns, pinned sites, appearance, focus mode) and display state (which folders are expanded) | To remember your preferences. | In the extension's local storage, on your device only. The theme choice (auto, light or dark) is also kept in the page's local storage, so the page opens in the right theme without a flash. ReStart does not sync them; use Export / Import in the settings to move them to another device. |

## Export files

"Export" in the settings saves your customizations to a JSON file on your device. ReStart does not send it anywhere.

## Network requests

ReStart makes no network requests. Everything it shows comes from your browser: bookmarks, most visited sites and site icons.

## Sharing

ReStart does not sell, share or transfer any data to anyone. The use of data complies with the Chrome Web Store User Data Policy, including the Limited Use requirements, and with Mozilla's Add-on Policies.

## Deleting your data

Uninstalling ReStart removes all the data it stored. Your bookmarks are not affected, apart from any changes you made yourself.

## Contact

Open an issue on the project's GitHub repository.
