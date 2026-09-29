import * as THREE from 'three'
import { chestWidthScale, heightScale } from './fit'

/**
 * One continuous mannequin (single BufferGeometry). No box primitives.
 * Height scales Y. Weight scales chest and waist width (and depth with it).
 * Authored at 175 cm / 70 kg.
 */

const SEG = 24

type Ring = {
  y: number
  rx: number
  rz: number
  cx: number
  cz: number
  inf: number
}

function torsoInfluence(y: number) {
  const chest = Math.exp(-((y - 1.32) ** 2) / (2 * 0.11 ** 2))
  const waist = Math.exp(-((y - 1.05) ** 2) / (2 * 0.075 ** 2))
  return Math.min(1, Math.max(chest, waist))
}

function buildTube(rings: Ring[]) {
  const ringCount = rings.length
  const vertCount = ringCount * SEG + 2
  const positions = new Float32Array(vertCount * 3)
  const inf = new Float32Array(vertCount)

  rings.forEach((ring, r) => {
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2
      const vi = r * SEG + i
      positions[vi * 3] = ring.cx + Math.cos(a) * ring.rx
      positions[vi * 3 + 1] = ring.y
      positions[vi * 3 + 2] = ring.cz + Math.sin(a) * ring.rz
      inf[vi] = ring.inf
    }
  })

  const topCenter = ringCount * SEG
  const botCenter = topCenter + 1
  const top = rings[ringCount - 1]
  const bot = rings[0]
  positions[topCenter * 3] = top.cx
  positions[topCenter * 3 + 1] = top.y
  positions[topCenter * 3 + 2] = top.cz
  inf[topCenter] = top.inf
  positions[botCenter * 3] = bot.cx
  positions[botCenter * 3 + 1] = bot.y
  positions[botCenter * 3 + 2] = bot.cz
  inf[botCenter] = bot.inf

  const idx: number[] = []
  for (let r = 0; r < ringCount - 1; r++) {
    for (let i = 0; i < SEG; i++) {
      const i2 = (i + 1) % SEG
      const a = r * SEG + i
      const b = r * SEG + i2
      const c = (r + 1) * SEG + i
      const d = (r + 1) * SEG + i2
      idx.push(a, c, b, b, c, d)
    }
  }
  for (let i = 0; i < SEG; i++) {
    idx.push(botCenter, (i + 1) % SEG, i)
  }
  const topRing = (ringCount - 1) * SEG
  for (let i = 0; i < SEG; i++) {
    idx.push(topCenter, topRing + i, topRing + (i + 1) % SEG)
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geom.setIndex(idx)
  return { geom, inf }
}

function torsoRings(): Ring[] {
  const samples: [number, number, number][] = [
    [0.9, 0.125, 0.095],
    [0.98, 0.15, 0.105],
    [1.06, 0.128, 0.09],
    [1.16, 0.155, 0.105],
    [1.26, 0.178, 0.118],
    [1.36, 0.198, 0.125],
    [1.44, 0.16, 0.105],
    [1.5, 0.068, 0.062],
    [1.56, 0.092, 0.086],
    [1.64, 0.112, 0.104],
    [1.71, 0.078, 0.072],
    [1.76, 0.028, 0.026],
  ]
  return samples.map(([y, rx, rz]) => ({
    y,
    rx,
    rz,
    cx: 0,
    cz: 0,
    inf: torsoInfluence(y),
  }))
}

function legRings(side: number): Ring[] {
  const samples: [number, number][] = [
    [0.02, 0.04],
    [0.1, 0.045],
    [0.28, 0.06],
    [0.46, 0.05],
    [0.64, 0.072],
    [0.82, 0.086],
    [0.96, 0.09],
  ]
  return samples.map(([y, r]) => ({
    y,
    rx: r,
    rz: r * 0.92,
    cx: side * 0.09,
    cz: 0.01,
    inf: 0,
  }))
}

function armRings(side: number): Ring[] {
  const steps = 8
  const shoulderInf = torsoInfluence(1.38)
  const rings: Ring[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const y = 1.38 - 0.5 * t
    const x = side * (0.2 + 0.27 * t)
    const z = 0.03 + 0.05 * t
    const radius = 0.052 - 0.022 * t
    rings.push({
      y,
      rx: radius,
      rz: radius * 0.9,
      cx: x,
      cz: z,
      inf: shoulderInf * (1 - t) * (1 - t),
    })
  }
  return rings
}

function mergeParts(parts: { geom: THREE.BufferGeometry; inf: Float32Array }[]) {
  let vertCount = 0
  let indexCount = 0
  for (const part of parts) {
    vertCount += part.geom.getAttribute('position').count
    indexCount += part.geom.getIndex()?.count ?? 0
  }
  const positions = new Float32Array(vertCount * 3)
  const influence = new Float32Array(vertCount)
  const index = new Uint32Array(indexCount)
  let vOff = 0
  let iOff = 0
  for (const part of parts) {
    const pos = part.geom.getAttribute('position').array as Float32Array
    positions.set(pos, vOff * 3)
    influence.set(part.inf, vOff)
    const idx = part.geom.getIndex()
    if (!idx) throw new Error('body tube missing index')
    for (let i = 0; i < idx.count; i++) index[iOff + i] = idx.getX(i) + vOff
    iOff += idx.count
    vOff += pos.length / 3
    part.geom.dispose()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(index, 1))
  geometry.computeVertexNormals()
  geometry.userData.base = new Float32Array(positions)
  geometry.userData.influence = influence
  geometry.name = 'EstimatedBody'
  return geometry
}

export function createBodyGeometry() {
  return mergeParts([
    buildTube(torsoRings()),
    buildTube(legRings(-1)),
    buildTube(legRings(1)),
    buildTube(armRings(-1)),
    buildTube(armRings(1)),
  ])
}

export function applyBodyScale(geometry: THREE.BufferGeometry, heightCm: number, weightKg: number) {
  const base = geometry.userData.base as Float32Array
  const influence = geometry.userData.influence as Float32Array
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const arr = pos.array as Float32Array
  const hs = heightScale(heightCm)
  const ws = chestWidthScale(weightKg)
  for (let i = 0; i < influence.length; i++) {
    const factor = 1 + (ws - 1) * influence[i]
    arr[i * 3] = base[i * 3] * factor
    arr[i * 3 + 1] = base[i * 3 + 1] * hs
    arr[i * 3 + 2] = base[i * 3 + 2] * factor
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
}

export function shirtMountTransform(heightCm: number, weightKg: number) {
  const hs = heightScale(heightCm)
  const ws = chestWidthScale(weightKg)
  const factor = 1 + (ws - 1) * torsoInfluence(1.3)
  return {
    position: [0, 1.3 * hs, 0.12 * factor + 0.03] as [number, number, number],
    width: 0.34 * factor,
    height: 0.26 * hs,
  }
}
