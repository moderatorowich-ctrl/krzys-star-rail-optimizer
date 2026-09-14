import { readFile, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import process from 'node:process';

const manifestPath = new URL('../packages/game-data/src/version-manifest.json', import.meta.url);
const generatedPath = new URL(
  '../packages/game-data/src/game-data.generated.json',
  import.meta.url,
);
const relicRollsPath = new URL(
  '../packages/game-data/src/relic-rolls.generated.json',
  import.meta.url,
);
const packagePath = new URL('../package.json', import.meta.url);
const scannerInitPath = new URL('../apps/scanner/krzys_hsr_scanner/__init__.py', import.meta.url);
const scannerProjectPath = new URL('../apps/scanner/pyproject.toml', import.meta.url);
const serviceWorkerPath = new URL('../apps/web/public/sw.js', import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const mode = process.argv[2] ?? '--verify';
const repository = 'fribbels/hsr-optimizer';
const upstreamPath = 'src/data/game_data.json';
const upstreamRelicPath = 'src/data/relic_sub_affixes.json';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeStats(stats = {}) {
  return {
    hp: Number(stats.HP ?? 0),
    atk: Number(stats.ATK ?? 0),
    def: Number(stats.DEF ?? 0),
    spd: Number(stats.SPD ?? 0),
    critRate: Number(stats['CRIT Rate'] ?? 0.05),
    critDmg: Number(stats['CRIT DMG'] ?? 0.5),
  };
}

function validateUpstream(data) {
  const characters = Object.values(data.characters ?? {});
  const lightCones = Object.values(data.lightCones ?? {});
  const relicSets = Array.isArray(data.relics) ? data.relics : [];
  assert(
    characters.length >= 75,
    `Expected at least 75 characters, received ${characters.length}.`,
  );
  assert(
    lightCones.length >= 150,
    `Expected at least 150 Light Cones, received ${lightCones.length}.`,
  );
  assert(relicSets.length >= 55, `Expected at least 55 relic sets, received ${relicSets.length}.`);
  assert(
    characters.some((item) => item.name === 'Robin • Summeretto' && !item.unreleased),
    'HSR v4.5 Robin • Summeretto is missing or unreleased.',
  );
  assert(
    characters.some((item) => item.name === 'Aventurine • Waveflair' && !item.unreleased),
    'HSR v4.5 Aventurine • Waveflair is missing or unreleased.',
  );
  assert(
    lightCones.some((item) => item.name === 'Rise and Sing' && !item.unreleased),
    'HSR v4.5 Light Cone Rise and Sing is missing.',
  );
  assert(
    relicSets.some((item) => item.name === 'Fallen Star Anchorage'),
    'HSR v4.4 relic set is missing.',
  );
  return { characters, lightCones, relicSets };
}

function normalize(data, revision) {
  const validated = validateUpstream(data);
  const characters = validated.characters
    .filter((item) => !item.unreleased)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      rarity: Number(item.rarity),
      path: String(item.path),
      element: String(item.element),
      maxSp: Number(item.max_sp ?? 100),
      baseStats: normalizeStats(item.stats),
      unreleased: false,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const lightCones = validated.lightCones
    .filter((item) => !item.unreleased)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      rarity: Number(item.rarity),
      path: String(item.path),
      baseStats: normalizeStats(item.stats),
      unreleased: false,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const relicSets = validated.relicSets
    .map((item) => ({ id: String(item.id), name: String(item.name), skills: String(item.skills) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    sourceRevision: revision,
    generatedAt: manifest.generatedAt,
    checksum: createHash('sha256')
      .update(JSON.stringify({ characters, lightCones, relicSets }))
      .digest('hex'),
    characters,
    lightCones,
    relicSets,
  };
}

const relicProperties = {
  HPDelta: 'hp',
  AttackDelta: 'atk',
  DefenceDelta: 'def',
  HPAddedRatio: 'hpPct',
  AttackAddedRatio: 'atkPct',
  DefenceAddedRatio: 'defPct',
  SpeedDelta: 'spd',
  CriticalChanceBase: 'critRate',
  CriticalDamageBase: 'critDmg',
  StatusProbabilityBase: 'effectHitRate',
  StatusResistanceBase: 'effectRes',
  BreakDamageAddedRatioBase: 'breakEffect',
};

function normalizeRelicRolls(data, revision) {
  const tiers = Object.fromEntries(
    Object.entries(data).map(([rarity, tier]) => {
      assert(['2', '3', '4', '5'].includes(rarity), `Unexpected relic rarity ${rarity}.`);
      const values = Object.values(tier.affixes ?? {}).map((affix) => {
        const key = relicProperties[affix.property];
        assert(key, `Unexpected relic property ${affix.property}.`);
        assert(
          Number.isFinite(affix.base) && Number.isFinite(affix.step) && affix.step_num === 2,
          `Unexpected relic roll schema for ${affix.property}.`,
        );
        return [key, [affix.base, affix.base + affix.step, affix.base + affix.step * 2]];
      });
      assert(
        new Set(values.map(([key]) => key)).size === values.length,
        `Duplicate relic stat in rarity ${rarity}.`,
      );
      return [rarity, Object.fromEntries(values)];
    }),
  );
  return { sourceRevision: revision, tiers };
}

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

function validateGenerated(generated, relicRolls) {
  assert(
    generated.sourceRevision === manifest.dataSourceRevision,
    'Generated data revision does not match the version manifest. Run npm run data:update.',
  );
  assert(
    relicRolls.sourceRevision === manifest.dataSourceRevision,
    'Relic roll revision does not match the version manifest. Run npm run data:update.',
  );
  assert(
    Array.isArray(generated.characters) && generated.characters.length >= 75,
    'Generated character data is incomplete.',
  );
  assert(
    Array.isArray(generated.lightCones) && generated.lightCones.length >= 150,
    'Generated Light Cone data is incomplete.',
  );
  assert(
    Array.isArray(generated.relicSets) && generated.relicSets.length >= 55,
    'Generated relic data is incomplete.',
  );
  for (const [label, items] of [
    ['character', generated.characters],
    ['Light Cone', generated.lightCones],
    ['relic set', generated.relicSets],
  ]) {
    assert(
      new Set(items.map((item) => item.id)).size === items.length,
      `Generated ${label} IDs are not unique.`,
    );
    assert(
      items.every((item) => item.id && item.name),
      `Generated ${label} data contains blank identifiers or names.`,
    );
  }
  assert(
    generated.characters.every(
      (item) =>
        [4, 5].includes(item.rarity) &&
        item.baseStats.hp > 0 &&
        item.baseStats.atk > 0 &&
        item.baseStats.def > 0 &&
        item.baseStats.spd > 0,
    ),
    'Generated character stats are outside expected ranges.',
  );
  assert(
    generated.lightCones.every(
      (item) =>
        [3, 4, 5].includes(item.rarity) &&
        item.baseStats.hp > 0 &&
        item.baseStats.atk > 0 &&
        item.baseStats.def > 0,
    ),
    'Generated Light Cone stats are outside expected ranges.',
  );
  const checksum = createHash('sha256')
    .update(
      JSON.stringify({
        characters: generated.characters,
        lightCones: generated.lightCones,
        relicSets: generated.relicSets,
      }),
    )
    .digest('hex');
  assert(generated.checksum === checksum, 'Generated game-data checksum is invalid.');
  for (const rarity of ['2', '3', '4', '5']) {
    const tier = relicRolls.tiers?.[rarity];
    assert(tier && Object.keys(tier).length >= 10, `Relic roll tier ${rarity} is incomplete.`);
    assert(
      Object.values(tier).every(
        (rolls) =>
          Array.isArray(rolls) &&
          rolls.length === 3 &&
          rolls.every(Number.isFinite) &&
          rolls[0] < rolls[1] &&
          rolls[1] < rolls[2],
      ),
      `Relic roll tier ${rarity} is invalid.`,
    );
  }
}

async function validateVersionSurfaces() {
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  const [scannerInit, scannerProject, serviceWorker] = await Promise.all([
    readFile(scannerInitPath, 'utf8'),
    readFile(scannerProjectPath, 'utf8'),
    readFile(serviceWorkerPath, 'utf8'),
  ]);
  assert(
    packageJson.version === manifest.optimizerVersion,
    'Package and optimizer manifest versions differ.',
  );
  assert(
    scannerInit.includes(`SCANNER_VERSION = "${manifest.scannerVersion}"`),
    'Scanner package and manifest versions differ.',
  );
  assert(
    scannerInit.includes(`SUPPORTED_GAME_VERSION = "${manifest.supportedGameVersion}"`),
    'Scanner and optimizer game-version support differ.',
  );
  assert(
    scannerProject.includes(`version = "${manifest.scannerVersion}"`),
    'Scanner project and manifest versions differ.',
  );
  assert(
    serviceWorker.includes(`${manifest.optimizerVersion}-data-${manifest.gameDataRevision}`),
    'Service-worker cache version is stale.',
  );
}

async function writeJsonAtomically(url, data) {
  const temporary = new URL(`${url.pathname}.tmp`, url);
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`);
  await rename(temporary, url);
}

async function writeTextAtomically(url, data) {
  const temporary = new URL(`${url.pathname}.tmp`, url);
  await writeFile(temporary, data);
  await rename(temporary, url);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Krzys-Star-Rail-Optimizer-data-pipeline' },
  });
  if (!response.ok) throw new Error(`Data request failed with HTTP ${response.status}: ${url}`);
  return response.json();
}

async function getLatestRevision() {
  const commit = await fetchJson(`https://api.github.com/repos/${repository}/commits/main`);
  assert(/^[a-f0-9]{40}$/.test(commit.sha), 'Upstream commit revision is invalid.');
  return commit.sha;
}

async function findOfficialVersion() {
  let offset = '';
  const found = [];
  for (let page = 0; page < 20; page += 1) {
    const url = new URL('https://bbs-api-os.hoyolab.com/community/post/wapi/userPost');
    url.searchParams.set('uid', '172534910');
    url.searchParams.set('size', '50');
    if (offset) url.searchParams.set('offset', offset);
    const response = await fetchJson(url);
    assert(response.retcode === 0, `HoYoLAB returned code ${response.retcode}.`);
    for (const item of response.data?.list ?? []) {
      const subject = String(item.post?.subject ?? '');
      const match = subject.match(/^Version (\d+\.\d+) .+ Update Details$/);
      if (match) found.push({ version: match[1], postId: String(item.post.post_id) });
    }
    if (response.data?.is_last || found.length) break;
    offset = String(response.data?.next_offset ?? '');
    if (!offset) break;
  }
  assert(
    found.length > 0,
    'Could not verify the live HSR version from the official HoYoLAB account.',
  );
  return found.sort((a, b) => compareVersions(b.version, a.version))[0];
}

async function downloadRevision(revision) {
  const url = `https://raw.githubusercontent.com/${repository}/${revision}/${upstreamPath}`;
  return fetchJson(url);
}

async function downloadRelicRolls(revision) {
  return fetchJson(
    `https://raw.githubusercontent.com/${repository}/${revision}/${upstreamRelicPath}`,
  );
}

if (mode === '--verify') {
  const generated = JSON.parse(await readFile(generatedPath, 'utf8'));
  const relicRolls = JSON.parse(await readFile(relicRollsPath, 'utf8'));
  validateGenerated(generated, relicRolls);
  await validateVersionSurfaces();
  console.log(
    `Verified HSR v${manifest.supportedGameVersion} data at ${manifest.dataSourceRevision.slice(0, 12)}.`,
  );
} else if (mode === '--write') {
  assert(
    !process.argv.includes('--latest'),
    'Unreviewed latest data cannot be written. Use --promote-data after compatibility review.',
  );
  const revision = manifest.dataSourceRevision;
  const [source, rollSource] = await Promise.all([
    downloadRevision(revision),
    downloadRelicRolls(revision),
  ]);
  const normalized = normalize(source, revision);
  const relicRolls = normalizeRelicRolls(rollSource, revision);
  await writeJsonAtomically(generatedPath, normalized);
  await writeJsonAtomically(relicRollsPath, relicRolls);
  console.log(
    `Wrote ${normalized.characters.length} characters, ${normalized.lightCones.length} Light Cones, and ${normalized.relicSets.length} relic sets.`,
  );
} else if (mode === '--check-latest') {
  const [official, latestRevision] = await Promise.all([
    findOfficialVersion(),
    getLatestRevision(),
  ]);
  const result = {
    supportedVersion: manifest.supportedGameVersion,
    officialVersion: official.version,
    officialPostId: official.postId,
    currentRevision: manifest.dataSourceRevision,
    latestRevision,
    versionChanged: official.version !== manifest.supportedGameVersion,
    dataChanged: latestRevision !== manifest.dataSourceRevision,
  };
  console.log(JSON.stringify(result));
  if (result.versionChanged) process.exitCode = 3;
  else if (result.dataChanged) process.exitCode = 2;
} else if (mode === '--promote-data') {
  const [official, revision] = await Promise.all([findOfficialVersion(), getLatestRevision()]);
  assert(
    official.version === manifest.supportedGameVersion,
    `Official HSR v${official.version} requires compatibility review before promotion.`,
  );
  const [source, rollSource] = await Promise.all([
    downloadRevision(revision),
    downloadRelicRolls(revision),
  ]);
  const normalized = normalize(source, revision);
  const relicRolls = normalizeRelicRolls(rollSource, revision);
  const now = new Date().toISOString();
  const dateRevision = now.slice(0, 10).replaceAll('-', '.');
  const currentSequence = manifest.gameDataRevision.startsWith(`${dateRevision}.`)
    ? Number(manifest.gameDataRevision.split('.').at(-1))
    : 0;
  assert(Number.isInteger(currentSequence), 'Current game-data revision is invalid.');
  const nextGameDataRevision = `${dateRevision}.${currentSequence + 1}`;
  const nextManifest = {
    ...manifest,
    gameDataRevision: nextGameDataRevision,
    generatedAt: now,
    dataSourceRevision: revision,
  };
  normalized.generatedAt = now;
  await writeJsonAtomically(generatedPath, normalized);
  await writeJsonAtomically(relicRollsPath, relicRolls);
  await writeJsonAtomically(manifestPath, nextManifest);
  const serviceWorker = await readFile(serviceWorkerPath, 'utf8');
  const nextServiceWorker = serviceWorker.replace(
    /const CACHE = `[^`]+`;/,
    'const CACHE = `${PREFIX}' + manifest.optimizerVersion + `-data-${nextGameDataRevision}-r1\`;`,
  );
  assert(nextServiceWorker !== serviceWorker, 'Service-worker cache declaration was not found.');
  await writeTextAtomically(serviceWorkerPath, nextServiceWorker);
  console.log(`Promoted verified HSR v${official.version} data at ${revision}.`);
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
