# Privacy

Krzys Star Rail Optimizer is local-first.

- Imported accounts, settings, tags, notes, saved plans, undo history, and scan snapshots stay in this website origin's browser storage.
- Optimization and combat calculations run locally. The project has no application backend, analytics, advertising trackers, hidden telemetry, or automatic cloud sync.
- Account files leave the browser only when the user explicitly downloads an export or submits the public-showcase form. UID is redacted from account exports by default.
- A public showcase request sends the entered public UID to `api.mihomo.me` only after explicit submission. No HoYoverse password, cookie, token, or private profile credential is requested.
- The scanner operates locally, does not upload scans, excludes UID by default, and creates debug screenshots only after opt-in. Diagnostics redact UID and never include credentials or browser data.
- Live import is optional and stays on this computer. The scanner listens only on `127.0.0.1`; the website rejects non-loopback endpoints and requires the scanner's rotating pairing code. Unreviewed or invalid scans are never sent as account data. Equipped-item changes, Warp resources, and remove-missing reconciliation each require explicit opt-in.

Use **Account data → Reset account** to erase optimizer state, live-import settings, and the session pairing code, or the scanner's **Delete debug screenshots** control to remove opt-in captures. Removing site data through the browser also erases local optimizer data. GitHub Pages may receive ordinary hosting access logs governed by GitHub's privacy policy; this application neither reads nor augments them.

Redacted account exports include supported game version, optimizer version, schema version, characters, equipment, placeholders, and resources. They omit UID, tags, and notes by default. Review any file before sharing it.
