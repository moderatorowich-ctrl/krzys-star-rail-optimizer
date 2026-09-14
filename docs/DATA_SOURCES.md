# Data sources and update policy

## Verified release dataset

The manifest supports Honkai: Star Rail v4.5. That live version was verified using HoYoverse's official HoYoLAB article `46449452`, published as “Version 4.5 … Update Details.”

Normalized character, Light Cone, and relic-set metadata comes from the MIT-licensed `fribbels/hsr-optimizer` file `src/data/game_data.json` at commit `d28928b1f09d7613c37ca7ca373a468367060fc0`. The normalized file records the exact revision and a SHA-256 content checksum. Only factual game metadata is derived; upstream branding, artwork, UI, and guide prose are excluded.

Encounter and farming definitions are maintained in this repository with explicit supported-version and uncertainty fields. Public UID previews are requested only on user action from `https://api.mihomo.me`; that service is not a source for the bundled data release.

## Safe update sequence

The scheduled workflow checks the official HoYoLAB publisher feed and the upstream Git revision daily. A same-version source revision may be promoted only when cardinality, named-content, schema, regression, type, and production-build checks all pass. The generated JSON and manifest are committed together, so a partial dataset is never published.

If the official version changes, automation leaves the last verified data untouched and opens or updates a private repository compatibility issue. Maintainers must review schemas, formula behavior, encounter definitions, scanner OCR profiles, fixtures, and UI disclosures before changing `supportedGameVersion`.

If fetching or validation fails, the build keeps serving the last verified dataset. The stale deadline in the manifest activates the application banner rather than claiming current support.

The pipeline uses public GitHub APIs/raw content and the official public HoYoLAB feed. It does not scrape pages that prohibit automation, authenticate to HoYoverse, or store credentials.
