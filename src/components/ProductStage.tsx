import { Component, Suspense, use, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { chestWidthScale, heightScale } from '../lib/fit'

const FRAME_URL = '/models/frame.glb'
// CC0 male base mesh (male_base_mesh.glb from BoQsc/Godot-3D-Male-Base-Mesh 1.0.2). Not a primitive mannequin.
const BODY_URL = '/models/body.glb'
const SHIRT_URL = '/models/shirt.glb'

useGLTF.preload(FRAME_URL)
useGLTF.preload(BODY_URL)
useGLTF.preload(SHIRT_URL)

export type BodyMotion = 'diam' | 'putar' | 'jalan'

type StageProps = {
  kind: 'poster' | 'tee'
  handle: string
  heightCm?: number
  weightKg?: number
  color?: string
  motion?: BodyMotion
}

const X_AXIS = new THREE.Vector3(1, 0, 0)
const Y_AXIS = new THREE.Vector3(0, 1, 0)

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
  return q
}

function quatTrack(bone: THREE.Bone, times: number[], angles: number[], axis: THREE.Vector3) {
  const values: number[] = []
  for (const angle of angles) {
    const q = quatDelta(bone, axis, angle)
    values.push(q.x, q.y, q.z, q.w)
  }
  return new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values)
}

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

function paintShirt(root: THREE.Object3D, color: string) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) material.color.set(color)
    }
  })
}


function dropSleeves(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const geometry = obj.geometry.clone()
    geometry.boundingBox = null
    geometry.boundingSphere = null
    const position = geometry.attributes.position
    const vertex = new THREE.Vector3()
    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i)
      const reach = Math.abs(vertex.x)
      const drop = Math.max(0, reach - 0.16) * 1.15
      if (drop <= 0) continue
      position.setXYZ(i, vertex.x, vertex.y - drop, vertex.z)
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
    obj.geometry = geometry
  })
}

type RigHandle = {
  stand: THREE.Group
  mixer: THREE.AnimationMixer
  actions: Record<BodyMotion, THREE.AnimationAction>
  shirt: THREE.Object3D
  applyWeight: (weightKg: number) => void
}

function assembleRig(bodyScene: THREE.Object3D, shirtScene: THREE.Object3D): RigHandle {
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

  const shirt = cloneWithMaterials(shirtScene)
  dropSleeves(shirt)
  shirt.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.frustumCulled = false
      obj.geometry.boundingBox = null
      obj.geometry.boundingSphere = null
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.roughness = 0.86
          material.metalness = 0
          material.side = THREE.DoubleSide
          material.map = null
        }
      }
    }
  })
  const chest = mesh.skeleton.getBoneByName('spine003')
  if (!chest) throw new Error('missing chest bone')
  chest.updateWorldMatrix(true, true)
  const boneQ = new THREE.Quaternion()
  chest.getWorldQuaternion(boneQ)
  // Right-handed: sleeves across the body, collar up, shirt front toward the chest.
  const upright = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)),
  )
  shirt.scale.set(1.48, 2.15, 1.9)
  shirt.quaternion.copy(boneQ).invert().multiply(upright)
  shirt.position.set(0, 0, 0)
  chest.add(shirt)
  shirt.updateWorldMatrix(true, true)
  const worn = new THREE.Box3().setFromObject(shirt)
  const shift = new THREE.Vector3(
    0.04 - (worn.min.x + worn.max.x) / 2,
    0.73 - worn.max.y,
    -(worn.min.z + worn.max.z) / 2,
  )
  const restPosition = shift.applyQuaternion(boneQ.clone().invert())
  shirt.position.copy(restPosition)

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
    const wornOn = mesh.skeleton.getBoneByName('spine003')
    if (wornOn) {
      shirt.position.set(
        restPosition.x / wornOn.scale.x,
        restPosition.y / wornOn.scale.y,
        restPosition.z / wornOn.scale.z,
      )
    }
  }

  const mixer = new THREE.AnimationMixer(rig)
  const actions = {} as Record<BodyMotion, THREE.AnimationAction>
  for (const clip of poseClips(mesh)) {
    const action = mixer.clipAction(clip)
    action.loop = THREE.LoopRepeat
    action.clampWhenFinished = false
    actions[clip.name as BodyMotion] = action
  }

  const stand = new THREE.Group()
  stand.name = 'BodyRig'
  stand.rotation.y = -Math.PI / 2
  stand.position.y = 0.997
  stand.add(rig)
  return { stand, mixer, actions, shirt, applyWeight }
}

function TeeRig({
  heightCm,
  weightKg,
  color,
  motion,
}: {
  heightCm: number
  weightKg: number
  color: string
  motion: BodyMotion
}) {
  const bodyGltf = useGLTF(BODY_URL)
  const shirtGltf = useGLTF(SHIRT_URL)
  const rig = useMemo(() => assembleRig(bodyGltf.scene, shirtGltf.scene), [bodyGltf.scene, shirtGltf.scene])
  const playing = useRef<THREE.AnimationAction | null>(null)

  useEffect(() => {
    const next = rig.actions[motion]
    const prev = playing.current
    if (prev && prev !== next) prev.fadeOut(0.25)
    next.reset().setEffectiveWeight(1).fadeIn(0.25).play()
    playing.current = next
  }, [motion, rig])

  useEffect(() => {
    paintShirt(rig.shirt, color)
  }, [color, rig])

  useFrame((_, delta) => {
    rig.mixer.update(delta)
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
          <TeeRig heightCm={heightCm} weightKg={weightKg} color={color} motion={motion} />
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
        <View kind={kind} handle={handle} heightCm={heightCm} weightKg={weightKg} color={color} motion={motion} />
      </Canvas>
    </StageBoundary>
  )
}
