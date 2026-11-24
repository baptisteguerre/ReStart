# Chrome Web Store: privacy tab

## Single purpose

ReStart replaces the browser's new tab page with a start page that displays the user's own bookmarks, organized by the folders of their bookmarks bar.

## Permission justifications

**bookmarks**
ReStart's single purpose is to display the user's bookmarks on the new tab page. It reads the bookmark tree to build the page, and changes bookmarks only when the user explicitly asks from the right-click menu: "Rename" or "Delete" on a bookmark or a folder, or "Add to bookmarks" on a Most visited site (which creates the bookmark, and a new folder if the user names one).

**favicon**
Used to display each bookmarked site's icon from the browser's favicon cache, next to the bookmark title.

**storage**
Stores, in local extension storage on the user's device only, the user's preferences: folder icons and colors, column order, hidden columns, pinned sites, layout and appearance. The theme choice (auto, light or dark) is also kept in the page's local storage so the page opens in the right theme.

**topSites**
Used to display the optional "Most visited" column on the new tab page. The user can hide it in the settings.

**Remote code**
No. ReStart does not load or execute remote code. All scripts are packaged in the extension.

## Data usage (form answers)

- Personally identifiable information: no
- Health information: no
- Financial and payment information: no
- Authentication information: no
- Personal communications: no
- Location: no
- Web history: no. ReStart reads the most visited sites (topSites) only to display them on the device; nothing is collected, stored or transmitted. If the form is read as covering local display, tick "Web history" and keep the same explanation.
- User activity: no
- Website content: no

Certifications to tick:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

Privacy policy URL: link to `PRIVACY.md` on the public GitHub repository.

## Category

Workflow & Planning (or Tools).
