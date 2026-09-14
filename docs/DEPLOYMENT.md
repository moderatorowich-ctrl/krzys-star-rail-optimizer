# Deployment and release

## Static website

The production base is `/<repository-name>/`; local development uses `/`. Navigation is hash-based, asset references use Vite's base, and service-worker registration uses `import.meta.env.BASE_URL`, so refreshes and assets work on project Pages without server rewrites.

Run locally:

```powershell
npm ci
npm run build
npm run test:pages
```

`.github/workflows/ci-pages.yml` runs on `main`. It installs locked dependencies, verifies data, types, lint, formatting, unit/regression/OCR tests, builds the site, checks the project base, checks links, runs Chromium desktop/mobile/accessibility integration tests, and audits production dependencies. Only the resulting `dist` artifact reaches the Pages deployment job.

Repository Settings → Pages must use **GitHub Actions**. Private-repository Pages requires a GitHub plan that supports private Pages. Do not change visibility if the plan rejects the deployment; preserve the private repository and report the plan restriction.

## Scanner release

Tag a verified commit with `scanner-v1.0.0` and push the tag. `.github/workflows/release-scanner.yml` runs on `windows-latest`, installs Python dependencies, reruns OCR/model tests, creates a one-file Windows executable, bundles the GPL license and scanner guide, and attaches `Krzys-HSR-Scanner-v1.0.0-for-HSR-v4.5.zip` to a release named `Krzys HSR Scanner v1.0.0 for HSR v4.5`.

The binary is reproducible from the tagged source but is not Authenticode-signed. Release notes disclose this and the scanner's supported game/export versions and safety model.

## Recovery

Pages deploys are immutable Actions artifacts. Re-run a successful commit or revert with a normal commit; never edit the deployed artifact. If a data update fails, the workflow leaves the previous manifest/data pair untouched. A version change opens a compatibility issue and does not auto-promote.
