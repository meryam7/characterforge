import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { api } from '../lib/api'

/** Optional 3D "standee" preview: the transparent sprite is stacked in thin layers and can be dragged to rotate. */
export default function Preview3D({ designId }: { designId: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let objectUrl: string | null = null
    api
      .blob(`/api/designs/${designId}/export?format=transparent&preview=true`)
      .then((b) => {
        if (!alive) return
        objectUrl = URL.createObjectURL(b)
        setUrl(objectUrl)
      })
      .catch(() => {
        /* the canvas stays empty; the user can switch back */
      })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [designId])

  useEffect(() => {
    const el = ref.current
    if (!el || !url) return
    const w = el.clientWidth
    const h = el.clientHeight
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100)
    camera.position.set(0, 0.3, 6.5)
    const group = new THREE.Group()
    scene.add(group)

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.2, 0.12, 48),
      new THREE.MeshBasicMaterial({ color: 0x7c3aed }),
    )
    base.position.y = -1.2
    group.add(base)

    const geometries: THREE.BufferGeometry[] = [base.geometry]
    const materials: THREE.Material[] = [base.material as THREE.Material]
    let texture: THREE.Texture | null = null
    new THREE.TextureLoader().load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      texture = tex
      for (let i = 0; i < 6; i++) {
        const geo = new THREE.PlaneGeometry(1.5, 2.25)
        const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide })
        const plane = new THREE.Mesh(geo, mat)
        plane.position.set(0, 0, (i - 2.5) * 0.035)
        geometries.push(geo)
        materials.push(mat)
        group.add(plane)
      }
    })

    let dragging = false
    let lastX = 0
    let rotY = 0.4
    let raf = 0
    const down = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      rotY += (e.clientX - lastX) * 0.01
      lastX = e.clientX
    }
    const up = () => {
      dragging = false
    }
    renderer.domElement.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)

    const tick = () => {
      if (!dragging) rotY += 0.006
      group.rotation.y = rotY
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      renderer.domElement.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
      texture?.dispose()
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [url])

  return <div ref={ref} className="checker absolute inset-0 cursor-grab active:cursor-grabbing" />
}
