// Sentinel: armor AP applies to wherever the cybernetic is installed
export const IMPL_LOC = '__implant_location__';

export interface CyberneticBonusEffect {
  description: string;
  /** Unnatural characteristic bonuses: abbrev → amount to ADD */
  unnatural?: Partial<Record<string, number>>;
  /** Talent names to grant */
  talents?: string[];
  /** Armor AP bonuses. Use IMPL_LOC as location to resolve to the implant's body location. */
  armor?: Array<{ location: string; ap: number }>;
  /** If true, this tier cannot be used by player characters */
  unavailableForPC?: boolean;
}

export interface CyberneticTemplate {
  name: string;
  availability: string;
  reference: string;
  /** Suggested default location for the picker */
  defaultLocation?: string;
  craftsmanship: {
    Poor:   CyberneticBonusEffect | null;
    Common: CyberneticBonusEffect | null;
    Good:   CyberneticBonusEffect | null;
    Best:   CyberneticBonusEffect | null;
  };
}

export const CYBERNETICS_DATA: CyberneticTemplate[] = [
  {
    name: 'Synthmuscle',
    availability: 'Rare (-20)',
    reference: 'CRB 185',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   { description: 'Suffers the same drawback as Best Craftsmanship without any bonus.' },
      Common: { description: 'Grants Unnatural Strength (1).', unnatural: { S: 1 } },
      Good:   { description: 'Grants Unnatural Strength (2). May appear visibly built or deceptively lithe.', unnatural: { S: 2 } },
      Best:   { description: 'Grants Unnatural Strength (4) and Bulging Biceps talent, but imposes –10 to all Acrobatics and Agility tests.', unnatural: { S: 4 }, talents: ['Bulging Biceps'] },
    },
  },
  {
    name: 'Augur Array',
    availability: 'Rare (-20)',
    reference: 'PG 181 CB',
    defaultLocation: 'Head',
    craftsmanship: {
      Poor:   null,
      Common: { description: 'Duplicates the effects of a standard hand-held auspex device. Requires concentration and a Half Action.' },
      Good:   null,
      Best:   null,
    },
  },
  {
    name: 'Autosanguine',
    availability: 'Very Rare (-30)',
    reference: 'PG 181 CB',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   { description: 'Always considered Lightly Damaged; removes 2 Damage per day. No Die Hard.' },
      Common: { description: 'Grants Die Hard talent; always considered Lightly Damaged; removes 2 Damage per day.', talents: ['Die Hard'] },
      Good:   { description: 'Grants Die Hard and Sound Constitution talents.', talents: ['Die Hard', 'Sound Constitution'] },
      Best:   { description: 'Grants Die Hard, Sound Constitution, and Regeneration (2) trait.', talents: ['Die Hard', 'Sound Constitution', 'Regeneration (2)'] },
    },
  },
  {
    name: 'Baleful Eye',
    availability: 'Near Unique (-50)',
    reference: 'PG 182 CB',
    defaultLocation: 'Head',
    craftsmanship: {
      Poor:   null,
      Common: { description: 'Counts as a hot-shot laspistol (Range 10m). A jam result causes loss of sight for rounds equal to degrees of failure.' },
      Good:   null,
      Best:   null,
    },
  },
  {
    name: 'Bionic Arm',
    availability: 'Scarce (-10)',
    reference: 'PG 180 CB',
    defaultLocation: 'Right Arm',
    craftsmanship: {
      Poor:   { description: 'Cumbersome and visibly artificial. Imposes –5 to tests where inferior dexterity is detrimental. +2 AP to location.', armor: [{ location: IMPL_LOC, ap: 2 }] },
      Common: { description: 'Functional bionic arm. +2 AP to location.', armor: [{ location: IMPL_LOC, ap: 2 }] },
      Good:   { description: 'Grants Unnatural Strength (1) and +5 bonus where superior strength/dexterity helps. +2 AP to location.', unnatural: { S: 1 }, armor: [{ location: IMPL_LOC, ap: 2 }] },
      Best:   { description: 'Grants Unnatural Strength (2) and concealed interior compartment for small items. +2 AP to location.', unnatural: { S: 2 }, armor: [{ location: IMPL_LOC, ap: 2 }] },
    },
  },
  {
    name: 'Bionic Legs',
    availability: 'Scarce (-10)',
    reference: 'PG 181 CB',
    defaultLocation: 'Right Leg',
    craftsmanship: {
      Poor:   { description: 'Lumbering and bulky. –5 to balance/stability tests; movement rate reduced by 1 when paired. +2 AP to location.', armor: [{ location: IMPL_LOC, ap: 2 }] },
      Common: { description: 'Fully functional at normal human levels. Requisitioned as individual legs. +2 AP to location.', armor: [{ location: IMPL_LOC, ap: 2 }] },
      Good:   { description: '+5 to strength/stability/balance tests. Unnatural Agility (1) when paired with a second Good bionic leg. +2 AP to location.', unnatural: { AG: 1 }, armor: [{ location: IMPL_LOC, ap: 2 }] },
      Best:   { description: 'Sprint talent and Unnatural Agility (2) when paired with a second Best bionic leg. +2 AP to location.', unnatural: { AG: 2 }, talents: ['Sprint'], armor: [{ location: IMPL_LOC, ap: 2 }] },
    },
  },
  {
    name: 'Bionic Respiratory System',
    availability: 'Rare (-20)',
    reference: 'PG 181 CB',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   null,
      Common: { description: '+20 bonus to Toughness tests to resist airborne toxins and gas.' },
      Good:   null,
      Best:   null,
    },
  },
  {
    name: 'Bionic Heart',
    availability: 'Very Rare (-30)',
    reference: 'PG 181 CB',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   null,
      Common: { description: '+1 AP to the Body location and grants the Sprint talent.', talents: ['Sprint'], armor: [{ location: 'Body', ap: 1 }] },
      Good:   null,
      Best:   null,
    },
  },
  {
    name: 'Bionic Senses',
    availability: 'Rare (-20)',
    reference: 'PG 181 CB',
    defaultLocation: 'Head',
    craftsmanship: {
      Poor:   { description: '–10 to all tests using the cybernetic sense.' },
      Common: { description: 'Duplicates natural senses. No additional effect.' },
      Good:   { description: 'Grants Unnatural Perception (1) when using that sense. Incorporates Good-craftsmanship sensory aid.', unnatural: { PER: 1 } },
      Best:   { description: 'Grants Unnatural Perception (2) when using that sense. Incorporates Best-craftsmanship sensory aids. Additional systems can be incorporated.', unnatural: { PER: 2 } },
    },
  },
  {
    name: 'Calculus Logi Upgrade',
    availability: 'Very Rare (-30)',
    reference: 'PG 182 CB',
    defaultLocation: 'Neural',
    craftsmanship: {
      Poor:   { description: '+5 bonus to Commerce, Inquiry, Literacy, Logic, Lore, Scrutiny when having access to large data volumes.' },
      Common: { description: '+10 bonus to Commerce, Inquiry, Literacy, Logic, Lore, Scrutiny, and relevant Trade tests when accessing large data volumes.' },
      Good:   { description: '+10 bonus (as Common) and grants the Archivator talent.', talents: ['Archivator'] },
      Best:   { description: '+20 bonus to all listed skills and grants the Archivator talent.', talents: ['Archivator'] },
    },
  },
  {
    name: 'Cerebral Implants',
    availability: 'Very Rare (-30)',
    reference: 'PG 182 CB',
    defaultLocation: 'Neural',
    craftsmanship: {
      Poor:   { description: 'Destroys personality and memories, rendering subject no better than a servitor. Not suitable for Player Characters.', unavailableForPC: true },
      Common: { description: 'Restores function with permanent loss of 1d10 points from WS, BS, AG, INT, and FEL characteristics.' },
      Good:   { description: 'Near Unique availability. Grants Unnatural Intelligence (1) and +10 to Literacy, Logic, and Lore tests.', unnatural: { INT: 1 } },
      Best:   { description: 'Unique availability. Grants Unnatural Intelligence (2) and +20 to Literacy, Logic, and Lore tests.', unnatural: { INT: 2 } },
    },
  },
  {
    name: 'Cranial Armour',
    availability: 'Scarce (-10)',
    reference: 'PG 182 CB',
    defaultLocation: 'Head',
    craftsmanship: {
      Poor:   { description: '–5 to all Fellowship-based tests. +1 AP to Head.', armor: [{ location: 'Head', ap: 1 }] },
      Common: { description: '+1 AP to Head. Stacks with worn armour.', armor: [{ location: 'Head', ap: 1 }] },
      Good:   { description: 'Indiscernible to casual observers. +2 AP to Head; counts as 1 AP higher vs Blast weapons.', armor: [{ location: 'Head', ap: 2 }] },
      Best:   { description: '+3 AP to Head. Indiscernible; counts as 1 AP higher vs Blast weapons.', armor: [{ location: 'Head', ap: 3 }] },
    },
  },
  {
    name: 'Ferric Lure Implants',
    availability: 'Very Rare (-30)',
    reference: 'PG 182 CB',
    defaultLocation: 'Neural',
    craftsmanship: {
      Poor:   null,
      Common: { description: 'After a Willpower test, calls an unsecured metal object within 20m to hand (max 1 kg per WP bonus). Requires Mechanicus Implants trait.' },
      Good:   null,
      Best:   null,
    },
  },
  {
    name: 'Interface Port',
    availability: 'Rare (-20)',
    reference: 'PG 182 CB',
    defaultLocation: 'Neural',
    craftsmanship: {
      Poor:   null,
      Common: { description: '+10 bonus to Common Lore, Inquiry, or Tech-Use tests whilst connected to a relevant mechanism or data spool.' },
      Good:   null,
      Best:   null,
    },
  },
  {
    name: 'Internal Reservoir',
    availability: 'Rare (-20)',
    reference: 'PG 182 CB',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   { description: 'Drained after a single use of energized implants.' },
      Common: { description: 'No Fatigue from Luminen Capacitors; each use drains reservoir by half. Recharges after one day of rest.' },
      Good:   { description: 'Each use of energized implants drains reservoir by one third.' },
      Best:   { description: 'Each use of energized implants drains reservoir by one sixth.' },
    },
  },
  {
    name: 'Locator Matrix',
    availability: 'Rare (-20)',
    reference: 'PG 183 CB',
    defaultLocation: 'Neural',
    craftsmanship: {
      Poor:   null,
      Common: { description: 'Provides present location to within a few meters. Requires knowledge of the planet.' },
      Good:   null,
      Best:   null,
    },
  },
  {
    name: 'Luminen Capacitor',
    availability: 'Very Rare (-30)',
    reference: 'PG 183 CB',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   null,
      Common: { description: 'With a successful Toughness test, recharges or powers machinery. Difficulty depends on the nature of the system. Requires Mechanicus Implants trait.' },
      Good:   null,
      Best:   null,
    },
  },
  {
    name: 'Maglev Coils',
    availability: 'Very Rare (-30)',
    reference: 'PG 183 CB',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   null,
      Common: { description: 'Using a Half Action, hover 20–30 cm off the ground for 1d10 + Toughness Bonus minutes. Requires Mechanicus Implants trait.' },
      Good:   null,
      Best:   null,
    },
  },
  {
    name: 'Mechadendrite',
    availability: 'Very Rare (-30)',
    reference: 'PG 183 CB',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   null,
      Common: { description: 'Acts as an additional arm. Different types (Medicae, Utility, Weapon, etc.) offer bonuses to their respective operations. Requires Mechadendrite Use talent.' },
      Good:   null,
      Best:   null,
    },
  },
  {
    name: 'Memorance Implant',
    availability: 'Very Rare (-30)',
    reference: 'PG 184 CB',
    defaultLocation: 'Neural',
    craftsmanship: {
      Poor:   { description: '+5 to Trade (Loremancer/Remembrancer) and social tests where recorded information helps.' },
      Common: { description: '+10 to Trade (Loremancer/Remembrancer) and social tests where recorded information provides leverage.' },
      Good:   { description: '+10 bonus (as Common) and grants the Total Recall talent.', talents: ['Total Recall'] },
      Best:   { description: '+20 bonus and grants the Total Recall talent. Projects stored information as 3D holographic images.', talents: ['Total Recall'] },
    },
  },
  {
    name: 'Mind Impulse Unit',
    availability: 'Very Rare (-30)',
    reference: 'PG 184 CB',
    defaultLocation: 'Neural',
    craftsmanship: {
      Poor:   { description: 'Requires a Willpower test to use.' },
      Common: { description: '+10 bonus to Tech-Use or Operate tests when interfacing with MIU-capable devices.' },
      Good:   { description: '+5 to WS/BS for vehicle weapons; +10 to Tech-Use, Operate, Logic, and Inquiry when interfacing.' },
      Best:   { description: '+10 to WS/BS for vehicle weapons; Good bonuses increased by an additional +10.' },
    },
  },
  {
    name: 'MIU Weapon Interface',
    availability: 'Rare (-20)',
    reference: 'PG 184 CB',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   { description: '–10 to BS tests to fire the linked weapon; can only target enemies in a 30° arc.' },
      Common: { description: 'Fire the linked shoulder-mounted ranged weapon as a Free Action during your turn (still limited to one Attack action).' },
      Good:   { description: '+10 to BS tests to fire the linked weapon.' },
      Best:   { description: '+10 to BS (as Good); can fire the linked weapon using two Reactions instead.' },
    },
  },
  {
    name: 'Respiratory Filter Implant',
    availability: 'Scarce (-10)',
    reference: 'PG 185 CB',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   null,
      Common: { description: '+20 bonus to resist inhaled poisons, gas weapons, or atmospheric toxins.' },
      Good:   null,
      Best:   null,
    },
  },
  {
    name: 'Scribe-tines',
    availability: 'Rare (-20)',
    reference: 'PG 185 CB',
    defaultLocation: 'Right Arm',
    craftsmanship: {
      Poor:   null,
      Common: { description: '+10 to all Lore skill tests.' },
      Good:   null,
      Best:   null,
    },
  },
  {
    name: 'Subskin Armour',
    availability: 'Rare (-20)',
    reference: 'PG 185 CB',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   {
        description: '+2 AP to Arms, Body, and Legs. –10 to all Acrobatics and Agility tests.',
        armor: [
          { location: 'Left Arm', ap: 2 }, { location: 'Right Arm', ap: 2 },
          { location: 'Body', ap: 2 },
          { location: 'Left Leg', ap: 2 }, { location: 'Right Leg', ap: 2 },
        ],
      },
      Common: {
        description: '+2 AP to Arms, Body, and Legs. Stacks with worn armour.',
        armor: [
          { location: 'Left Arm', ap: 2 }, { location: 'Right Arm', ap: 2 },
          { location: 'Body', ap: 2 },
          { location: 'Left Leg', ap: 2 }, { location: 'Right Leg', ap: 2 },
        ],
      },
      Good: {
        description: '+3 AP to Arms, Body, and Legs. Indiscernible; counts as 1 AP higher vs Blast weapons.',
        armor: [
          { location: 'Left Arm', ap: 3 }, { location: 'Right Arm', ap: 3 },
          { location: 'Body', ap: 3 },
          { location: 'Left Leg', ap: 3 }, { location: 'Right Leg', ap: 3 },
        ],
      },
      Best: {
        description: '+4 AP to Arms, Body, and Legs. Indiscernible; counts as 1 AP higher vs Blast weapons.',
        armor: [
          { location: 'Left Arm', ap: 4 }, { location: 'Right Arm', ap: 4 },
          { location: 'Body', ap: 4 },
          { location: 'Left Leg', ap: 4 }, { location: 'Right Leg', ap: 4 },
        ],
      },
    },
  },
  {
    name: 'Vocal Implant',
    availability: 'Scarce (-10)',
    reference: 'PG 185 CB',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   { description: '–10 to Fellowship tests in non-threatening situations. Acts as a laud hailer.' },
      Common: { description: 'Amplifies vocal cords. Acts as a laud hailer.' },
      Good:   { description: 'Indiscernible; can grant the Disturbing Voice talent if desired.', talents: ['Disturbing Voice'] },
      Best:   { description: 'Grants Disturbing Voice and Mimic talents.', talents: ['Disturbing Voice', 'Mimic'] },
    },
  },
  {
    name: 'Volitor Implant',
    availability: 'Very Rare (-30)',
    reference: 'PG 185 CB',
    defaultLocation: 'Neural',
    craftsmanship: {
      Poor:   null,
      Common: { description: 'Compels the subject not to reveal information, stay in an area, or perform a task. Attempting to counter causes unconsciousness or death.' },
      Good:   null,
      Best:   null,
    },
  },
  {
    name: 'Restorative Surgery',
    availability: 'Scarce (-10)',
    reference: '',
    defaultLocation: 'Head',
    craftsmanship: {
      Poor:   { description: 'Removes 1d5 points of permanent Fellowship damage.' },
      Common: { description: 'Removes 1d5+5 points of permanent characteristic damage.' },
      Good:   { description: 'Restores characteristic damage and grants Unnatural Fellowship (1).', unnatural: { FEL: 1 } },
      Best:   { description: 'Restores characteristic damage and grants Unnatural Fellowship (2).', unnatural: { FEL: 2 } },
    },
  },
  {
    name: 'Servo-arm',
    availability: 'Very Rare (-30)',
    reference: '',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   { description: 'Servo-arm gains the Recharge quality. Imposes –10 to Stealth. Melee: 2d10+14 I; Pen 10; Inaccurate, Unwieldy. Requires Mechadendrite Use talent.' },
      Common: { description: 'Servo-arm (Strength 75, Unnatural Strength 7). –10 to Stealth. Melee: 2d10+14 I; Pen 10; Inaccurate, Unwieldy. Requires Mechadendrite Use talent.' },
      Good:   { description: 'No –10 Stealth penalty. No Inaccurate quality. Requires Mechadendrite Use talent.' },
      Best:   { description: 'As Good; can also attack using a Weapon Skill-based Reaction.' },
    },
  },
  {
    name: 'Skeletal Metamorphose',
    availability: 'Rare (-20)',
    reference: '',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   { description: 'Overtly disfigures bone structure. Suffers the same drawback as Best without any bonus.' },
      Common: { description: 'Fortifies bone structure. Grants Unnatural Toughness (1).', unnatural: { T: 1 } },
      Good:   { description: 'Grants Unnatural Toughness (2) and +2 bonus to Damage with all unarmed attacks.', unnatural: { T: 2 } },
      Best:   { description: 'Grants Unnatural Toughness (4) and Iron Jaw talent, but imposes –10 to all Acrobatics and Agility tests.', unnatural: { T: 4 }, talents: ['Iron Jaw'] },
    },
  },
  {
    name: 'Injector Rig',
    availability: 'Rare (-20)',
    reference: '',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   { description: 'On a Critical Hit, must pass Toughness (+0) test or take 2d10 Energy Damage to body. Also –10 to social tests (except Intimidate: +10).' },
      Common: { description: 'Holds up to 10 doses of 4 substances. Injecting requires a Half Action. –10 to interaction skills (except Intimidate: +10) in civil society.' },
      Good:   { description: 'Removes the conditional social test penalties and Intimidate bonus.' },
      Best:   { description: 'May inject a substance as a Free Action or Agility-based Reaction.' },
    },
  },
  {
    name: 'Interkeratic Implants',
    availability: 'Very Rare (-30)',
    reference: '',
    defaultLocation: 'Head',
    craftsmanship: {
      Poor:   null,
      Common: { description: 'Additional corneal layer; functions identically to Poor/Common Photo-contacts. Less obvious than bionic eyes.' },
      Good:   { description: 'Functions identically to Good Craftsmanship Bionic Eyes (Unnatural Perception 1). Less obvious than bionic eyes.', unnatural: { PER: 1 } },
      Best:   { description: 'Functions identically to Best Craftsmanship Bionic Eyes (Unnatural Perception 2). Less obvious than bionic eyes.', unnatural: { PER: 2 } },
    },
  },
  {
    name: 'Synthnerves',
    availability: 'Very Rare (-30)',
    reference: '',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   { description: 'Suffers the same drawback as Best without any bonus.' },
      Common: { description: 'Grants Lightning Reflexes and Quick Draw talents.', talents: ['Lightning Reflexes', 'Quick Draw'] },
      Good:   { description: 'Grants Lightning Reflexes, Quick Draw, and Unnatural Agility (1).', unnatural: { AG: 1 }, talents: ['Lightning Reflexes', 'Quick Draw'] },
      Best:   { description: 'Grants Unnatural Agility (2), Rapid Reaction, Lightning Reflexes, and Quick Draw. –10 to resist Stunning or pain penalties.', unnatural: { AG: 2 }, talents: ['Lightning Reflexes', 'Quick Draw', 'Rapid Reaction'] },
    },
  },
  {
    name: 'Ocular Sight',
    availability: 'Extremely Rare (-40)',
    reference: '',
    defaultLocation: 'Head',
    craftsmanship: {
      Poor:   { description: 'Decreases Bionic Eye and Telescopic Sight Craftsmanship to Poor. Activates to combat mode as a Half Action.' },
      Common: { description: 'Common Bionic Eye + Common Telescopic Sight in combat mode. Called Shot as a Half Action while active.' },
      Good:   { description: 'Good Bionic Eye (Unnatural Perception 1) + Good Telescopic Sight in combat mode.', unnatural: { PER: 1 } },
      Best:   { description: 'Best Bionic Eye (Unnatural Perception 2) + Best Telescopic Sight in combat mode.', unnatural: { PER: 2 } },
    },
  },
  {
    name: 'Pain Ward',
    availability: 'Rare (-20)',
    reference: '',
    defaultLocation: 'Neural',
    craftsmanship: {
      Poor:   { description: 'Hallucinates (roll on Hallucinogenic Effects table) when a Stun result would apply.' },
      Common: { description: 'Redirects pain signals. Grants Iron Jaw talent.', talents: ['Iron Jaw'] },
      Good:   { description: 'Iron Jaw + +10 to all tests to resist Stunning or pain penalties.', talents: ['Iron Jaw'] },
      Best:   { description: 'Iron Jaw + Never Die talent (no Fate Point needed). Note: character can no longer track their own Wound total.', talents: ['Iron Jaw', 'Never Die'] },
    },
  },
  {
    name: 'Biomonitor',
    availability: 'Rare (-20)',
    reference: '',
    defaultLocation: 'Torso',
    craftsmanship: {
      Poor:   { description: '+10 to Medicae (Diagnose) tests when diagnosing oneself as a Half Action.' },
      Common: { description: '+20 to Medicae (Diagnose) on self (Half Action). If INT 30+, gains Resistance (Diseases) talent.', talents: ['Resistance (Diseases)'] },
      Good:   { description: '+30 to Medicae (Diagnose) on self. Grants Sound Constitution talent.', talents: ['Sound Constitution'] },
      Best:   { description: '+40 to Medicae (Diagnose) on self. Grants Hardy talent.', talents: ['Hardy'] },
    },
  },
  {
    name: 'Biochemical Ogryn Neural Enhancement',
    availability: 'Very Rare (-30)',
    reference: '',
    defaultLocation: 'Neural',
    craftsmanship: {
      Poor:   { description: 'Ogryn only. Removes Cognitively Stunted trait; grants +1d5 Agility; allows a rank in Logic skill.' },
      Common: { description: 'Ogryn only. Removes Cognitively Stunted trait; +5 Agility; allows a rank in Logic skill.' },
      Good:   { description: 'Ogryn only. Removes Cognitively Stunted; +1d10 INT, +5 AG; grants Knowledge Aptitude; Logic and Scholastic Lore skills.' },
      Best:   { description: 'Ogryn only. As Good, but grants +1d5+5 Intelligence instead.' },
    },
  },
];

export const CYBERNETICS_BY_NAME = new Map<string, CyberneticTemplate>(
  CYBERNETICS_DATA.map(c => [c.name, c])
);
