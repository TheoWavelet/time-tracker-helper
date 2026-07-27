# Chrome Web Store Submission Material

## Single Purpose

Time Tracker Bridge connects the Time Tracker Windows desktop app to the user's Chrome session.
When the paired desktop app requests it, the extension returns the user's currently open tabs or
domain-filtered browser history so the user can associate a timer with relevant work.

## Store Description

Time Tracker Bridge is a companion extension for the Time Tracker Windows desktop application. It
securely pairs with the local app and, on request, provides current browser tabs and
domain-filtered browsing history for timer tagging. Browser data stays on the user's device and
is sent only to the paired desktop app through a loopback connection.

## Permission Justifications

### tabs

Required to read the title and URL of currently open tabs when the paired desktop app requests
the Open tabs view. The extension returns only the tab fields needed to display and select a link
for timer tagging.

### history

Required to search Chrome browsing history when the paired desktop app requests the History view.
The search is restricted to the domain filter chosen in the desktop app, and returns at most 200
matching entries with title, URL, and last-visit time.

### storage

Required to store the pairing token that the user copies from the Time Tracker desktop app. The
token is stored locally in Chrome extension storage and is used only to authenticate the local
connection to that desktop app.

## Privacy Policy

### Time Tracker Bridge Privacy Policy

Effective date: July 27, 2026

Time Tracker Bridge is a companion extension for the Time Tracker Windows desktop application.
This policy describes how the extension handles user data.

#### Data the extension accesses

When requested by a paired Time Tracker desktop app, the extension accesses the titles and URLs
of open Chrome tabs. When the desktop app requests browser history, it accesses matching history
entries, including title, URL, and last-visit time. The desktop app supplies a domain filter for
these requests; an empty filter means the user has chosen to search without a domain restriction.

The extension also stores a pairing token entered by the user. This token authenticates the
extension to the local Time Tracker desktop app.

#### How data is used and shared

The extension uses tab and history data only to respond to a request from the paired desktop app
for timer tagging. It sends that response only through `ws://127.0.0.1:51834`, a loopback
connection to the app running on the same device. The extension does not send browsing data,
pairing tokens, or personal information to a remote server.

The extension does not sell, rent, use for advertising, or share user data with third parties. It
does not use analytics, tracking pixels, or remote code. It does not inject scripts into websites
or modify web pages.

#### Retention and control

Tab and history data is requested only when the desktop app needs it and is not retained by the
extension. The pairing token remains in local extension storage until the user replaces it, clears
extension data, or uninstalls the extension. Users can reset the token from the Time Tracker app
and remove the extension at any time through Chrome.

#### Contact

Before publishing, replace this paragraph with the developer's support email or support URL. The
published privacy-policy URL must remain publicly accessible.

## Submission Checklist

- Increment `browser-extension/manifest.json` for each submission.
- Upload the ZIP produced by `npm run package:extension`.
- Add a 128 x 128 PNG extension icon and reference it from the manifest before the first upload.
- Publish the Privacy Policy above at a public URL and use that URL in the Chrome Web Store form.
- Add screenshots of the options page and the paired desktop-app browser section.
- Paste the single purpose and permission justifications above into the corresponding Web Store
  form fields.