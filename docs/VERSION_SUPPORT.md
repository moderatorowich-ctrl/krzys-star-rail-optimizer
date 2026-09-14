# Version support

| Component              | Version                                    |
| ---------------------- | ------------------------------------------ |
| Honkai: Star Rail      | 4.5                                        |
| Game-data revision     | 2026.09.13.1                               |
| Optimizer              | 1.0.0                                      |
| Scanner                | 1.0.0                                      |
| Scanner export schemas | 1–2                                        |
| Data source commit     | `d28928b1f09d7613c37ca7ca373a468367060fc0` |
| Generated              | 2026-09-13                                 |

The authoritative machine-readable record is `packages/game-data/src/version-manifest.json`. Version 4.5 was verified against HoYoLAB's official update notice.

The supported version is shown in the web header, dashboard, Settings/About, scanner header, export metadata and filenames, privacy-safe reports, diagnostics, README, and scanner release name/notes.

An import from a newer game version is validated structurally but is not silently treated as supported. The UI displays a prominent warning, identifies the supported/imported versions, explains that unknown characters, equipment, sets, or mechanics can produce inaccurate results, and preserves manual correction/export access. A structurally compatible older import remains usable with its source version recorded.

After `staleAfter`, the application shows a stale-data banner even if no newer version could be confirmed. The updater never changes `supportedGameVersion` automatically. A new official version requires manual compatibility work followed by all tests and a coordinated optimizer/scanner release.
