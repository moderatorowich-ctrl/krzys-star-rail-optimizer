import manifestJson from './version-manifest.json';
import generatedJson from './game-data.generated.json';
import demoAccountJson from './demo-account.generated.json';
import relicRollsJson from './relic-rolls.generated.json';
import type { Account, VersionManifest } from '@ksro/shared';

export const versionManifest = manifestJson as VersionManifest;
export const relicRolls = relicRollsJson.tiers as Record<string, Record<string, number[]>>;

export interface GameCharacter {
  id: string;
  name: string;
  rarity: number;
  path: string;
  element: string;
  maxSp: number;
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    spd: number;
    critRate: number;
    critDmg: number;
  };
  unreleased: boolean;
}

export interface GameLightCone {
  id: string;
  name: string;
  rarity: number;
  path: string;
  baseStats: { hp: number; atk: number; def: number };
  unreleased: boolean;
}

export interface RelicSetDefinition {
  id: string;
  name: string;
  skills: string;
}

export const gameData = generatedJson as {
  sourceRevision: string;
  generatedAt: string;
  characters: GameCharacter[];
  lightCones: GameLightCone[];
  relicSets: RelicSetDefinition[];
};

export const demoAccount = demoAccountJson as Account;

export const encounterData = [
  {
    id: 'as-celestial-lupine-4.5',
    mode: 'Apocalyptic Shadow',
    name: 'User-configured Apocalyptic Shadow model',
    version: '4.5',
    activeFrom: '2026-08-31T04:00:00',
    activeTo: '2026-10-05T03:59:00',
    waves: [
      {
        targets: 1,
        level: 95,
        hpScale: 1,
        weaknesses: ['Fire', 'Ice', 'Imaginary'],
        resistance: 0.2,
      },
      {
        targets: 1,
        level: 95,
        hpScale: 1.4,
        weaknesses: ['Physical', 'Quantum', 'Wind'],
        resistance: 0.2,
      },
    ],
    buff: 'Placeholder assumptions only. Enter the current in-game enemy and buff values in the optimizer.',
    uncertainty:
      'Enemy HP scaling is normalized because exact in-game phase transitions vary by difficulty and selected boss side.',
  },
  {
    id: 'pf-domain-genesis-4.5',
    mode: 'Pure Fiction',
    name: 'User-configured Pure Fiction model',
    version: '4.5',
    activeFrom: '2026-09-14T04:00:00',
    activeTo: '2026-10-19T03:59:00',
    waves: [
      {
        targets: 5,
        level: 95,
        hpScale: 0.55,
        weaknesses: ['Lightning', 'Ice', 'Quantum'],
        resistance: 0.2,
      },
      {
        targets: 5,
        level: 95,
        hpScale: 0.72,
        weaknesses: ['Fire', 'Wind', 'Physical'],
        resistance: 0.2,
      },
    ],
    buff: 'Placeholder assumptions only. Enter the current in-game target count and buff values in the optimizer.',
    uncertainty:
      'Score estimates use normalized wave density and do not promise a clear or star rating.',
  },
  {
    id: 'moc-stormcleanse-4.5',
    mode: 'Memory of Chaos',
    name: 'User-configured Memory of Chaos model',
    version: '4.5',
    activeFrom: '2026-08-17T04:00:00',
    activeTo: '2026-09-28T06:00:00+08:00',
    waves: [
      {
        targets: 2,
        level: 95,
        hpScale: 1,
        weaknesses: ['Fire', 'Lightning', 'Imaginary'],
        resistance: 0.2,
      },
      {
        targets: 2,
        level: 95,
        hpScale: 1.3,
        weaknesses: ['Ice', 'Wind', 'Quantum'],
        resistance: 0.2,
      },
    ],
    buff: 'Placeholder assumptions only. Enter the current in-game wave and buff values in the optimizer.',
    uncertainty: 'Cycle ranges assume consistent target selection and average critical outcomes.',
  },
] as const;

export const farmingDomains = [
  {
    id: 'cavern-duke-prisoner',
    name: 'Path of Darkness',
    sets: ['The Ashblazing Grand Duke', 'Prisoner in Deep Confinement'],
  },
  {
    id: 'cavern-scholar-sacerdos',
    name: 'Path of Uncertainty',
    sets: ['Scholar Lost in Erudition', "Sacerdos' Relived Ordeal"],
  },
  {
    id: 'cavern-iron-valorous',
    name: 'Path of Cavalier',
    sets: ['Iron Cavalry Against the Scourge', 'The Wind-Soaring Valorous'],
  },
  {
    id: 'planar-duran-kalpagni',
    name: 'Divergent Universe: Eternal Comedy',
    sets: ['Duran, Dynasty of Running Wolves', 'Forge of the Kalpagni Lantern'],
  },
  {
    id: 'planar-anchor-life',
    name: 'Divergent Universe: Seabound Star',
    sets: ['Fallen Star Anchorage', 'Cosmic Life Sciences Institute'],
  },
] as const;
