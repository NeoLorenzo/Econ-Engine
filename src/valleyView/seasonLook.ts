import type { Color, MeshStandardMaterial } from 'three'

import { MINUTES_PER_DAY } from '../valley/calendar'
import type { ValleyConfig } from '../valley/types'

// How the year looks: the sun's path and the colour of leaves and grass. The observer alone draws this, from the
// displayed minute; the simulation's day still runs from `dawnHour` to `duskHour` all year.

type SkyConfig = Pick<ValleyConfig, 'daysPerYear' | 'dawnHour' | 'duskHour'>

/** The valley's latitude for the sun's path: 52° N, Mesolithic northern Europe (the North Sea plain, Star Carr). */
export const LATITUDE_DEG = 52
/** The tilt of the Earth's axis, the solar declination at the solstices. */
const TILT_DEG = 23.44
const RADIANS = Math.PI / 180

/**
 * The displayed moment's place in the year, 0 to 1, counted from the spring equinox: ¼ is the summer solstice, ½ the
 * autumn equinox, ¾ the winter solstice. The run starts at the spring equinox, the first day of the calendar's spring.
 * It moves smoothly through each day, so colours blend rather than step.
 */
export function yearFraction(config: Pick<ValleyConfig, 'daysPerYear'>, minute: number) {
  const days = minute / MINUTES_PER_DAY
  return (((days % config.daysPerYear) + config.daysPerYear) % config.daysPerYear) / config.daysPerYear
}

const smoothstep = (from: number, to: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/**
 * Where the sun stands at the displayed minute, from the solar declination for the day of the year at
 * {@link LATITUDE_DEG}: `δ = 23.44° · sin(2π · yearFraction)` and `sin(altitude) = sin φ sin δ + cos φ cos δ cos H`,
 * with the hour angle `H` zero at the middle of the simulation's day and π at its dawn and dusk hours, so at the
 * equinoxes the sun rises and sets on them. Days are about 16½ hours at the summer solstice and 7½ at the winter one.
 *
 * Returns the sun's direction as east, north and up components of a unit vector, and `light`: 0 at night, 1 in full
 * daylight, easing while the sun is within about 4° of the horizon.
 */
export function sunAt(config: SkyConfig, minute: number) {
  const fraction = yearFraction(config, minute)
  const declination = TILT_DEG * RADIANS * Math.sin(2 * Math.PI * fraction)
  const latitude = LATITUDE_DEG * RADIANS
  const hour = (((minute / 60) % 24) + 24) % 24
  const noon = (config.dawnHour + config.duskHour) / 2
  const hourAngle = ((hour - noon) / (config.duskHour - config.dawnHour)) * Math.PI
  const up =
    Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle)
  const east = -Math.cos(declination) * Math.sin(hourAngle)
  const north =
    Math.cos(latitude) * Math.sin(declination) - Math.sin(latitude) * Math.cos(declination) * Math.cos(hourAngle)
  /** 1 at the summer solstice, 0 at the winter one. */
  const summer = (Math.sin(2 * Math.PI * fraction) + 1) / 2
  return { up, east, north, light: smoothstep(-0.07, 0.07, up), summer }
}

/** Hours of daylight (sun above the horizon) on a day with this year fraction, at {@link LATITUDE_DEG}. */
export function dayLengthHours(config: Pick<ValleyConfig, 'dawnHour' | 'duskHour'>, fraction: number) {
  const declination = TILT_DEG * RADIANS * Math.sin(2 * Math.PI * fraction)
  const cosHalf = Math.min(1, Math.max(-1, -Math.tan(LATITUDE_DEG * RADIANS) * Math.tan(declination)))
  return ((2 * Math.acos(cosHalf)) / Math.PI) * (config.duskHour - config.dawnHour)
}

/** A plant's leaf colours through the year: fresh, summer, turning, fallen-brown and bare (its twigs or stems). */
export interface LeafPalette {
  fresh: number
  summer: number
  turning: number
  brown: number
  bare: number
  /** Its crown's size when bare, as a share of its full crown. */
  bareScale: number
}

/** Bilberry: fresh green, red in autumn, its green stems left in winter. */
export const BILBERRY: LeafPalette = {
  fresh: 0x5f9a45,
  summer: 0x2f7a3c,
  turning: 0xa8402e,
  brown: 0x7a4a30,
  bare: 0x55603e,
  bareScale: 0.7,
}
/** Hazel: yellow in autumn, grey-brown twigs in winter. */
export const HAZEL: LeafPalette = {
  fresh: 0x86b84d,
  summer: 0x4c8a35,
  turning: 0xc9a83a,
  brown: 0x9a6a2e,
  bare: 0x6b5a48,
  bareScale: 0.45,
}
/** Birch: bright yellow in autumn, grey-white twigs in winter. */
export const BIRCH: LeafPalette = {
  fresh: 0x8cbf55,
  summer: 0x4f8a3a,
  turning: 0xd4b23a,
  brown: 0x9a7a40,
  bare: 0x857c74,
  bareScale: 0.45,
}

type Stage = keyof Omit<LeafPalette, 'bareScale'>
/**
 * The deciduous year, by year fraction from the spring equinox: the stage the leaves are at, and how much of the crown
 * is in leaf. Leaves open through April and May, stay green through summer, turn from mid-September, fall through
 * October and November, and the crowns are bare from late November to early April.
 */
const LEAF_YEAR: [number, Stage, number][] = [
  [0.04, 'bare', 0],
  [0.1, 'fresh', 0.6],
  [0.16, 'fresh', 1],
  [0.27, 'summer', 1],
  [0.46, 'summer', 1],
  [0.56, 'turning', 1],
  [0.64, 'brown', 0.55],
  [0.72, 'bare', 0],
]

const channels = (rgb: number) => [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255] as const

/** A deciduous plant's leaf colour (as 0xRRGGBB) and crown scale on a day with this year fraction. */
export function foliageAt(palette: LeafPalette, fraction: number) {
  const keys = LEAF_YEAR
  let next = keys.findIndex(([at]) => at > fraction)
  if (next < 0) next = 0
  const previous = (next - 1 + keys.length) % keys.length
  const [fromAt, fromStage, fromCover] = keys[previous]!
  const [toAt, toStage, toCover] = keys[next]!
  const span = (toAt - fromAt + 1) % 1 || 1
  const t = smoothstep(0, 1, ((fraction - fromAt + 1) % 1) / span)
  const from = channels(palette[fromStage])
  const to = channels(palette[toStage])
  const mixed = from.map((value, index) => Math.round(value + (to[index]! - value) * t))
  const cover = fromCover + (toCover - fromCover) * t
  return {
    colour: (mixed[0]! << 16) | (mixed[1]! << 8) | mixed[2]!,
    cover,
    scale: palette.bareScale + (1 - palette.bareScale) * cover,
  }
}

/**
 * How the grass is tinted, as red, green and blue multipliers of its colour: greener in spring, as drawn in summer,
 * duller and browner from late autumn through winter.
 */
export function grassTint(fraction: number): [number, number, number] {
  const leaf = foliageAt(HAZEL, fraction).cover
  // Spring flush peaks a little after the leaves open, and fades by midsummer.
  const flush = smoothstep(0.04, 0.14, fraction) * (1 - smoothstep(0.2, 0.32, fraction))
  const dull = 1 - leaf
  return [1 - 0.06 * flush + 0.06 * dull, 1 + 0.1 * flush - 0.12 * dull, 1 - 0.08 * flush - 0.12 * dull]
}

/** The uniforms one deciduous material's shader reads: its leaf colour and its crown scale. */
export interface FoliageUniforms {
  colour: { value: Color }
  scale: { value: number }
}

/**
 * Makes a material's colour and size follow the season without touching its instances: its colour becomes the leaf
 * colour uniform, and each instance's crown shrinks about its centre by the scale uniform, across fully and upwards by
 * `upShare` of that. With `evergreen`, only instances whose instance colour's red channel is 1 are deciduous; those at
 * 0 keep the evergreen colour and size, so pines and birches can share one mesh. The depth material used for shadows
 * shrinks the same way.
 */
export function seasonalFoliage(
  THREE: typeof import('three'),
  material: MeshStandardMaterial,
  uniforms: FoliageUniforms,
  upShare: number,
  evergreen?: Color,
) {
  const key = `foliage-${upShare}-${evergreen ? 'mixed' : 'all'}`
  const deciduous = evergreen ? '(instanceColor.r)' : '1.0'
  const shrink = `
    #if ${evergreen ? 'defined( USE_INSTANCING_COLOR )' : '1'}
    float leafScale = mix(1.0, uLeafScale, ${deciduous});
    transformed.xz *= leafScale;
    transformed.y *= mix(1.0, leafScale, ${upShare.toFixed(3)});
    #endif`
  const patchVertex = (shader: { vertexShader: string; uniforms: Record<string, { value: unknown }> }) => {
    shader.uniforms.uLeafScale = uniforms.scale
    shader.vertexShader =
      'uniform float uLeafScale;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${shrink}`)
  }
  material.onBeforeCompile = (shader) => {
    patchVertex(shader)
    shader.uniforms.uLeafColour = uniforms.colour
    if (evergreen) shader.uniforms.uEvergreen = { value: evergreen }
    shader.fragmentShader =
      `uniform vec3 uLeafColour;\n${evergreen ? 'uniform vec3 uEvergreen;\n' : ''}` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        evergreen
          ? '#if defined( USE_COLOR )\ndiffuseColor.rgb = mix(uEvergreen, uLeafColour, vColor.r);\n#endif'
          : 'diffuseColor.rgb = uLeafColour;',
      )
  }
  material.customProgramCacheKey = () => key
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  depth.onBeforeCompile = patchVertex
  depth.customProgramCacheKey = () => `${key}-depth`
  return depth
}
