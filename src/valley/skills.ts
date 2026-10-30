import { randomInt } from '../sim/rng'
import { deriveInventSeed } from './layout'
import { traitFactor } from './nature'
import type { Forager, IdeaEvent, SkillsEvent, Talents, TaskSeconds, ValleyConfig } from './types'

// Life 17's skills: experience built up over a working life and fading slowly, skill following it by the power law of
// practice, talent as how fast a person learns; the ideas of axe techniques a person may try, thought of while working
// or seen in an axe bought, the techniques known once an attempt by one has worked, and the practice of free time.

export const SECONDS_PER_HOUR = 3_600

export const noTaskSeconds = (): TaskSeconds => ({ forage: 0, gather: 0, make: 0 })

/** Experience slots: foraging, wood, then each technique in order from `TECHNIQUE`. */
export const FORAGE = 0
export const WOOD = 1
export const TECHNIQUE = 2

const TECHNIQUE_NAMES = ['flaked', 'tranchet', 'ground'] as const

export const knows = (person: Pick<Forager, 'known'>, technique: number) => ((person.known >> technique) & 1) === 1

export const hasIdea = (person: Pick<Forager, 'ideas'>, technique: number) => ((person.ideas >> technique) & 1) === 1

/** Skill at `seconds` of experience: the floor with none, half way at `halfHours`, rising towards the ceiling. */
export const skillOf = (config: ValleyConfig, seconds: number, halfHours: number) =>
  config.skillFloorPercent +
  Math.floor(
    ((config.skillCeilingPercent - config.skillFloorPercent) * seconds) / (seconds + SECONDS_PER_HOUR * halfHours),
  )

/** General craft: the experience in every technique together. */
export const generalCraft = (experience: readonly number[]) =>
  experience.slice(TECHNIQUE).reduce((total, seconds) => total + seconds, 0)

/** Proficiency in technique `technique`: its own experience plus a share of the experience in every other. */
export function proficiencyOf(config: ValleyConfig, experience: readonly number[], technique: number) {
  const own = experience[TECHNIQUE + technique]!
  const others = generalCraft(experience) - own
  return skillOf(config, own + Math.floor((config.transferPerMille * others) / 1_000), config.craftHalfHours)
}

/** The skills, proficiencies and hourly rates that follow from experience and the techniques a person has the idea of. */
export function skillsOf(config: ValleyConfig, experience: readonly number[], ideas: number) {
  const forageSkill = skillOf(config, experience[FORAGE]!, config.forageHalfHours)
  const woodSkill = skillOf(config, experience[WOOD]!, config.woodHalfHours)
  const forage = (base: number) => Math.floor((base * forageSkill) / 100)
  return {
    forageSkill,
    woodSkill,
    craftSkill: skillOf(config, generalCraft(experience), config.craftHalfHours),
    proficiency: config.axeTechniques.map((_, technique) =>
      hasIdea({ ideas }, technique) ? proficiencyOf(config, experience, technique) : 0,
    ),
    forageRate: forage(config.berryKcalPerHour),
    nutRate: forage(config.nutKcalPerHour),
    fishRate: forage(config.fishKcalPerHour),
    woodRate: Math.floor((config.woodPerHour * woodSkill) / 100),
  }
}

/** The experience a second of work gives at each talent, per mille. */
export const learnOf = (config: ValleyConfig, talents: Talents): Talents => ({
  forage: traitFactor(config.talentRule, talents.forage),
  wood: traitFactor(config.talentRule, talents.wood),
  craft: traitFactor(config.talentRule, talents.craft),
})

/** The share of experience lost each midnight, per million: half in `experienceHalfYears` years. */
export const fadePerMillion = (config: ValleyConfig) =>
  Math.round(693_147 / (config.experienceHalfYears * config.daysPerYear))

/** The talent that slot `slot` learns at. */
const learnAt = (learn: Talents, slot: number) =>
  slot === FORAGE ? learn.forage : slot === WOOD ? learn.wood : learn.craft

/**
 * A midnight for one person's experience: each slot fades, then gains the day's seconds of work, year-anchored and
 * scaled by talent, with the fractions carried in the remainders. Pure.
 */
export function experienceDay(
  config: ValleyConfig,
  before: Pick<Forager, 'experience' | 'fadeRemainder' | 'gainRemainder'>,
  worked: readonly number[],
  learn: Talents,
) {
  const perMillion = fadePerMillion(config)
  const divisor = config.daysPerYear * 1_000
  const experience: number[] = [],
    fadeRemainder: number[] = [],
    gainRemainder: number[] = []
  before.experience.forEach((seconds, slot) => {
    const fading = seconds * perMillion + before.fadeRemainder[slot]!
    const faded = seconds - Math.floor(fading / 1_000_000)
    const gaining = worked[slot]! * 365 * learnAt(learn, slot) + before.gainRemainder[slot]!
    experience.push(faded + Math.floor(gaining / divisor))
    fadeRemainder.push(fading % 1_000_000)
    gainRemainder.push(gaining % divisor)
  })
  return { experience, fadeRemainder, gainRemainder }
}

/** A founder's experience: fifteen years behind them at their own talent, and the techniques they know. */
export function founderExperience(config: ValleyConfig, learn: Talents, known: number) {
  const hours = (value: number, perMille: number) => Math.floor((value * SECONDS_PER_HOUR * perMille) / 1_000)
  const experience = [
    hours(config.founderForageHours, learn.forage),
    hours(config.founderWoodHours, learn.wood),
    ...config.axeTechniques.map((_, technique) =>
      knows({ known }, technique) ? hours(config.founderCraftHours, learn.craft) : 0,
    ),
  ]
  return {
    experience,
    fadeRemainder: experience.map(() => 0),
    gainRemainder: experience.map(() => 0),
  }
}

/** A founder's talents, experience, techniques and the skills that follow, as at creation. */
export function founderSkills(config: ValleyConfig, talents: Talents, known: number) {
  const learn = learnOf(config, talents)
  const start = founderExperience(config, learn, known)
  return {
    talents,
    learn,
    ...start,
    ideas: known,
    known,
    practicedToday: 0,
    ...skillsOf(config, start.experience, known),
    craftToday: config.axeTechniques.map(() => 0),
  }
}

/** The seconds a person worked today, by experience slot. */
export const workedToday = (person: Forager) => [
  person.secondsToday.forage,
  person.secondsToday.gather,
  ...person.craftToday,
]

/** Sets a person's skills, proficiencies and rates. Changes the working copy in place. */
export function applySkills(person: Forager, skills: ReturnType<typeof skillsOf>) {
  person.forageSkill = skills.forageSkill
  person.woodSkill = skills.woodSkill
  person.craftSkill = skills.craftSkill
  person.proficiency = skills.proficiency
  person.forageRate = skills.forageRate
  person.nutRate = skills.nutRate
  person.fishRate = skills.fishRate
  person.woodRate = skills.woodRate
}

/**
 * Midnight for one living person: experience fades and gains the day's work, skills are set for the new day, and the
 * day's practice is cleared.
 */
export function skillDay(config: ValleyConfig, person: Forager, minute: number): SkillsEvent {
  const worked = workedToday(person)
  const experienceBefore = person.experience
  const next = experienceDay(config, person, worked, person.learn)
  const skills = skillsOf(config, next.experience, person.ideas)
  person.experience = next.experience
  person.fadeRemainder = next.fadeRemainder
  person.gainRemainder = next.gainRemainder
  applySkills(person, skills)
  person.secondsToday = noTaskSeconds()
  person.craftToday = config.axeTechniques.map(() => 0)
  person.practicedToday = 0
  return {
    kind: 'skills',
    minute,
    foragerId: person.id,
    worked,
    experienceBefore: [...experienceBefore],
    experience: [...next.experience],
    forageSkill: skills.forageSkill,
    woodSkill: skills.woodSkill,
    craftSkill: skills.craftSkill,
    proficiency: [...skills.proficiency],
    forageRate: skills.forageRate,
    nutRate: skills.nutRate,
    fishRate: skills.fishRate,
    woodRate: skills.woodRate,
  }
}

/** The chance an attempt at proficiency `proficiency` works, per mille: half at `attemptHalfPercent` above the floor. */
export function successOf(config: ValleyConfig, proficiency: number) {
  const d = Math.max(0, proficiency - config.skillFloorPercent)
  return Math.floor((1_000 * d * d) / (d * d + config.attemptHalfPercent * config.attemptHalfPercent))
}

/** A person gains the idea of a technique: its proficiency is set from their experience. Changes it in place. */
export function gainIdea(config: ValleyConfig, person: Forager, technique: number) {
  person.ideas |= 1 << technique
  person.proficiency = person.proficiency.map((value, t) =>
    t === technique ? proficiencyOf(config, person.experience, technique) : value,
  )
}

/** Whether a person could think of a technique: they have no idea of it yet, and know what it needs. */
export function thinkable(config: ValleyConfig, person: Pick<Forager, 'ideas' | 'known'>, technique: number) {
  const needs = config.axeTechniques[technique]!.needs
  return !hasIdea(person, technique) && (needs < 0 || knows(person, needs))
}

/** The chance per million of an idea after `seconds` of axe work, year-anchored, at the person's openness. */
export const inventChance = (config: ValleyConfig, person: Pick<Forager, 'opennessInvent'>, seconds: number) =>
  Math.min(
    1_000_000,
    Math.floor(
      (seconds * config.inventPerMillionPerHour * 365 * person.opennessInvent) /
        (SECONDS_PER_HOUR * config.daysPerYear * 1_000),
    ),
  )

/**
 * The end of a stint of `seconds` of axe work: one draw from the invent stream for each technique the person could
 * think of, in order, gaining its idea below the chance. Changes the working copy in place; returns the ideas.
 */
export function inventAfter(config: ValleyConfig, person: Forager, seconds: number, minute: number): IdeaEvent[] {
  if (seconds <= 0) return []
  const chance = inventChance(config, person, seconds)
  let state = deriveInventSeed(config.seed, minute, person.id)
  const ideas: IdeaEvent[] = []
  config.axeTechniques.forEach((_, t) => {
    if (!thinkable(config, person, t)) return
    const draw = randomInt(state, 1_000_000)
    state = draw.state
    if (draw.value >= chance) return
    gainIdea(config, person, t)
    ideas.push({
      kind: 'idea',
      minute,
      foragerId: person.id,
      technique: t,
      how: 'invented',
      fromId: -1,
      seconds,
      chance,
      draw: draw.value,
    })
  })
  return ideas
}

/** The minutes a person practises a day when nothing is needed, at their conscientiousness. */
export const practiceBudget = (config: ValleyConfig, person: Pick<Forager, 'conscientiousnessPractice'>) =>
  Math.floor((config.practiceMinutesPerDay * person.conscientiousnessPractice) / 1_000)

/** Every way a person's talents, experience, techniques and skills disagree with each other. */
export function skillViolations(config: ValleyConfig, person: Forager): string[] {
  const errors: string[] = []
  const slots = TECHNIQUE + config.axeTechniques.length
  const counts = (values: readonly number[], length: number, below = Infinity) =>
    values.length === length && values.every((value) => Number.isSafeInteger(value) && value >= 0 && value < below)
  if (JSON.stringify(person.learn) !== JSON.stringify(learnOf(config, person.talents)))
    errors.push(`person ${person.id}: talent and learning differ`)
  if (
    !counts(person.experience, slots) ||
    !counts(person.fadeRemainder, slots, 1_000_000) ||
    !counts(person.gainRemainder, slots, config.daysPerYear * 1_000)
  )
    errors.push(`person ${person.id}: invalid experience`)
  const all = (1 << config.axeTechniques.length) - 1
  if (
    !Number.isSafeInteger(person.known) ||
    !Number.isSafeInteger(person.ideas) ||
    (person.ideas & ~all) !== 0 ||
    (person.known & ~person.ideas) !== 0 ||
    !knows(person, 0)
  )
    errors.push(`person ${person.id}: impossible ideas or techniques known`)
  if (
    !Number.isSafeInteger(person.practicedToday) ||
    person.practicedToday < 0 ||
    person.practicedToday > practiceBudget(config, person)
  )
    errors.push(`person ${person.id}: practised more than their budget`)
  const expected = skillsOf(config, person.experience, person.ideas)
  for (const key of Object.keys(expected) as (keyof typeof expected)[])
    if (JSON.stringify(expected[key]) !== JSON.stringify(person[key]))
      errors.push(`person ${person.id}: ${key} differs from experience`)
  if (
    !counts(person.craftToday, config.axeTechniques.length) ||
    person.craftToday.reduce((total, seconds) => total + seconds, 0) !== person.secondsToday.make
  )
    errors.push(`person ${person.id}: craft seconds differ from making seconds`)
  for (const technique of [person.making?.technique, person.axe?.technique, person.spareAxe?.technique])
    if (
      technique !== undefined &&
      !(Number.isSafeInteger(technique) && technique >= 0 && technique < config.axeTechniques.length)
    )
      errors.push(`person ${person.id}: an axe has no technique`)
  const making = person.making
  if (making && !hasIdea(person, making.technique))
    errors.push(`person ${person.id}: making an axe by a technique not among their ideas`)
  if (making && !knows(person, making.technique) && !making.practice)
    errors.push(`person ${person.id}: an untried technique attempted outside practice`)
  if (
    making &&
    !(
      making.worked >= 0 &&
      making.worked <= (making.breakAt >= 0 ? making.breakAt : making.needed) &&
      making.breakAt <= making.needed
    )
  )
    errors.push(`person ${person.id}: an axe in progress past its end`)
  return errors
}

/** Every rule the skill and technique settings break. */
export function skillConfigErrors(config: ValleyConfig): string[] {
  const errors: string[] = []
  const integer = (value: unknown) => Number.isSafeInteger(value)
  if (!(config.skillFloorPercent >= 1 && config.skillFloorPercent <= config.skillCeilingPercent))
    errors.push('Skills must satisfy 1 ≤ skillFloorPercent ≤ skillCeilingPercent')
  if (!(config.transferPerMille >= 0 && config.transferPerMille <= 1_000))
    errors.push('transferPerMille must be from 0 to 1,000')
  for (const key of ['founderForageHours', 'founderWoodHours', 'founderCraftHours'] as const)
    if (config[key] < 0) errors.push(`${key} must not be negative`)
  for (const key of ['founderTranchetPerMille', 'founderGroundPerMille'] as const)
    if (!(config[key] >= 0 && config[key] <= 1_000)) errors.push(`${key} must be from 0 to 1,000`)
  if (
    !(config.inventPerMillionPerHour >= 0) ||
    // A day of axe work at the most open must stay exact.
    !integer(86_400 * config.inventPerMillionPerHour * 365 * 3_000)
  )
    errors.push('inventPerMillionPerHour must be non-negative and keep a day of work exact')
  if (!(config.practiceMinutesPerDay >= 0 && config.practiceMinutesPerDay <= 1_440))
    errors.push('practiceMinutesPerDay must be from 0 to 1,440')
  const techniques = config.axeTechniques
  if (
    !Array.isArray(techniques) ||
    techniques.length !== TECHNIQUE_NAMES.length ||
    techniques.some(
      (technique, index) =>
        !technique ||
        technique.name !== TECHNIQUE_NAMES[index] ||
        !integer(technique.hours) ||
        technique.hours <= 0 ||
        !integer(technique.logs) ||
        technique.logs <= 0 ||
        !integer(technique.needs) ||
        technique.needs < -1 ||
        technique.needs >= index ||
        (index === 0 && technique.needs !== -1),
    )
  )
    errors.push('axeTechniques must be flaked, tranchet and ground in order, each needing an earlier one or none')
  const rule = config.talentRule
  if (
    !rule ||
    !['base', 'effect', 'low', 'high'].every((key) => integer(rule[key as keyof typeof rule])) ||
    rule.low < 1 ||
    rule.low > rule.high ||
    !integer(rule.effect * 3000)
  )
    errors.push('Invalid talentRule')
  else {
    // A hundred years of full days at the highest talent and the shortest year must stay exact.
    const lifetime = 100 * 365 * 86_400 * Math.ceil(rule.high / 1_000)
    const perMillion = Math.ceil(693_147 / Math.max(1, config.experienceHalfYears * 8))
    if (
      !integer(lifetime * perMillion + 1_000_000) ||
      !integer(lifetime * (config.skillCeilingPercent - config.skillFloorPercent)) ||
      !integer(86_400 * 365 * rule.high + 365_000)
    )
      errors.push('A lifetime of experience exceeds exact integer limits')
  }
  return errors
}
