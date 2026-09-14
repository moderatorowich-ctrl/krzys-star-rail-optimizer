import { mkdir, readFile, writeFile } from 'node:fs/promises';

const data = JSON.parse(
  await readFile(
    new URL('../packages/game-data/src/game-data.generated.json', import.meta.url),
    'utf8',
  ),
);
const wanted = [
  'Acheron',
  'Firefly',
  'Ruan Mei',
  'Lingsha',
  'The Herta',
  'Robin',
  'Aventurine',
  'Sunday',
];
const fallback = data.characters.slice(0, wanted.length);
const selected = wanted.map(
  (name, index) => data.characters.find((item) => item.name === name) ?? fallback[index],
);
const slots = ['Head', 'Hands', 'Body', 'Feet', 'Planar Sphere', 'Link Rope'];
const sets = [
  'Pioneer Diver of Dead Waters',
  'Iron Cavalry Against the Scourge',
  'Watchmaker, Master of Dream Machinations',
  'Messenger Traversing Hackerspace',
  'Scholar Lost in Erudition',
  'The Ashblazing Grand Duke',
  'Broken Keel',
  'Rutilant Arena',
  'Duran, Dynasty of Running Wolves',
  'Forge of the Kalpagni Lantern',
];
const mainBySlot = {
  Head: [{ stat: 'hp', value: 705.6 }],
  Hands: [{ stat: 'atk', value: 352.8 }],
  Body: [
    { stat: 'critRate', value: 0.324 },
    { stat: 'critDmg', value: 0.648 },
    { stat: 'atkPct', value: 0.432 },
  ],
  Feet: [
    { stat: 'spd', value: 25 },
    { stat: 'atkPct', value: 0.432 },
  ],
  'Planar Sphere': [
    { stat: 'elementalDmg', value: 0.388 },
    { stat: 'atkPct', value: 0.432 },
  ],
  'Link Rope': [
    { stat: 'atkPct', value: 0.432 },
    { stat: 'breakEffect', value: 0.648 },
    { stat: 'energyRegen', value: 0.194 },
  ],
};
const relics = [];
for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
  const slot = slots[slotIndex];
  for (let index = 0; index < 12; index += 1) {
    const ownerIndex = index < 8 ? index : -1;
    const quality = 0.72 + ((index * 7 + slotIndex * 3) % 19) / 100;
    const level = [15, 15, 12, 15, 9, 15, 12, 15, 6, 12, 0, 15][index];
    relics.push({
      id: `R${String(slotIndex + 1).padStart(2, '0')}${String(index + 1).padStart(3, '0')}`,
      set: slotIndex < 4 ? sets[index % 6] : sets[6 + (index % 4)],
      slot,
      rarity: 5,
      level,
      mainStat: mainBySlot[slot][index % mainBySlot[slot].length],
      substats: [
        { stat: 'critRate', value: Number((0.058 * quality).toFixed(4)) },
        { stat: 'critDmg', value: Number((0.116 * quality).toFixed(4)) },
        { stat: 'spd', value: Number((2.6 + ((index + slotIndex) % 4) * 1.9).toFixed(1)) },
        {
          stat: index % 3 === 0 ? 'breakEffect' : 'atkPct',
          value: Number(((index % 3 === 0 ? 0.116 : 0.087) * quality).toFixed(4)),
        },
        { stat: 'defPct', value: 0.054 },
      ]
        .filter((stat) => stat.stat !== mainBySlot[slot][index % mainBySlot[slot].length].stat)
        .slice(0, 4),
      locked: index === 1 || index === 6,
      discarded: index === 10,
      equippedCharacterId: ownerIndex >= 0 ? selected[ownerIndex].id : undefined,
      reservedFor: index === 9 ? selected[(index + slotIndex) % selected.length].id : undefined,
      ocrConfidence:
        index === 8 ? 0.71 : Number((0.96 - ((index + slotIndex) % 5) * 0.02).toFixed(2)),
    });
  }
}
const characters = selected.map((character, index) => ({
  id: character.id,
  name: character.name,
  nickname: index === 0 ? 'Raiden' : undefined,
  path: character.path,
  element: character.element,
  level: index === 7 ? 70 : 80,
  ascension: index === 7 ? 5 : 6,
  eidolon: index % 3 === 0 ? 1 : 0,
  traces: {
    basic: index === 7 ? 4 : 6,
    skill: index === 7 ? 7 : 10,
    ultimate: index === 7 ? 7 : 10,
    talent: index === 7 ? 7 : 10,
    unlockedNodes: ['A2', 'A4', 'A6'],
  },
  baseStats: {
    hp: character.baseStats.hp,
    atk: character.baseStats.atk,
    def: character.baseStats.def,
    spd: character.baseStats.spd,
    critRate: character.baseStats.critRate,
    critDmg: character.baseStats.critDmg,
  },
  tags: index < 4 ? ['MoC side 1'] : ['MoC side 2'],
}));
const lightCones = selected.map((character, index) => {
  const cone =
    data.lightCones.find((item) => item.path === character.path && item.rarity === 5) ??
    data.lightCones[index];
  return {
    id: `${cone.id}-${index}`,
    name: cone.name,
    path: cone.path,
    rarity: cone.rarity,
    level: index === 7 ? 70 : 80,
    ascension: index === 7 ? 5 : 6,
    superimposition: 1,
    baseStats: { hp: cone.baseStats.hp, atk: cone.baseStats.atk, def: cone.baseStats.def },
    locked: true,
    equippedCharacterId: character.id,
  };
});
const account = {
  metadata: {
    schemaVersion: 2,
    gameVersion: '4.5',
    exportedAt: '2026-09-13T00:00:00.000Z',
    source: 'demo',
    uidRedacted: true,
  },
  characters,
  lightCones,
  relics,
  resources: {
    credits: 2650000,
    traceMaterials: 84,
    relicRemains: 560,
    stellarJade: 12800,
    specialPasses: 24,
  },
  reservations: {},
};
await mkdir(new URL('../tests/fixtures/', import.meta.url), { recursive: true });
const serialized = `${JSON.stringify(account, null, 2)}\n`;
await writeFile(
  new URL('../packages/game-data/src/demo-account.generated.json', import.meta.url),
  serialized,
);
await writeFile(new URL('../tests/fixtures/demo-account.json', import.meta.url), serialized);
console.log(
  `Generated anonymized fixture with ${characters.length} characters and ${relics.length} relics.`,
);
