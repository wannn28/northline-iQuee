import { Component, Suspense, use, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { chestWidthScale, heightScale } from '../lib/fit'
import { LENGTH_MAX, LENGTH_MIN, type Garment } from '../lib/shell'

const FRAME_URL = '/models/frame.glb'
// CC0 male base mesh (male_base_mesh.glb from BoQsc/Godot-3D-Male-Base-Mesh 1.0.2).
const BODY_URL = '/models/body.glb'

useGLTF.preload(FRAME_URL)
useGLTF.preload(BODY_URL)

export type BodyMotion = 'diam' | 'putar' | 'jalan'
export type { Garment } from '../lib/shell'

type StageProps = {
  kind: 'poster' | 'tee'
  handle: string
  heightCm?: number
  weightKg?: number
  color?: string
  motion?: BodyMotion
  garment?: Garment
  lengthCm?: number
  shellOn?: boolean
  frontUrl?: string | null
  backUrl?: string | null
}

const GARMENTS: Garment[] = ['short', 'long', 'button', 'sleeveless']
const X_AXIS = new THREE.Vector3(1, 0, 0)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const _qa = new THREE.Quaternion()
const _qb = new THREE.Quaternion()
const TORSO_BONES = new Set(['spine001', 'spine002', 'spine003', 'shoulderL', 'shoulderR'])
const SHELL_OFFSET = 0.014
const SLEEVE_T = 0.46
const NECK_Y = 0.7
const COLLAR_Y = 0.645
const WAIST_HEM = 0.169
const THIGH_HEM = -0.12
const FRONT_NX = 0.22
const LOWER_BONES = new Set(['spine', 'pelvisL', 'pelvisR', 'thighL', 'thighR'])

/** 80 cm is collar y=0.645 to the waist ring y=0.170. Longer lengths use that same ruler. */
const CM_PER_UNIT = LENGTH_MIN / (COLLAR_Y - WAIST_HEM)

function hemYForLength(lengthCm: number) {
  const cm = Math.min(LENGTH_MAX, Math.max(LENGTH_MIN, lengthCm))
  const hem = COLLAR_Y - cm / CM_PER_UNIT
  return Math.min(WAIST_HEM, Math.max(THIGH_HEM, hem))
}

const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
WHITE.colorSpace = THREE.SRGBColorSpace
WHITE.needsUpdate = true

class StageBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; resetKey: string },
  { failed: boolean; resetKey: string }
> {
  state = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  static getDerivedStateFromProps(
    props: { resetKey: string },
    state: { failed: boolean; resetKey: string },
  ) {
    if (props.resetKey !== state.resetKey) return { failed: false, resetKey: props.resetKey }
    return null
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function cloneWithMaterials(scene: THREE.Object3D) {
  const clone = scene.clone(true)
  clone.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const material = obj.material
      obj.material = Array.isArray(material) ? material.map((item) => item.clone()) : material.clone()
    }
  })
  return clone
}

function quatDelta(bone: THREE.Bone, axis: THREE.Vector3, angle: number) {
  const q = bone.quaternion.clone()
  q.multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle))
  return q.normalize()
}

function quatTrack(bone: THREE.Bone, times: number[], angles: number[], axis: THREE.Vector3) {
  const values: number[] = []
  for (const angle of angles) {
    const q = quatDelta(bone, axis, angle)
    values.push(q.x, q.y, q.z, q.w)
  }
  return new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values)
}

/** Rotation clips only. Missing bones are skipped. No scale and no visibility tracks. */
function poseClips(skinned: THREE.SkinnedMesh) {
  const bone = (name: string) => skinned.skeleton.getBoneByName(name)
  const diam: THREE.KeyframeTrack[] = []
  const putar: THREE.KeyframeTrack[] = []
  const jalan: THREE.KeyframeTrack[] = []
  const chest = bone('spine003')
  const ribs = bone('spine002')
  const hips = bone('spine')
  if (chest) diam.push(quatTrack(chest, [0, 1.3, 2.6], [0, 0.09, 0], X_AXIS))
  if (ribs) diam.push(quatTrack(ribs, [0, 1.3, 2.6], [0, 0.035, 0], X_AXIS))
  if (hips) putar.push(quatTrack(hips, [0, 1, 2, 3, 4], [0, 0.5, 0, -0.5, 0], Y_AXIS))
  const leg = (name: string, times: number[], angles: number[]) => {
    const found = bone(name)
    if (found) jalan.push(quatTrack(found, times, angles, X_AXIS))
  }
  leg('thighL', [0, 0.6, 1.2], [-0.55, 0.4, -0.55])
  leg('thighR', [0, 0.6, 1.2], [0.4, -0.55, 0.4])
  leg('shinL', [0, 0.6, 1.2], [0.55, 0.12, 0.55])
  leg('shinR', [0, 0.6, 1.2], [0.12, 0.55, 0.12])
  return [
    new THREE.AnimationClip('diam', 2.6, diam),
    new THREE.AnimationClip('putar', 4, putar),
    new THREE.AnimationClip('jalan', 1.2, jalan),
  ]
}

type ClipSample = { boneName: string; times: Float32Array; values: Float32Array }

function samplesFor(clip: THREE.AnimationClip): ClipSample[] {
  return clip.tracks.map((track) => {
    if (!(track instanceof THREE.QuaternionKeyframeTrack)) throw new Error('clips may only rotate bones')
    return {
      boneName: track.name.replace(/\.quaternion$/, ''),
      times: track.times,
      values: track.values as Float32Array,
    }
  })
}

function sampleQuaternion(times: Float32Array, values: Float32Array, time: number, target: THREE.Quaternion) {
  if (!times.length) return false
  let index = 0
  const last = times.length - 1
  while (index < last && times[index + 1] < time) index += 1
  const next = Math.min(index + 1, last)
  const span = times[next] - times[index]
  const alpha = span <= 1e-8 ? 0 : Math.min(1, Math.max(0, (time - times[index]) / span))
  _qa.fromArray(values, index * 4)
  _qb.fromArray(values, next * 4)
  target.copy(_qa).slerp(_qb, alpha)
  if (!Number.isFinite(target.x) || target.lengthSq() < 1e-8) return false
  target.normalize()
  return true
}

function dominantBone(names: string[], skinIndex: THREE.BufferAttribute, skinWeight: THREE.BufferAttribute, vertex: number) {
  let best = 0
  let weight = -1
  for (let slot = 0; slot < 4; slot += 1) {
    const influence = skinWeight.getComponent(vertex, slot)
    if (influence > weight) {
      weight = influence
      best = skinIndex.getComponent(vertex, slot)
    }
  }
  return names[best] ?? ''
}

type ArmFrame = {
  origin: THREE.Vector3
  elbow: THREE.Vector3
  axis: THREE.Vector3
  length: number
  side: THREE.Vector3
  bin: THREE.Vector3
}

function makeArm(mesh: THREE.SkinnedMesh, side: 'L' | 'R'): ArmFrame {
  const upper = mesh.skeleton.getBoneByName(`upper_arm${side}`)
  const fore = mesh.skeleton.getBoneByName(`forearm${side}`)
  const hand = mesh.skeleton.getBoneByName(`hand${side}`)
  if (!upper || !fore) throw new Error('arm bones missing')
  const origin = new THREE.Vector3().setFromMatrixPosition(upper.matrixWorld)
  const elbow = new THREE.Vector3().setFromMatrixPosition(fore.matrixWorld)
  const wrist = hand ? new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld) : elbow.clone()
  const axis = wrist.clone().sub(origin)
  const length = Math.max(1e-4, axis.length())
  axis.multiplyScalar(1 / length)
  const up = Math.abs(axis.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const sideAxis = new THREE.Vector3().crossVectors(axis, up).normalize()
  const bin = new THREE.Vector3().crossVectors(sideAxis, axis).normalize()
  return { origin, elbow, axis, length, side: sideAxis, bin }
}

type ShellVert = {
  x: number
  y: number
  z: number
  nx: number
  ny: number
  nz: number
  skinI: number[]
  skinW: number[]
  sleeve: boolean
  arm: 'L' | 'R'
  region: number
  u: number
  v: number
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

/**
 * Skinned garment carved from the CC0 body. One shell per style, same skeleton.
 * UVs: front image on the front, back image on the back, sides stay untextured.
 */
function buildGarment(mesh: THREE.SkinnedMesh, garment: Garment, hemY: number) {
  const source = mesh.geometry
  const position = source.getAttribute('position') as THREE.BufferAttribute
  const normal = source.getAttribute('normal') as THREE.BufferAttribute
  const skinIndex = source.getAttribute('skinIndex') as THREE.BufferAttribute
  const skinWeight = source.getAttribute('skinWeight') as THREE.BufferAttribute
  const index = source.getIndex()
  if (!position || !normal || !skinIndex || !skinWeight || !index) throw new Error('body attributes missing')

  mesh.skeleton.update()
  const arms = { L: makeArm(mesh, 'L'), R: makeArm(mesh, 'R') }
  const point = new THREE.Vector3()
  const along = new THREE.Vector3()
  const sleeveT = (x: number, y: number, z: number) => {
    const side = z < 0 ? 'L' : 'R'
    const { origin, elbow } = arms[side]
    along.copy(elbow).sub(origin)
    point.set(x, y, z).sub(origin)
    return point.dot(along) / Math.max(1e-6, along.lengthSq())
  }
  const wristT = (side: 'L' | 'R', x: number, y: number, z: number) => {
    const frame = arms[side]
    point.set(x, y, z).sub(frame.origin)
    return point.dot(frame.axis) / frame.length
  }
  const aroundArm = (side: 'L' | 'R', x: number, y: number, z: number) => {
    const frame = arms[side]
    point.set(x, y, z).sub(frame.origin)
    const a = point.dot(frame.side)
    const b = point.dot(frame.bin)
    return (Math.atan2(b, a) / (Math.PI * 2) + 1) % 1
  }

  const names = mesh.skeleton.bones.map((bone) => bone.name)
  const keep = new Uint8Array(position.count)
  const longArm = garment === 'long' || garment === 'button'
  const sleeveless = garment === 'sleeveless'
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const bone = dominantBone(names, skinIndex, skinWeight, vertex)
    const y = position.getY(vertex)
    if (y >= NECK_Y || y <= hemY) continue
    if (TORSO_BONES.has(bone) || LOWER_BONES.has(bone)) {
      keep[vertex] = 1
      continue
    }
    if (sleeveless) continue
    if (bone === 'upper_armL' || bone === 'upper_armR') {
      if (longArm || sleeveT(position.getX(vertex), y, position.getZ(vertex)) < SLEEVE_T) keep[vertex] = 1
      continue
    }
    if (longArm && (bone === 'forearmL' || bone === 'forearmR')) keep[vertex] = 1
  }

  const verts: ShellVert[] = []
  const remap = new Int32Array(position.count).fill(-1)
  const offset = new THREE.Vector3()
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    if (!keep[vertex]) continue
    offset.fromBufferAttribute(normal, vertex)
    if (offset.lengthSq() < 1e-8) offset.set(0, 0, 1)
    else offset.normalize()
    const bone = dominantBone(names, skinIndex, skinWeight, vertex)
    const x = position.getX(vertex)
    const y = position.getY(vertex)
    const z = position.getZ(vertex)
    const sleeve = bone.startsWith('upper_arm') || bone.startsWith('forearm')
    const arm: 'L' | 'R' = z < 0 ? 'L' : 'R'
    const region = offset.x > FRONT_NX ? 1 : offset.x < -FRONT_NX ? 2 : 0
    const vert: ShellVert = {
      x: x + offset.x * SHELL_OFFSET,
      y: y + offset.y * SHELL_OFFSET,
      z: z + offset.z * SHELL_OFFSET,
      nx: offset.x,
      ny: offset.y,
      nz: offset.z,
      skinI: [0, 0, 0, 0],
      skinW: [0, 0, 0, 0],
      sleeve,
      arm,
      region,
      u: 0,
      v: 0,
    }
    for (let slot = 0; slot < 4; slot += 1) {
      vert.skinI[slot] = skinIndex.getComponent(vertex, slot)
      vert.skinW[slot] = skinWeight.getComponent(vertex, slot)
    }
    assignUv(vert, region, sleeve, wristT, aroundArm, hemY)
    remap[vertex] = verts.length
    verts.push(vert)
  }

  const indices: number[] = []
  const opening = (ids: number[]) => {
    if (garment !== 'button') return false
    let nx = 0
    let ax = 0
    let ay = 0
    let minZ = Infinity
    let maxZ = -Infinity
    for (const id of ids) {
      const vert = verts[id]
      nx += vert.nx
      ax += vert.x
      ay += vert.y
      minZ = Math.min(minZ, vert.z)
      maxZ = Math.max(maxZ, vert.z)
    }
    nx /= 3
    ax /= 3
    ay /= 3
    const crosses = minZ < 0.01 && maxZ > -0.01
    return nx > 0.2 && ax > 0 && ay < 0.63 && crosses && maxZ - minZ < 0.08
  }

  const emit = (ids: number[], asSleeve: boolean) => {
    const score = [0, 0, 0]
    for (const id of ids) score[verts[id].region] += 1
    let pick = 0
    if (score[1] > 0 && score[1] >= score[2] && score[1] >= score[0]) pick = 1
    else if (score[2] > 0 && score[2] >= score[0]) pick = 2
    const out = ids.map((id) => {
      const vert = verts[id]
      if (vert.region === pick && vert.sleeve === asSleeve) return id
      const copy: ShellVert = {
        ...vert,
        skinI: vert.skinI.slice(),
        skinW: vert.skinW.slice(),
        region: pick,
        sleeve: asSleeve,
      }
      assignUv(copy, pick, asSleeve, wristT, aroundArm, hemY)
      verts.push(copy)
      return verts.length - 1
    })
    indices.push(out[0], out[1], out[2])
  }

  for (let face = 0; face < index.count; face += 3) {
    const a = index.getX(face)
    const b = index.getX(face + 1)
    const c = index.getX(face + 2)
    if (!keep[a] || !keep[b] || !keep[c]) continue
    const ids = [remap[a], remap[b], remap[c]]
    if (opening(ids)) continue
    const sleeveVotes = ids.filter((id) => verts[id].sleeve).length
    emit(ids, sleeveVotes >= 2)
  }
  if (indices.length < 30) throw new Error('garment shell is empty')

  if (garment === 'button') addCollar(verts, indices, wristT, aroundArm, hemY)
  if (garment === 'sleeveless') sealSleeveless(verts, indices, wristT, aroundArm, hemY)

  const positions = new Float32Array(verts.length * 3)
  const normals = new Float32Array(verts.length * 3)
  const uvs = new Float32Array(verts.length * 2)
  const regions = new Float32Array(verts.length)
  const skinI = new Uint16Array(verts.length * 4)
  const skinW = new Float32Array(verts.length * 4)
  for (let n = 0; n < verts.length; n += 1) {
    const vert = verts[n]
    positions[n * 3] = vert.x
    positions[n * 3 + 1] = vert.y
    positions[n * 3 + 2] = vert.z
    normals[n * 3] = vert.nx
    normals[n * 3 + 1] = vert.ny
    normals[n * 3 + 2] = vert.nz
    uvs[n * 2] = vert.u
    uvs[n * 2 + 1] = vert.v
    regions[n] = vert.region
    for (let slot = 0; slot < 4; slot += 1) {
      skinI[n * 4 + slot] = vert.skinI[slot]
      skinW[n * 4 + slot] = vert.skinW[slot]
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setAttribute('region', new THREE.BufferAttribute(regions, 1))
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinI, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinW, 4))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}


function boundaryLoops(indices: number[]) {
  const count = new Map<string, number>()
  const ends = new Map<string, [number, number]>()
  const key = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  for (let face = 0; face < indices.length; face += 3) {
    const tri = [indices[face], indices[face + 1], indices[face + 2]]
    for (let k = 0; k < 3; k += 1) {
      const a = tri[k]
      const b = tri[(k + 1) % 3]
      const id = key(a, b)
      count.set(id, (count.get(id) ?? 0) + 1)
      ends.set(id, [a, b])
    }
  }
  const adj = new Map<number, number[]>()
  const link = (a: number, b: number) => {
    const list = adj.get(a)
    if (list) list.push(b)
    else adj.set(a, [b])
  }
  for (const [id, n] of count) {
    if (n !== 1) continue
    const pair = ends.get(id)
    if (!pair) continue
    link(pair[0], pair[1])
    link(pair[1], pair[0])
  }
  const seen = new Set<number>()
  const loops: number[][] = []
  for (const start of adj.keys()) {
    if (seen.has(start)) continue
    const loop = [start]
    seen.add(start)
    let prev = -1
    let cur = start
    for (;;) {
      const next = (adj.get(cur) ?? []).find((id) => id !== prev && !seen.has(id))
      if (next === undefined) break
      seen.add(next)
      loop.push(next)
      prev = cur
      cur = next
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

function spawnFrom(
  verts: ShellVert[],
  src: ShellVert,
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  wristT: (side: 'L' | 'R', x: number, y: number, z: number) => number,
  aroundArm: (side: 'L' | 'R', x: number, y: number, z: number) => number,
  hemY: number,
) {
  const len = Math.hypot(nx, ny, nz) || 1
  const copy: ShellVert = {
    ...src,
    skinI: src.skinI.slice(),
    skinW: src.skinW.slice(),
    x,
    y,
    z,
    nx: nx / len,
    ny: ny / len,
    nz: nz / len,
    sleeve: false,
    region: 0,
    u: 0,
    v: 0,
  }
  copy.region = copy.nx > FRONT_NX ? 1 : copy.nx < -FRONT_NX ? 2 : 0
  assignUv(copy, copy.region, false, wristT, aroundArm, hemY)
  verts.push(copy)
  return verts.length - 1
}

function projectLoop(verts: ShellVert[], ids: number[], plane: 'neck' | 'arm') {
  const n = ids.length
  if (n < 6) return
  let cx = 0
  let cy = 0
  let cz = 0
  for (const id of ids) {
    cx += verts[id].x
    cy += verts[id].y
    cz += verts[id].z
  }
  cx /= n
  cy /= n
  cz /= n
  if (plane === 'neck') {
    let rx = 0
    let rz = 0
    for (const id of ids) {
      rx = Math.max(rx, Math.abs(verts[id].x - cx))
      rz = Math.max(rz, Math.abs(verts[id].z - cz))
    }
    rx = Math.max(0.045, rx)
    rz = Math.max(0.045, rz)
    for (const id of ids) {
      const vert = verts[id]
      const ang = Math.atan2(vert.z - cz, vert.x - cx)
      vert.x = cx + Math.cos(ang) * rx
      vert.z = cz + Math.sin(ang) * rz
      vert.y = cy
    }
    return
  }
  let ry = 0
  let rz = 0
  for (const id of ids) {
    ry = Math.max(ry, Math.abs(verts[id].y - cy))
    rz = Math.max(rz, Math.abs(verts[id].z - cz))
  }
  ry = Math.max(0.04, ry)
  rz = Math.max(0.035, rz)
  for (const id of ids) {
    const vert = verts[id]
    const ang = Math.atan2(vert.y - cy, vert.z - cz)
    vert.y = cy + Math.sin(ang) * ry
    vert.z = cz + Math.cos(ang) * rz
    vert.x = cx
  }
}

function coverSide(
  verts: ShellVert[],
  indices: number[],
  sign: 1 | -1,
  hemY: number,
  wristT: (side: 'L' | 'R', x: number, y: number, z: number) => number,
  aroundArm: (side: 'L' | 'R', x: number, y: number, z: number) => number,
) {
  const y0 = Math.max(hemY + 0.025, 0.2)
  const y1 = 0.625
  const rows = 8
  const cols = 9
  const grid: number[][] = []
  for (let row = 0; row < rows; row += 1) {
    const rt = row / (rows - 1)
    const y = y0 + (y1 - y0) * rt
    const halfZ = 0.15 - rt * 0.07
    const line: number[] = []
    for (let col = 0; col < cols; col += 1) {
      const z = -halfZ + (2 * halfZ) * (col / (cols - 1))
      let best = -1
      let dist = Infinity
      for (let i = 0; i < verts.length; i += 1) {
        const vert = verts[i]
        if (sign * vert.nx < 0.2 || vert.sleeve) continue
        const d = (vert.y - y) ** 2 + (vert.z - z) ** 2
        if (d < dist) {
          dist = d
          best = i
        }
      }
      if (best < 0) continue
      const src = verts[best]
      const x = sign * Math.max(0.09, Math.abs(src.x))
      line.push(spawnFrom(verts, src, x, y, z, sign, 0, 0, wristT, aroundArm, hemY))
    }
    if (line.length === cols) grid.push(line)
  }
  for (let row = 0; row < grid.length - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const a = grid[row][col]
      const b = grid[row][col + 1]
      const c = grid[row + 1][col]
      const d = grid[row + 1][col + 1]
      indices.push(a, b, d, a, d, c)
    }
  }
}

function sealSleeveless(
  verts: ShellVert[],
  indices: number[],
  wristT: (side: 'L' | 'R', x: number, y: number, z: number) => number,
  aroundArm: (side: 'L' | 'R', x: number, y: number, z: number) => number,
  hemY: number,
) {
  coverSide(verts, indices, 1, hemY, wristT, aroundArm)
  coverSide(verts, indices, -1, hemY, wristT, aroundArm)
  for (const loop of boundaryLoops(indices)) {
    let cy = 0
    let cz = 0
    for (const id of loop) {
      cy += verts[id].y
      cz += verts[id].z
    }
    cy /= loop.length
    cz /= loop.length
    if (loop.length >= 8 && loop.length <= 28 && loop.every((id) => verts[id].y > 0.6)) {
      projectLoop(verts, loop, 'neck')
    } else if (loop.length >= 6 && loop.length <= 22 && cy > 0.48 && Math.abs(cz) > 0.08) {
      projectLoop(verts, loop, 'arm')
    }
  }
}

function assignUv(
  vert: ShellVert,
  region: number,
  asSleeve: boolean,
  wristT: (side: 'L' | 'R', x: number, y: number, z: number) => number,
  aroundArm: (side: 'L' | 'R', x: number, y: number, z: number) => number,
  hemY: number,
) {
  vert.region = region
  if (region === 0) {
    vert.u = 0
    vert.v = 0
    return
  }
  const height = clamp01((vert.y - hemY) / (0.66 - hemY))
  if (!asSleeve) {
    if (region === 1) {
      const ang = Math.atan2(vert.z, Math.max(vert.x, 0.02))
      vert.u = clamp01(0.18 + ((ang + 1.15) / 2.3) * 0.64)
    } else {
      const ang = Math.atan2(vert.z, Math.min(vert.x, -0.02))
      const centered = ang > 0 ? Math.PI - ang : -Math.PI - ang
      vert.u = clamp01(0.18 + ((centered + 1.15) / 2.3) * 0.64)
    }
    vert.v = 0.04 + height * 0.92
    return
  }
  const around = aroundArm(vert.arm, vert.x, vert.y, vert.z)
  const along = clamp01(1 - wristT(vert.arm, vert.x, vert.y, vert.z))
  const strip = vert.arm === 'L' ? 0.02 + around * 0.14 : 0.84 + around * 0.14
  vert.u = strip
  vert.v = 0.08 + along * 0.84
}

function addCollar(
  verts: ShellVert[],
  indices: number[],
  wristT: (side: 'L' | 'R', x: number, y: number, z: number) => number,
  aroundArm: (side: 'L' | 'R', x: number, y: number, z: number) => number,
  hemY: number,
) {
  const edge = new Map<string, number>()
  const key = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  for (let face = 0; face < indices.length; face += 3) {
    const tri = [indices[face], indices[face + 1], indices[face + 2]]
    for (let k = 0; k < 3; k += 1) {
      const id = key(tri[k], tri[(k + 1) % 3])
      edge.set(id, (edge.get(id) ?? 0) + 1)
    }
  }
  const raised = new Map<number, number>()
  const lift = (id: number) => {
    const existing = raised.get(id)
    if (existing !== undefined) return existing
    const src = verts[id]
    const copy: ShellVert = {
      ...src,
      skinI: src.skinI.slice(),
      skinW: src.skinW.slice(),
      x: src.x + src.nx * 0.012,
      y: src.y + 0.032 + src.ny * 0.008,
      z: src.z + src.nz * 0.012,
      sleeve: false,
    }
    copy.region = copy.nx > FRONT_NX ? 1 : copy.nx < -FRONT_NX ? 2 : 0
    assignUv(copy, copy.region, false, wristT, aroundArm, hemY)
    verts.push(copy)
    const next = verts.length - 1
    raised.set(id, next)
    return next
  }
  for (const [id, count] of edge) {
    if (count !== 1) continue
    const [a, b] = id.split('|').map(Number)
    const va = verts[a]
    const vb = verts[b]
    if (va.y < 0.6 || vb.y < 0.6) continue
    const mx = (va.x + vb.x) / 2
    const mz = (va.z + vb.z) / 2
    if (mx > 0.02 && Math.abs(mz) < 0.02) continue
    const ra = lift(a)
    const rb = lift(b)
    indices.push(a, b, rb, a, rb, ra)
  }
}

type RigHandle = {
  stand: THREE.Group
  bones: THREE.Bone[]
  baseQuat: Map<string, THREE.Quaternion>
  boneByName: Map<string, THREE.Bone>
  clips: Record<BodyMotion, THREE.AnimationClip>
  samples: Record<BodyMotion, ClipSample[]>
  shells: Record<Garment, THREE.SkinnedMesh>
  shellMat: THREE.MeshStandardMaterial
  applyWeight: (weightKg: number) => void
  applyLength: (lengthCm: number) => void
  time: number
}

function createClothMaterial(color: string) {
  const material = new THREE.MeshStandardMaterial({
    color,
    map: WHITE,
    roughness: 0.86,
    metalness: 0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  material.userData.frontMap = WHITE
  material.userData.backMap = WHITE
  material.userData.hasFront = 0
  material.userData.hasBack = 0
  material.customProgramCacheKey = () => 'northline-cloth-regions-1'
  material.onBeforeCompile = (shader) => {
    shader.uniforms.frontMap = { value: material.userData.frontMap }
    shader.uniforms.backMap = { value: material.userData.backMap }
    shader.uniforms.hasFront = { value: material.userData.hasFront }
    shader.uniforms.hasBack = { value: material.userData.hasBack }
    material.userData.clothShader = shader
    shader.vertexShader = shader.vertexShader
      .replace('#include <uv_pars_vertex>', '#include <uv_pars_vertex>\nattribute float region;\nvarying float vRegion;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRegion = region;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <uv_pars_fragment>',
        `#include <uv_pars_fragment>
uniform sampler2D frontMap;
uniform sampler2D backMap;
uniform float hasFront;
uniform float hasBack;
varying float vRegion;`,
      )
      .replace(
        '#include <map_fragment>',
        `if (hasFront > 0.5 && vRegion > 0.5 && vRegion < 1.5) {
  diffuseColor.rgb = texture2D(frontMap, vMapUv).rgb;
} else if (hasBack > 0.5 && vRegion > 1.5) {
  diffuseColor.rgb = texture2D(backMap, vMapUv).rgb;
}`,
      )
  }
  return material
}

function applyClothMaps(material: THREE.MeshStandardMaterial, front: THREE.Texture | null, back: THREE.Texture | null) {
  material.userData.frontMap = front ?? WHITE
  material.userData.backMap = back ?? WHITE
  material.userData.hasFront = front ? 1 : 0
  material.userData.hasBack = back ? 1 : 0
  const shader = material.userData.clothShader as { uniforms: Record<string, { value: unknown }> } | undefined
  if (!shader) return
  shader.uniforms.frontMap.value = material.userData.frontMap
  shader.uniforms.backMap.value = material.userData.backMap
  shader.uniforms.hasFront.value = material.userData.hasFront
  shader.uniforms.hasBack.value = material.userData.hasBack
}

function assembleRig(bodyScene: THREE.Object3D): RigHandle {
  const rig = cloneSkeleton(bodyScene)
  let skinned: THREE.SkinnedMesh | null = null
  rig.traverse((obj) => {
    if (obj instanceof THREE.SkinnedMesh) skinned = obj
  })
  if (!skinned) throw new Error('body mesh missing')
  const mesh = skinned as THREE.SkinnedMesh
  mesh.material = new THREE.MeshStandardMaterial({
    color: '#e0b8a2',
    roughness: 0.68,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  mesh.frustumCulled = false
  mesh.castShadow = false
  mesh.name = 'BodySkin'
  mesh.visible = true

  rig.updateMatrixWorld(true)
  const shellMat = createClothMaterial('#2c3338')
  const shells = {} as Record<Garment, THREE.SkinnedMesh>
  for (const garment of GARMENTS) {
    const shell = new THREE.SkinnedMesh(buildGarment(mesh, garment, hemYForLength(LENGTH_MIN)), shellMat)
    shell.name = `TeeShell-${garment}`
    shell.frustumCulled = false
    shell.castShadow = false
    shell.renderOrder = 2
    shell.visible = garment === 'short'
    shell.bind(mesh.skeleton, mesh.bindMatrix)
    mesh.parent?.add(shell)
    shells[garment] = shell
  }

  const baseScale = new Map<THREE.Bone, THREE.Vector3>()
  for (const bone of mesh.skeleton.bones) baseScale.set(bone, bone.scale.clone())

  const girth = (name: string, factor: number) => {
    const bone = mesh.skeleton.getBoneByName(name)
    if (!bone || !Number.isFinite(factor) || factor <= 0) return
    const base = baseScale.get(bone)
    if (!base) return
    bone.scale.set(base.x * factor, base.y, base.z * factor)
    for (const child of bone.children) {
      if (!(child instanceof THREE.Bone)) continue
      const childBase = baseScale.get(child)
      if (!childBase) continue
      child.scale.set(childBase.x / factor, childBase.y, childBase.z / factor)
    }
  }

  const applyWeight = (weightKg: number) => {
    const factor = chestWidthScale(weightKg)
    for (const bone of mesh.skeleton.bones) {
      const base = baseScale.get(bone)
      if (base) bone.scale.copy(base)
    }
    girth('spine001', factor)
    girth('spine003', factor)
  }

  const applyLength = (lengthCm: number) => {
    const hem = hemYForLength(lengthCm)
    for (const garment of GARMENTS) {
      const shell = shells[garment]
      const next = buildGarment(mesh, garment, hem)
      shell.geometry.dispose()
      shell.geometry = next
    }
    mesh.visible = true
  }

  const clips = {} as Record<BodyMotion, THREE.AnimationClip>
  const samples = {} as Record<BodyMotion, ClipSample[]>
  for (const clip of poseClips(mesh)) {
    const name = clip.name as BodyMotion
    clips[name] = clip
    samples[name] = samplesFor(clip)
  }

  const baseQuat = new Map<string, THREE.Quaternion>()
  const boneByName = new Map<string, THREE.Bone>()
  for (const bone of mesh.skeleton.bones) {
    baseQuat.set(bone.name, bone.quaternion.clone())
    boneByName.set(bone.name, bone)
  }

  const stand = new THREE.Group()
  stand.name = 'BodyRig'
  stand.rotation.y = -Math.PI / 2
  stand.position.y = 0.997
  stand.add(rig)
  return { stand, bones: mesh.skeleton.bones, baseQuat, boneByName, clips, samples, shells, shellMat, applyWeight, applyLength, time: 0 }
}

function paintShell(material: THREE.MeshStandardMaterial, color: string) {
  material.color.set(color)
}

function loadImageTexture(url: string, done: (texture: THREE.Texture) => void) {
  const loader = new THREE.TextureLoader()
  loader.load(url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.flipY = true
    texture.anisotropy = 8
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true
    done(texture)
  })
}

function TeeRig({
  heightCm,
  weightKg,
  color,
  motion,
  garment,
  lengthCm,
  shellOn,
  frontUrl,
  backUrl,
}: {
  heightCm: number
  weightKg: number
  color: string
  motion: BodyMotion
  garment: Garment
  lengthCm: number
  shellOn: boolean
  frontUrl: string | null
  backUrl: string | null
}) {
  const bodyGltf = useGLTF(BODY_URL)
  const rig = useMemo(() => assembleRig(bodyGltf.scene), [bodyGltf.scene])
  const frontMap = useRef<THREE.Texture | null>(null)
  const backMap = useRef<THREE.Texture | null>(null)
  const scratch = useMemo(() => new THREE.Quaternion(), [])

  useEffect(() => {
    rig.time = 0
  }, [motion, rig])

  useEffect(() => {
    for (const kind of GARMENTS) rig.shells[kind].visible = shellOn && kind === garment
  }, [garment, rig, shellOn])

  useEffect(() => {
    rig.applyLength(lengthCm)
  }, [lengthCm, rig])

  useEffect(() => {
    let alive = true
    if (!frontUrl) {
      frontMap.current?.dispose()
      frontMap.current = null
      applyClothMaps(rig.shellMat, null, backMap.current)
      return
    }
    loadImageTexture(frontUrl, (texture) => {
      if (!alive) {
        texture.dispose()
        return
      }
      frontMap.current?.dispose()
      frontMap.current = texture
      applyClothMaps(rig.shellMat, texture, backMap.current)
    })
    return () => {
      alive = false
    }
  }, [frontUrl, rig])

  useEffect(() => {
    let alive = true
    if (!backUrl) {
      backMap.current?.dispose()
      backMap.current = null
      applyClothMaps(rig.shellMat, frontMap.current, null)
      return
    }
    loadImageTexture(backUrl, (texture) => {
      if (!alive) {
        texture.dispose()
        return
      }
      backMap.current?.dispose()
      backMap.current = texture
      applyClothMaps(rig.shellMat, frontMap.current, texture)
    })
    return () => {
      alive = false
    }
  }, [backUrl, rig])

  useEffect(() => {
    paintShell(rig.shellMat, color)
  }, [color, rig])

  useEffect(() => {
    return () => {
      frontMap.current?.dispose()
      backMap.current?.dispose()
      frontMap.current = null
      backMap.current = null
    }
  }, [])

  useFrame((_, delta) => {
    const clip = rig.clips[motion]
    rig.time = (rig.time + delta) % clip.duration
    const wrapped = ((rig.time % clip.duration) + clip.duration) % clip.duration
    for (const bone of rig.bones) {
      const base = rig.baseQuat.get(bone.name)
      if (base) bone.quaternion.copy(base)
    }
    for (const sample of rig.samples[motion]) {
      const bone = rig.boneByName.get(sample.boneName)
      if (!bone) continue
      if (!sampleQuaternion(sample.times, sample.values, wrapped, scratch)) continue
      bone.quaternion.copy(scratch)
    }
    rig.applyWeight(weightKg)
  })

  const hs = heightScale(heightCm)
  return (
    <group scale={[1, hs, 1]}>
      <primitive object={rig.stand} />
    </group>
  )
}

async function rasterizeArt(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('artwork')
  const svg = (await response.text()).replace('<svg', '<svg width="800" height="1000"')
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('artwork'))
      image.src = objectUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 1000
    const context = canvas.getContext('2d')
    if (!context) throw new Error('artwork')
    context.drawImage(image, 0, 0, 800, 1000)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    texture.needsUpdate = true
    return texture
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const artCache = new Map<string, Promise<THREE.CanvasTexture>>()

function useArtTexture(url: string) {
  let pending = artCache.get(url)
  if (!pending) {
    pending = rasterizeArt(url).catch((error) => {
      artCache.delete(url)
      throw error
    })
    artCache.set(url, pending)
  }
  return use(pending)
}

function FrameModel({ artUrl }: { artUrl: string }) {
  const texture = useArtTexture(artUrl)
  const { scene } = useGLTF(FRAME_URL)
  const root = useMemo(() => cloneWithMaterials(scene), [scene])
  return (
    <group>
      <primitive object={root} />
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[0.785, 0.981]} />
        <meshStandardMaterial map={texture} roughness={0.78} metalness={0} />
      </mesh>
    </group>
  )
}

function View({
  kind,
  handle,
  heightCm,
  weightKg,
  color,
  motion,
  garment,
  lengthCm,
  shellOn,
  frontUrl,
  backUrl,
}: Required<StageProps>) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  const hs = heightScale(heightCm)
  useLayoutEffect(() => {
    controls.current?.target.set(0, 0.98 * hs, 0)
  }, [hs])

  return (
    <>
      <hemisphereLight args={['#f7f4ee', '#3a3a3a', 0.85]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[2.8, 4.2, 3.2]} intensity={2.5} />
      <directionalLight position={[-2.4, 1.6, -1.8]} intensity={0.55} />
      <Suspense fallback={null}>
        {kind === 'tee' ? (
          <TeeRig
            heightCm={heightCm}
            weightKg={weightKg}
            color={color}
            motion={motion}
            garment={garment}
            lengthCm={lengthCm}
            shellOn={shellOn}
            frontUrl={frontUrl}
            backUrl={backUrl}
          />
        ) : (
          <FrameModel artUrl={`/products/${handle}.svg`} />
        )}
      </Suspense>
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableRotate
        enableDamping
        rotateSpeed={0.85}
        target={kind === 'tee' ? [0, 0.98 * hs, 0] : [0, 0, 0]}
        minDistance={kind === 'tee' ? 2.4 : 1.6}
        maxDistance={kind === 'tee' ? 8 : 4.2}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI - 0.25}
      />
    </>
  )
}

export function ProductStage({
  kind,
  handle,
  heightCm = 175,
  weightKg = 70,
  color = '#2c3338',
  motion = 'diam',
  garment = 'short',
  lengthCm = LENGTH_MIN,
  shellOn = true,
  frontUrl = null,
  backUrl = null,
}: StageProps) {
  const hs = heightScale(heightCm)
  const camera =
    kind === 'tee'
      ? { position: [1.15, 1.05 * hs, 4.15] as [number, number, number], fov: 32 }
      : { position: [0.55, 0.15, 2.25] as [number, number, number], fov: 35 }
  const fallback = <div className="stage-fallback">3D preview unavailable</div>

  return (
    <StageBoundary resetKey={motion} fallback={fallback}>
      <Canvas
        key={`${kind}:${handle}`}
        className="viewer"
        aria-label={kind === 'tee' ? 'Rotatable body preview' : 'Rotatable framed poster preview'}
        camera={camera}
        dpr={[1, 1.75]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: true,
        }}
      >
        <View
          kind={kind}
          handle={handle}
          heightCm={heightCm}
          weightKg={weightKg}
          color={color}
          motion={motion}
          garment={garment}
          lengthCm={lengthCm}
          shellOn={shellOn}
          frontUrl={frontUrl}
          backUrl={backUrl}
        />
      </Canvas>
    </StageBoundary>
  )
}
