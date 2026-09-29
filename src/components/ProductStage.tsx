import { Component, Suspense, use, useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { applyBodyScale, createBodyGeometry, shirtMountTransform } from '../lib/bodyMesh'

const FRAME_URL = '/models/frame.glb'

useGLTF.preload(FRAME_URL)

type StageProps = {
  kind: 'poster' | 'tee'
  handle: string
  heightCm?: number
  weightKg?: number
}

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

function BodyMesh({ heightCm, weightKg }: { heightCm: number; weightKg: number }) {
  const geometry = useMemo(() => createBodyGeometry(), [])

  useLayoutEffect(() => {
    applyBodyScale(geometry, heightCm, weightKg)
  }, [geometry, heightCm, weightKg])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} name="EstimatedBody">
      <meshStandardMaterial color="#d9c6b6" roughness={0.74} metalness={0} />
    </mesh>
  )
}

function waitingLabel() {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 160
  const context = canvas.getContext('2d')
  if (!context) return null
  context.fillStyle = 'rgba(255,255,255,0.94)'
  context.fillRect(0, 0, 640, 160)
  context.strokeStyle = '#4e4943'
  context.lineWidth = 6
  context.setLineDash([14, 10])
  context.strokeRect(8, 8, 624, 144)
  context.setLineDash([])
  context.fillStyle = '#171717'
  context.font = '600 46px Inter, Helvetica, Arial, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('Shirt file is waiting', 320, 80)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function ShirtMount({ heightCm, weightKg }: { heightCm: number; weightKg: number }) {
  const mount = useMemo(() => {
    const place = shirtMountTransform(heightCm, weightKg)
    const w = place.width / 2
    const h = place.height / 2
    const frame = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-w, -h, 0),
        new THREE.Vector3(w, -h, 0),
        new THREE.Vector3(w, h, 0),
        new THREE.Vector3(-w, h, 0),
        new THREE.Vector3(-w, -h, 0),
      ]),
      new THREE.LineBasicMaterial({ color: '#4e4943' }),
    )
    frame.name = 'ShirtMountFrame'
    frame.position.set(place.position[0], place.position[1], place.position[2])

    const map = waitingLabel()
    const group = new THREE.Group()
    group.name = 'ShirtMount'
    group.add(frame)
    if (map) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false }),
      )
      sprite.name = 'ShirtMountLabel'
      sprite.renderOrder = 10
      sprite.position.set(place.position[0], place.position[1], place.position[2])
      sprite.scale.set(0.78, 0.2, 1)
      group.add(sprite)
    }
    return group
  }, [heightCm, weightKg])

  useEffect(() => {
    return () => {
      mount.traverse((obj) => {
        if (obj instanceof THREE.Line) {
          obj.geometry.dispose()
          const material = obj.material
          if (!Array.isArray(material)) material.dispose()
        }
        if (obj instanceof THREE.Sprite) {
          if (obj.material.map) obj.material.map.dispose()
          obj.material.dispose()
        }
      })
    }
  }, [mount])

  return <primitive object={mount} />
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

function View({ kind, handle, heightCm, weightKg }: Required<StageProps>) {
  return (
    <>
      <hemisphereLight args={['#f7f4ee', '#3a3a3a', 0.85]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[2.8, 4.2, 3.2]} intensity={2.5} />
      <directionalLight position={[-2.4, 1.6, -1.8]} intensity={0.55} />
      <Suspense fallback={null}>
        {kind === 'tee' ? (
          <group>
            <BodyMesh heightCm={heightCm} weightKg={weightKg} />
            <ShirtMount heightCm={heightCm} weightKg={weightKg} />
          </group>
        ) : (
          <FrameModel artUrl={`/products/${handle}.svg`} />
        )}
      </Suspense>
      <OrbitControls
        makeDefault
        enablePan={false}
        enableRotate
        enableDamping
        rotateSpeed={0.85}
        target={kind === 'tee' ? [0, 0.92, 0] : [0, 0, 0]}
        minDistance={kind === 'tee' ? 2.2 : 1.6}
        maxDistance={kind === 'tee' ? 7.5 : 4.2}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI - 0.25}
      />
    </>
  )
}

export function ProductStage({ kind, handle, heightCm = 175, weightKg = 70 }: StageProps) {
  const camera =
    kind === 'tee'
      ? { position: [1.05, 1.15, 3.35] as [number, number, number], fov: 32 }
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
        <View kind={kind} handle={handle} heightCm={heightCm} weightKg={weightKg} />
      </Canvas>
    </StageBoundary>
  )
}
