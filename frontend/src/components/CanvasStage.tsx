import type { KonvaEventObject } from 'konva/lib/Node'
import { useEffect, useRef, useState } from 'react'
import { Circle, Image as KImage, Layer, Stage } from 'react-konva'
import useImage from 'use-image'
import type { Point } from '../lib/types'

type Props = {
  imageUrl: string | null
  overlayUrl: string | null
  points: Point[]
  editMode: boolean
  pointPositive: boolean
  onAddPoint: (p: Point) => void
}

export default function CanvasStage({ imageUrl, overlayUrl, points, editMode, pointPositive, onAddPoint }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 600, h: 700 })
  const [img] = useImage(imageUrl ?? '', 'anonymous')
  const [overlay] = useImage(overlayUrl ?? '', 'anonymous')

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = img ? Math.min(size.w / img.width, size.h / img.height) * 0.96 : 1
  const dw = img ? img.width * scale : 0
  const dh = img ? img.height * scale : 0
  const ox = (size.w - dw) / 2
  const oy = (size.h - dh) / 2

  const handleClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!editMode || !img) return
    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return
    const x = (pos.x - ox) / scale
    const y = (pos.y - oy) / scale
    if (x < 0 || y < 0 || x > img.width || y > img.height) return
    onAddPoint({ x, y, positive: pointPositive })
  }

  return (
    <div ref={wrap} className="checker absolute inset-0" style={{ cursor: editMode ? 'crosshair' : 'default' }}>
      <Stage width={size.w} height={size.h} onClick={handleClick} onTap={handleClick}>
        <Layer>
          {img && <KImage image={img} x={ox} y={oy} width={dw} height={dh} />}
          {overlay && <KImage image={overlay} x={ox} y={oy} width={dw} height={dh} listening={false} />}
          {points.map((p, i) => (
            <Circle
              key={i}
              x={ox + p.x * scale}
              y={oy + p.y * scale}
              radius={7}
              fill={p.positive ? '#4ade80' : '#f87171'}
              stroke="#ffffff"
              strokeWidth={2}
              listening={false}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}
