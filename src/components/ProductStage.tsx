import { Component, Suspense, use, useEffect, useMemo, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const TEE_URL = '/models/tee.glb'
const FRAME_URL = '/models/frame.glb'

useGLTF.preload(TEE_URL)
useGLTF.preload(FRAME_URL)

type StageProps = {
  kind: 'poster' | 'tee'
  handle: string
  color: string
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

function TeeModel({ color }: { color: string }) {
  const { scene } = useGLTF(TEE_URL)
  const root = useMemo(() => cloneWithMaterials(scene), [scene])

  useEffect(() => {
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) material.color.set(color)
      }
    })
  }, [root, color])

  return <primitive object={root} />
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

function View({ kind, handle, color }: StageProps) {
  return (
    <>
      <hemisphereLight args={['#f7f4ee', '#3a3a3a', 0.72]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3.4, 2.8, 2.2]} intensity={2.4} />
      <directionalLight position={[-2.8, 1.2, -2.4]} intensity={0.7} />
      <Suspense fallback={null}>
        {kind === 'tee' ? (
          <group rotation={[0.12, -0.7, 0]}>
            <TeeModel color={color} />
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
        rotateSpeed={0.9}
        minDistance={kind === 'tee' ? 2.2 : 1.6}
        maxDistance={kind === 'tee' ? 6.5 : 4.2}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI - 0.35}
      />
    </>
  )
}

export function ProductStage({ kind, handle, color }: StageProps) {
  const camera =
    kind === 'tee'
      ? { position: [1.55, 0.72, 2.7] as [number, number, number], fov: 32 }
      : { position: [0.55, 0.15, 2.25] as [number, number, number], fov: 35 }

  const fallback = <div className="stage-fallback">3D preview unavailable</div>

  return (
    <StageBoundary fallback={fallback}>
      <Canvas
        key={`${kind}:${handle}`}
        className="viewer"
        aria-label={kind === 'tee' ? 'Rotatable tee preview' : 'Rotatable framed poster preview'}
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
        <View kind={kind} handle={handle} color={color} />
      </Canvas>
    </StageBoundary>
  )
}
