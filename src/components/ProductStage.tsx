import { Component, Suspense, use, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { chestWidthScale, heightScale } from '../lib/fit'

const FRAME_URL = '/models/frame.glb'
// CC0 male base mesh (male_base_mesh.glb from BoQsc/Godot-3D-Male-Base-Mesh 1.0.2). Not a primitive mannequin.
const BODY_URL = '/models/body.glb'

useGLTF.preload(FRAME_URL)
useGLTF.preload(BODY_URL)

export type BodyMotion = 'diam' | 'putar' | 'jalan'

type StageProps = {
  kind: 'poster' | 'tee'
  handle: string
  heightCm?: number
  weightKg?: number
  color?: string
  motion?: BodyMotion
  /** Object URL for a visitor-picked PNG/JPEG. Never sent to the server. */
  fabricUrl?: string | null
}

const X_AXIS = new THREE.Vector3(1, 0, 0)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const _qa = new THREE.Quaternion()
const _qb = new THREE.Quaternion()
const TORSO_BONES = new Set(['spine001', 'spine002', 'spine003', 'shoulderL', 'shoulderR'])
const SHELL_OFFSET = 0.014
const SLEEVE_T = 0.46
const NECK_Y = 0.7
const HEM_Y = 0.08

class StageBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
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

/** Rotation clips only. No scale, no visibility, no root translation. */
function poseClips(skinned: THREE.SkinnedMesh) {
  const bone = (name: string) => {
    const found = skinned.skeleton.getBoneByName(name)
    if (!found) throw new Error(`missing bone ${name}`)
    return found
  }
  const chest = bone('spine003')
  const ribs = bone('spine002')
  const hips = bone('spine')
  const thighL = bone('thighL')
  const thighR = bone('thighR')
  const shinL = bone('shinL')
  const shinR = bone('shinR')
  return [
    new THREE.AnimationClip('diam', 2.6, [
      quatTrack(chest, [0, 1.3, 2.6], [0, 0.09, 0], X_AXIS),
      quatTrack(ribs, [0, 1.3, 2.6], [0, 0.035, 0], X_AXIS),
    ]),
    new THREE.AnimationClip('putar', 4, [
      quatTrack(hips, [0, 1, 2, 3, 4], [0, 0.5, 0, -0.5, 0], Y_AXIS),
    ]),
    new THREE.AnimationClip('jalan', 1.2, [
      quatTrack(thighL, [0, 0.6, 1.2], [-0.55, 0.4, -0.55], X_AXIS),
      quatTrack(thighR, [0, 0.6, 1.2], [0.4, -0.55, 0.4], X_AXIS),
      quatTrack(shinL, [0, 0.6, 1.2], [0.55, 0.12, 0.55], X_AXIS),
      quatTrack(shinR, [0, 0.6, 1.2], [0.12, 0.55, 0.12], X_AXIS),
    ]),
  ]
}

type ClipSample = {
  boneName: string
  times: Float32Array
  values: Float32Array
}

function samplesFor(clip: THREE.AnimationClip): ClipSample[] {
  return clip.tracks.map((track) => {
    if (!(track instanceof THREE.QuaternionKeyframeTrack)) {
      throw new Error('clips may only rotate bones')
    }
    return {
      boneName: track.name.replace(/\.quaternion$/, ''),
      times: track.times,
      values: track.values as Float32Array,
    }
  })
}

function sampleQuaternion(times: Float32Array, values: Float32Array, time: number, target: THREE.Quaternion) {
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

/**
 * Short-sleeve tee carved from a clone of the CC0 body mesh.
 * Same vertex skin indices and the same skeleton. Not a separate shirt file.
 */
function buildTeeShell(mesh: THREE.SkinnedMesh) {
  const source = mesh.geometry
  const position = source.getAttribute('position') as THREE.BufferAttribute
  const normal = source.getAttribute('normal') as THREE.BufferAttribute
  const skinIndex = source.getAttribute('skinIndex') as THREE.BufferAttribute
  const skinWeight = source.getAttribute('skinWeight') as THREE.BufferAttribute
  const index = source.getIndex()
  if (!position || !normal || !skinIndex || !skinWeight || !index) throw new Error('body attributes missing')

  mesh.skeleton.update()
  const arm = (side: 'L' | 'R') => {
    const upper = mesh.skeleton.getBoneByName(`upper_arm${side}`)
    const fore = mesh.skeleton.getBoneByName(`forearm${side}`)
    if (!upper || !fore) throw new Error('arm bones missing')
    const origin = new THREE.Vector3().setFromMatrixPosition(upper.matrixWorld)
    const elbow = new THREE.Vector3().setFromMatrixPosition(fore.matrixWorld)
    return { origin, elbow }
  }
  const arms = { L: arm('L'), R: arm('R') }
  const point = new THREE.Vector3()
  const along = new THREE.Vector3()
  const sleeveT = (x: number, y: number, z: number) => {
    const side = z < 0 ? 'L' : 'R'
    const { origin, elbow } = arms[side]
    along.copy(elbow).sub(origin)
    point.set(x, y, z).sub(origin)
    return point.dot(along) / along.lengthSq()
  }

  const names = mesh.skeleton.bones.map((bone) => bone.name)
  const keep = new Uint8Array(position.count)
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const bone = dominantBone(names, skinIndex, skinWeight, vertex)
    const y = position.getY(vertex)
    if (y >= NECK_Y) continue
    if (TORSO_BONES.has(bone) && y > HEM_Y) {
      keep[vertex] = 1
      continue
    }
    if ((bone === 'upper_armL' || bone === 'upper_armR') && y > HEM_Y && sleeveT(position.getX(vertex), y, position.getZ(vertex)) < SLEEVE_T) {
      keep[vertex] = 1
    }
  }

  const remap = new Int32Array(position.count).fill(-1)
  const kept: number[] = []
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    if (!keep[vertex]) continue
    remap[vertex] = kept.length
    kept.push(vertex)
  }

  const indices: number[] = []
  for (let face = 0; face < index.count; face += 3) {
    const a = index.getX(face)
    const b = index.getX(face + 1)
    const c = index.getX(face + 2)
    if (keep[a] && keep[b] && keep[c]) indices.push(remap[a], remap[b], remap[c])
  }
  if (indices.length < 30) throw new Error('tee shell is empty')

  const positions = new Float32Array(kept.length * 3)
  const normals = new Float32Array(kept.length * 3)
  const uvs = new Float32Array(kept.length * 2)
  const nextIndex = new Uint16Array(kept.length * 4)
  const nextWeight = new Float32Array(kept.length * 4)
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  const offset = new THREE.Vector3()
  for (let n = 0; n < kept.length; n += 1) {
    const vertex = kept[n]
    offset.fromBufferAttribute(normal, vertex)
    if (offset.lengthSq() < 1e-8) offset.set(0, 0, 1)
    else offset.normalize()
    const x = position.getX(vertex) + offset.x * SHELL_OFFSET
    const y = position.getY(vertex) + offset.y * SHELL_OFFSET
    const z = position.getZ(vertex) + offset.z * SHELL_OFFSET
    positions[n * 3] = x
    positions[n * 3 + 1] = y
    positions[n * 3 + 2] = z
    normals[n * 3] = offset.x
    normals[n * 3 + 1] = offset.y
    normals[n * 3 + 2] = offset.z
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
    for (let slot = 0; slot < 4; slot += 1) {
      nextIndex[n * 4 + slot] = skinIndex.getComponent(vertex, slot)
      nextWeight[n * 4 + slot] = skinWeight.getComponent(vertex, slot)
    }
  }
  const spanY = Math.max(1e-4, maxY - minY)
  const spanZ = Math.max(1e-4, maxZ - minZ)
  for (let n = 0; n < kept.length; n += 1) {
    const y = positions[n * 3 + 1]
    const z = positions[n * 3 + 2]
    uvs[n * 2] = (z - minZ) / spanZ
    uvs[n * 2 + 1] = (y - minY) / spanY
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(nextIndex, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(nextWeight, 4))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

type RigHandle = {
  stand: THREE.Group
  bones: THREE.Bone[]
  baseQuat: Map<string, THREE.Quaternion>
  fromQuat: Map<string, THREE.Quaternion>
  desiredQuat: Map<string, THREE.Quaternion>
  clips: Record<BodyMotion, THREE.AnimationClip>
  samples: Record<BodyMotion, ClipSample[]>
  shellMat: THREE.MeshStandardMaterial
  applyWeight: (weightKg: number) => void
  time: number
  blend: number
}

function assembleRig(bodyScene: THREE.Object3D): RigHandle {
  const rig = cloneSkeleton(bodyScene)
  let skinned: THREE.SkinnedMesh | null = null
  rig.traverse((obj) => {
    if (obj instanceof THREE.SkinnedMesh) skinned = obj
  })
  if (!skinned) throw new Error('body mesh missing')
  const mesh = skinned as THREE.SkinnedMesh
  mesh.material = new THREE.MeshStandardMaterial({ color: '#e0b8a2', roughness: 0.68, metalness: 0 })
  mesh.frustumCulled = false
  mesh.castShadow = false
  mesh.name = 'BodySkin'

  rig.updateMatrixWorld(true)
  const shellMat = new THREE.MeshStandardMaterial({
    color: '#2c3338',
    roughness: 0.86,
    metalness: 0,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const shell = new THREE.SkinnedMesh(buildTeeShell(mesh), shellMat)
  shell.name = 'TeeShell'
  shell.frustumCulled = false
  shell.castShadow = false
  shell.renderOrder = 2
  shell.bind(mesh.skeleton, mesh.bindMatrix)
  mesh.parent?.add(shell)

  const baseScale = new Map<THREE.Bone, THREE.Vector3>()
  for (const bone of mesh.skeleton.bones) baseScale.set(bone, bone.scale.clone())

  const girth = (name: string, factor: number) => {
    const bone = mesh.skeleton.getBoneByName(name)
    if (!bone) return
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

  const clips = {} as Record<BodyMotion, THREE.AnimationClip>
  const samples = {} as Record<BodyMotion, ClipSample[]>
  for (const clip of poseClips(mesh)) {
    const name = clip.name as BodyMotion
    clips[name] = clip
    samples[name] = samplesFor(clip)
  }

  const baseQuat = new Map<string, THREE.Quaternion>()
  const fromQuat = new Map<string, THREE.Quaternion>()
  const desiredQuat = new Map<string, THREE.Quaternion>()
  for (const bone of mesh.skeleton.bones) {
    baseQuat.set(bone.name, bone.quaternion.clone())
    fromQuat.set(bone.name, bone.quaternion.clone())
    desiredQuat.set(bone.name, bone.quaternion.clone())
  }

  const stand = new THREE.Group()
  stand.name = 'BodyRig'
  stand.rotation.y = -Math.PI / 2
  stand.position.y = 0.997
  stand.add(rig)
  return {
    stand,
    bones: mesh.skeleton.bones,
    baseQuat,
    fromQuat,
    desiredQuat,
    clips,
    samples,
    shellMat,
    applyWeight,
    time: 0,
    blend: 1,
  }
}

function paintShell(material: THREE.MeshStandardMaterial, color: string, map: THREE.Texture | null) {
  material.map = map
  material.color.set(map ? '#ffffff' : color)
  material.needsUpdate = true
}

function TeeRig({
  heightCm,
  weightKg,
  color,
  motion,
  fabricUrl,
}: {
  heightCm: number
  weightKg: number
  color: string
  motion: BodyMotion
  fabricUrl: string | null
}) {
  const bodyGltf = useGLTF(BODY_URL)
  const rig = useMemo(() => assembleRig(bodyGltf.scene), [bodyGltf.scene])
  const fabricMap = useRef<THREE.Texture | null>(null)
  const scratch = useMemo(() => new THREE.Quaternion(), [])

  useEffect(() => {
    for (const bone of rig.bones) {
      const from = rig.fromQuat.get(bone.name)
      if (from) from.copy(bone.quaternion)
    }
    rig.blend = 0
    rig.time = 0
  }, [motion, rig])

  useEffect(() => {
    let alive = true
    if (!fabricUrl) {
      fabricMap.current?.dispose()
      fabricMap.current = null
      paintShell(rig.shellMat, color, null)
      return
    }
    const loader = new THREE.TextureLoader()
    loader.load(fabricUrl, (texture) => {
      if (!alive) {
        texture.dispose()
        return
      }
      fabricMap.current?.dispose()
      texture.colorSpace = THREE.SRGBColorSpace
      texture.flipY = true
      texture.anisotropy = 8
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.needsUpdate = true
      fabricMap.current = texture
      paintShell(rig.shellMat, color, texture)
    })
    return () => {
      alive = false
    }
  }, [fabricUrl, rig])

  useEffect(() => {
    paintShell(rig.shellMat, color, fabricMap.current)
  }, [color, fabricUrl, rig])

  useEffect(() => {
    return () => {
      fabricMap.current?.dispose()
      fabricMap.current = null
    }
  }, [])

  useFrame((_, delta) => {
    rig.blend = Math.min(1, rig.blend + delta / 0.25)
    const clip = rig.clips[motion]
    rig.time = (rig.time + delta) % clip.duration
    for (const bone of rig.bones) {
      const base = rig.baseQuat.get(bone.name)
      const desired = rig.desiredQuat.get(bone.name)
      if (base && desired) desired.copy(base)
    }
    const wrapped = ((rig.time % clip.duration) + clip.duration) % clip.duration
    for (const sample of rig.samples[motion]) {
      const desired = rig.desiredQuat.get(sample.boneName)
      if (!desired) continue
      if (!sampleQuaternion(sample.times, sample.values, wrapped, scratch)) continue
      desired.copy(scratch)
    }
    for (const bone of rig.bones) {
      const from = rig.fromQuat.get(bone.name)
      const desired = rig.desiredQuat.get(bone.name)
      if (!from || !desired) continue
      bone.quaternion.copy(from).slerp(desired, rig.blend)
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
  fabricUrl,
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
          <TeeRig heightCm={heightCm} weightKg={weightKg} color={color} motion={motion} fabricUrl={fabricUrl} />
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
  fabricUrl = null,
}: StageProps) {
  const hs = heightScale(heightCm)
  const camera =
    kind === 'tee'
      ? { position: [1.15, 1.05 * hs, 4.15] as [number, number, number], fov: 32 }
      : { position: [0.55, 0.15, 2.25] as [number, number, number], fov: 35 }

  const fallback = <div className="stage-fallback">3D preview unavailable</div>

  return (
    <StageBoundary fallback={fallback}>
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
          fabricUrl={fabricUrl}
        />
      </Canvas>
    </StageBoundary>
  )
}
