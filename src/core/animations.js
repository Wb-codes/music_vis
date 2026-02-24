/**
 * @module core/animations
 * @description Animation name mappings for the skinning scene.
 * Converts between clean display names and full GLB animation names.
 */

/**
 * Animation data from ANIMATION_LIST.md
 * Format: { cleanName: fullName }
 * fullName format: VRM|Name@frameCount
 */
export const ANIMATION_MAP = {
  'Action': 'VRM|Action@48',
  'Angry': 'VRM|Angry@20',
  'Consume Item': 'VRM|Consume Item@100',
  'Crawl': 'VRM|Crawl@41',
  'CrouchFwdLoop': 'VRM|CrouchFwdLoop@48',
  'CrouchIdleLoop': 'VRM|CrouchIdleLoop@70',
  'DanceBodyRoll': 'VRM|DanceBodyRoll@156',
  'DanceCharleston': 'VRM|DanceCharleston@56',
  'DanceLoop': 'VRM|DanceLoop@24',
  'DanceReachHip': 'VRM|DanceReachHip@61',
  'Death': 'VRM|Death@57',
  'DrivingLoop': 'VRM|DrivingLoop@57',
  'FixingKneeling': 'VRM|FixingKneeling@124',
  'HeadNod': 'VRM|HeadNod@21',
  'HitChest': 'VRM|HitChest@8',
  'HitHead': 'VRM|HitHead@10',
  'IdleListening': 'VRM|IdleListening@41',
  'IdleLoop': 'VRM|IdleLoop@60',
  'IdleTalkingLoop': 'VRM|IdleTalkingLoop@70',
  'JogFwdLoop': 'VRM|JogFwdLoop@22',
  'JumpLand': 'VRM|JumpLand@30',
  'JumpLoop': 'VRM|JumpLoop@60',
  'JumpStart': 'VRM|JumpStart@32',
  'Meditate': 'VRM|Meditate@36',
  'PickUpTable': 'VRM|PickUpTable@20',
  'PistolAimDown': 'VRM|PistolAimDown@4',
  'PistolAimNeutral': 'VRM|PistolAimNeutral@4',
  'PistolAimUp': 'VRM|PistolAimUp@4',
  'PistolIdleLoop': 'VRM|PistolIdleLoop@40',
  'PistolReload': 'VRM|PistolReload@40',
  'PistolShoot': 'VRM|PistolShoot@15',
  'PunchCross': 'VRM|PunchCross@24',
  'PunchEnter': 'VRM|PunchEnter@20',
  'PunchJab': 'VRM|PunchJab@20',
  'Reject': 'VRM|Reject@91',
  'Roll': 'VRM|Roll@35',
  'RunAnime': 'VRM|RunAnime@13',
  'Shivering': 'VRM|Shivering@6',
  'SittingEnter': 'VRM|SittingEnter@31',
  'SittingExit': 'VRM|SittingExit@24',
  'SittingIdleLoop': 'VRM|SittingIdleLoop@40',
  'SittingTalkingLoop': 'VRM|SittingTalkingLoop@70',
  'SpellSimpleEnter': 'VRM|SpellSimpleEnter@12',
  'SpellSimpleExit': 'VRM|SpellSimpleExit@10',
  'SpellSimpleIdleLoop': 'VRM|SpellSimpleIdleLoop@50',
  'SpellSimpleShoot': 'VRM|SpellSimpleShoot@12',
  'SprintLoop': 'VRM|SprintLoop@16',
  'SwimFwdLoop': 'VRM|SwimFwdLoop@80',
  'SwimIdleLoop': 'VRM|SwimIdleLoop@80',
  'SwordAttack': 'VRM|SwordAttack@36',
  'SwordIdle': 'VRM|SwordIdle@40',
  'Tired': 'VRM|Tired@32',
  'TiredHunched': 'VRM|TiredHunched@25',
  'TwohandBlast': 'VRM|TwohandBlast@11',
  'Victory': 'VRM|Victory@40',
  'WalkFormalLoop': 'VRM|WalkFormalLoop@32',
  'WalkLoop': 'VRM|WalkLoop@32'
};

/**
 * Array of clean animation names for dropdown options
 * @type {string[]}
 */
export const ANIMATION_NAMES = Object.keys(ANIMATION_MAP);

/**
 * Default animation name
 * @type {string}
 */
export const DEFAULT_ANIMATION = 'DanceLoop';

/**
 * Get the full GLB animation name from a clean name
 * @param {string} cleanName - Clean animation name (e.g., 'DanceLoop')
 * @returns {string|null} Full animation name (e.g., 'VRM|DanceLoop@24') or null if not found
 */
export function getFullAnimationName(cleanName) {
  return ANIMATION_MAP[cleanName] || null;
}

/**
 * Get the clean animation name from a full GLB animation name
 * @param {string} fullName - Full animation name (e.g., 'VRM|DanceLoop@24')
 * @returns {string|null} Clean animation name (e.g., 'DanceLoop') or null if not found
 */
export function getCleanAnimationName(fullName) {
  const entry = Object.entries(ANIMATION_MAP).find(([_, full]) => full === fullName);
  return entry ? entry[0] : null;
}
