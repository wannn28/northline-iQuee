// Original low-poly product meshes. Sketchfab downloads require a login we do not have.
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    constructor() {
      this.result = null
      this.onloadend = null
    }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer
        if (this.onloadend) this.onloadend()
      })
    }
  }
}

function box(w, h, d, x, y, z, rotX = 0) {
  const geom = new THREE.BoxGeometry(w, h, d)
  if (rotX) geom.rotateX(rotX)
  geom.translate(x, y, z)
  return geom
}

function teeMesh() {
  const shape = new THREE.Shape()
  const body = 0.46
  const hem = -0.64
  const pit = 0.26
  const sleeveOut = 0.96
  const sleeveLow = 0.34
  const sleeveHigh = 0.56
  const shoulder = 0.5
  const neck = 0.14
  shape.moveTo(-body, hem)
  shape.lineTo(body, hem)
  shape.lineTo(body, pit)
  shape.lineTo(sleeveOut, sleeveLow)
  shape.lineTo(sleeveOut, sleeveHigh)
  shape.lineTo(neck, shoulder)
  shape.bezierCurveTo(neck * 0.35, shoulder - 0.16, -neck * 0.35, shoulder - 0.16, -neck, shoulder)
  shape.lineTo(-sleeveOut, sleeveHigh)
  shape.lineTo(-sleeveOut, sleeveLow)
  shape.lineTo(-body, pit)
  shape.closePath()

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 8,
  })
  geom.center()
  geom.computeVertexNormals()
  const tris = geom.index ? geom.index.count / 3 : geom.getAttribute('position').count / 3
  const material = new THREE.MeshStandardMaterial({
    name: 'Fabric',
    color: '#2c3338',
    roughness: 0.88,
    metalness: 0.0,
  })
  const mesh = new THREE.Mesh(geom, material)
  mesh.name = 'Tee'
  return { mesh, tris }
}

// Inner opening is 0.80 x 1.00. Poster plane in the viewer is 0.785 x 0.981 at z = 0.02.
async function main() {
  const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js')
  const openingW = 0.8
  const openingH = 1.0
  const bar = 0.055
  const depth = 0.05
  const outerW = openingW + bar * 2
  const parts = [
    box(outerW, bar, depth, 0, openingH / 2 + bar / 2, 0),
    box(outerW, bar, depth, 0, -(openingH / 2 + bar / 2), 0),
    box(bar, openingH, depth, -(openingW / 2 + bar / 2), 0, 0),
    box(bar, openingH, depth, openingW / 2 + bar / 2, 0, 0),
    box(openingW + 0.008, openingH + 0.008, 0.012, 0, 0, -0.026),
    box(0.46, 0.014, 0.2, 0, -openingH / 2 - bar + 0.02, -0.09, -0.2),
  ]
  const frameGeom = mergeGeometries(parts, false)
  frameGeom.computeVertexNormals()
  const frameMat = new THREE.MeshStandardMaterial({
    name: 'Frame',
    color: '#3c322b',
    roughness: 0.58,
    metalness: 0.04,
  })
  const frame = new THREE.Mesh(frameGeom, frameMat)
  frame.name = 'Frame'
  const root = new THREE.Group()
  root.name = 'PosterFrame'
  root.add(frame)

  const { mesh: tee, tris } = teeMesh()
  const outDir = process.argv[2] || 'public/models'
  mkdirSync(outDir, { recursive: true })
  await writeGlb(tee, `${outDir}/tee.glb`)
  await writeGlb(root, `${outDir}/frame.glb`)
  const frameTris = frameGeom.index ? frameGeom.index.count / 3 : frameGeom.getAttribute('position').count / 3
  console.log(JSON.stringify({ teeTris: tris, frameTris, outDir }))
}

function writeGlb(object, path) {
  const exporter = new GLTFExporter()
  return new Promise((resolve, reject) => {
    exporter.parse(
      object,
      (result) => {
        if (!(result instanceof ArrayBuffer)) {
          reject(new Error(`Expected ArrayBuffer for ${path}`))
          return
        }
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, Buffer.from(result))
        console.log('wrote', path, result.byteLength)
        resolve()
      },
      reject,
      { binary: true },
    )
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
