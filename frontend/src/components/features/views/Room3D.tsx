'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Edges, Html } from '@react-three/drei'
import { updateSpacePoint } from '@/lib/api/spaces'
import type { SpacePoint, RoomSurface } from '@/types/space'

// 部屋（箱型）の寸法。床/天井=W×D、南北壁=W×H、東西壁=D×H。
const W = 10
const H = 7
const D = 10
const HW = W / 2
const HH = H / 2
const HD = D / 2
const EPS = 0.04 // 面から内側へわずかに浮かせて z-fighting を避ける
const MARKER = 1.4 // 点マーカー（正方形）の一辺

const ACCENT = '#7c6bb0' // palace 相当のアクセント（テーマ化は後段）
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

type Vec3 = [number, number, number]
type SurfaceDef = {
  size: [number, number]
  position: Vec3
  rotation: Vec3
  offset: Vec3 // 内向き法線 * EPS
  pos: (u: number, v: number) => Vec3 // (u,v)∈[0,1] → 面上の3D座標
  uv: (p: THREE.Vector3) => { u: number; v: number } // 面上の3D交点 → (u,v)
}

// 各面の幾何と (u,v) 変換。v=0 は壁の上端/床の奥、v=1 は下端/手前。
const SURFACES: Record<RoomSurface, SurfaceDef> = {
  floor: {
    size: [W, D],
    position: [0, -HH, 0],
    rotation: [-Math.PI / 2, 0, 0],
    offset: [0, EPS, 0],
    pos: (u, v) => [(u - 0.5) * W, -HH, (v - 0.5) * D],
    uv: (p) => ({ u: p.x / W + 0.5, v: p.z / D + 0.5 }),
  },
  ceiling: {
    size: [W, D],
    position: [0, HH, 0],
    rotation: [Math.PI / 2, 0, 0],
    offset: [0, -EPS, 0],
    pos: (u, v) => [(u - 0.5) * W, HH, (v - 0.5) * D],
    uv: (p) => ({ u: p.x / W + 0.5, v: p.z / D + 0.5 }),
  },
  wall_north: {
    size: [W, H],
    position: [0, 0, -HD],
    rotation: [0, 0, 0],
    offset: [0, 0, EPS],
    pos: (u, v) => [(u - 0.5) * W, (0.5 - v) * H, -HD],
    uv: (p) => ({ u: p.x / W + 0.5, v: 0.5 - p.y / H }),
  },
  wall_south: {
    size: [W, H],
    position: [0, 0, HD],
    rotation: [0, Math.PI, 0],
    offset: [0, 0, -EPS],
    // 内側から正対したとき左右が 2D と一致するよう u を反転
    pos: (u, v) => [(0.5 - u) * W, (0.5 - v) * H, HD],
    uv: (p) => ({ u: 0.5 - p.x / W, v: 0.5 - p.y / H }),
  },
  wall_east: {
    size: [D, H],
    position: [HW, 0, 0],
    rotation: [0, -Math.PI / 2, 0],
    offset: [-EPS, 0, 0],
    pos: (u, v) => [HW, (0.5 - v) * H, (u - 0.5) * D],
    uv: (p) => ({ u: p.z / D + 0.5, v: 0.5 - p.y / H }),
  },
  wall_west: {
    size: [D, H],
    position: [-HW, 0, 0],
    rotation: [0, Math.PI / 2, 0],
    offset: [EPS, 0, 0],
    // 内側から正対したとき左右が 2D と一致するよう u を反転
    pos: (u, v) => [-HW, (0.5 - v) * H, (0.5 - u) * D],
    uv: (p) => ({ u: 0.5 - p.z / D, v: 0.5 - p.y / H }),
  },
}

const SURFACE_KEYS = Object.keys(SURFACES) as RoomSurface[]
// ドラッグ配置の対象面（天井は除外）
const PLACEABLE_3D: RoomSurface[] = ['floor', 'wall_north', 'wall_east', 'wall_south', 'wall_west']
const surfaceColor = (s: RoomSurface) => (s === 'floor' ? '#e3dccb' : s === 'ceiling' ? '#efeadd' : '#f2eee4')
const noRaycast = () => {}

// 点マーカー: 面に貼られた正方形（loci 画像 or アクセント色）。選択中は縁取り。
function PointMarker({
  point,
  index,
  dragging,
  selected,
  onGrab,
}: {
  point: SpacePoint
  index: number
  dragging: boolean
  selected: boolean
  onGrab: (id: string) => void
}) {
  const def = SURFACES[point.surface ?? 'floor']
  const [loaded, setLoaded] = useState<{ url: string; tex: THREE.Texture } | null>(null)
  const url = point.image?.thumb_url ?? point.image?.url ?? point.item?.media?.thumb_url ?? point.item?.media?.url ?? null

  useEffect(() => {
    if (!url) return
    let alive = true
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      url,
      (t) => {
        if (!alive) return
        t.colorSpace = THREE.SRGBColorSpace
        setLoaded({ url, tex: t }) // 状態更新は非同期コールバック内のみ
      },
      undefined,
      () => {} // 読込失敗（CORS 等）はアクセント色にフォールバック
    )
    return () => {
      alive = false
    }
  }, [url])

  // url が変わった/無い間は null（新しい画像の読込完了まではフォールバック色）
  const tex = loaded && loaded.url === url ? loaded.tex : null

  const [px, py, pz] = def.pos(clamp01(point.u ?? 0.5), clamp01(point.v ?? 0.5))
  const position: Vec3 = [px + def.offset[0], py + def.offset[1], pz + def.offset[2]]

  return (
    <mesh
      position={position}
      rotation={def.rotation}
      raycast={dragging ? noRaycast : undefined}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        onGrab(point.id)
      }}
    >
      <planeGeometry args={[MARKER, MARKER]} />
      <meshBasicMaterial map={tex ?? undefined} color={tex ? '#ffffff' : ACCENT} side={THREE.DoubleSide} toneMapped={false} />
      {selected && <Edges color={ACCENT} lineWidth={3} />}
      {/* ポイント番号（常に手前・カメラ向き） */}
      <Html position={[-MARKER / 2, MARKER / 2, 0.06]} center distanceFactor={11} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow"
          style={{ backgroundColor: ACCENT }}
        >
          {index + 1}
        </span>
      </Html>
    </mesh>
  )
}

// 部屋の1面（内側から見える板）。ドラッグ中はこの面上の交点から (u,v) を計算して点を動かす。
function SurfacePlane({ surface, registerMesh }: { surface: RoomSurface; registerMesh: (s: RoomSurface, m: THREE.Mesh | null) => void }) {
  const def = SURFACES[surface]
  const isWall = surface.startsWith('wall_')
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  // 壁の外向き方向と中心までの距離（カメラが外側にある＝手前の壁 → 透明化）。
  const outward = useMemo(() => new THREE.Vector3(...def.position).normalize(), [def.position])
  const dist = useMemo(() => new THREE.Vector3(...def.position).length(), [def.position])

  useFrame((state) => {
    if (!isWall || !matRef.current) return
    const near = state.camera.position.dot(outward) - dist > 0 // カメラが壁の外側＝手前の壁
    const target = near ? 0.05 : 0.5
    matRef.current.opacity += (target - matRef.current.opacity) * 0.15
  })

  return (
    <mesh position={def.position} rotation={def.rotation} userData={{ surface }} ref={(m) => registerMesh(surface, m)}>
      <planeGeometry args={def.size} />
      <meshStandardMaterial
        ref={matRef}
        color={surfaceColor(surface)}
        side={THREE.DoubleSide} // 両面から見え・レイキャストが当たるように
        transparent
        depthWrite={!isWall} // 透明な壁は奥のポイントを隠さない
        opacity={isWall ? 0.3 : surface === 'ceiling' ? 0.12 : 1}
      />
    </mesh>
  )
}

// 各壁の方位ラベル（北/東/南/西）。壁の上部に常にカメラ向きで表示。
const WALL_LABELS: { surface: RoomSurface; text: string; position: Vec3 }[] = [
  { surface: 'wall_north', text: '北', position: [0, HH * 0.72, -HD + 0.15] },
  { surface: 'wall_south', text: '南', position: [0, HH * 0.72, HD - 0.15] },
  { surface: 'wall_east', text: '東', position: [HW - 0.15, HH * 0.72, 0] },
  { surface: 'wall_west', text: '西', position: [-HW + 0.15, HH * 0.72, 0] },
]

function WallLabels() {
  return (
    <>
      {WALL_LABELS.map((w) => (
        <Html key={w.surface} position={w.position} center distanceFactor={16} zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
          {/* ポイントの丸バッジと混同しないよう、方位は「面」付きの角丸ラベル（枠線・別色） */}
          <span className="flex items-center gap-0.5 whitespace-nowrap rounded border border-white/50 bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-widest text-white backdrop-blur-sm">
            <span className="text-slate-300">◈</span>
            {w.text}面
          </span>
        </Html>
      ))}
    </>
  )
}

function Scene({
  spaceId,
  points,
  onMoved,
  selectedId,
  onSelect,
}: {
  spaceId: string
  points: SpacePoint[]
  onMoved: (id: string, surface: RoomSurface, u: number, v: number) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const { camera, gl, raycaster } = useThree()
  const orbit = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const last = useRef<{ id: string; surface: RoomSurface; u: number; v: number } | null>(null)
  const meshes = useRef<Partial<Record<RoomSurface, THREE.Mesh>>>({})
  const registerMesh = useCallback((s: RoomSurface, m: THREE.Mesh | null) => {
    if (m) meshes.current[s] = m
    else delete meshes.current[s]
  }, [])
  // 部屋の稜線（12辺）。床・壁・天井の境界をはっきり見せる。
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)), [])

  // ドラッグ中は window の pointermove/up で処理（mesh の hover に依存せず安定させる）。
  // カーソル位置からレイキャストして「見えている配置面（手前の透明壁は除外）」へ点を移す。
  useEffect(() => {
    if (!dragId) return
    const ndc = new THREE.Vector2()
    const onMove = (ev: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const list = PLACEABLE_3D.map((s) => meshes.current[s]).filter((m): m is THREE.Mesh => Boolean(m))
      for (const hit of raycaster.intersectObjects(list, false)) {
        const obj = hit.object as THREE.Mesh
        const s = obj.userData.surface as RoomSurface | undefined
        if (!s) continue
        const mat = obj.material as THREE.MeshStandardMaterial
        if (mat.transparent && mat.opacity < 0.15) continue // 手前の透明壁はスキップ
        const { u, v } = SURFACES[s].uv(hit.point)
        const cu = clamp01(u)
        const cv = clamp01(v)
        last.current = { id: dragId, surface: s, u: cu, v: cv }
        onMoved(dragId, s, cu, cv)
        break
      }
    }
    const onUp = () => {
      const d = last.current
      if (d) updateSpacePoint(spaceId, d.id, { surface: d.surface, u: d.u, v: d.v }).catch(() => {})
      last.current = null
      setDragId(null)
      if (orbit.current) orbit.current.enabled = true
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragId, camera, gl, raycaster, spaceId, onMoved])

  const grab = (id: string) => {
    setDragId(id)
    onSelect(id)
    if (orbit.current) orbit.current.enabled = false
  }

  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[8, 13, 6]} intensity={0.55} />
      <OrbitControls
        ref={orbit}
        target={[0, 0, 0]}
        enablePan={false}
        minDistance={8}
        maxDistance={26}
        maxPolarAngle={Math.PI * 0.49}
      />
      {/* 部屋の稜線（床・壁・天井の境界を強調） */}
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={ACCENT} transparent opacity={0.55} />
      </lineSegments>
      {/* 床グリッド（床面を明示） */}
      <gridHelper args={[W, 10, ACCENT, '#d8cfb8']} position={[0, -HH + 0.02, 0]} />
      <WallLabels />
      {SURFACE_KEYS.map((surface) => (
        <SurfacePlane key={surface} surface={surface} registerMesh={registerMesh} />
      ))}
      {points.map((point, i) => (
        <PointMarker
          key={point.id}
          point={point}
          index={i}
          dragging={!!dragId}
          selected={point.id === selectedId}
          onGrab={grab}
        />
      ))}
    </>
  )
}

type Room3DProps = {
  spaceId: string
  points: SpacePoint[]
  onMoved: (id: string, surface: RoomSurface, u: number, v: number) => void
}

// 3D の部屋ビュー。オービットで部屋を回して眺め、点をドラッグで床・壁・天井に配置する。
export function Room3D({ spaceId, points, onMoved }: Room3DProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  return (
    <div
      className="relative h-[60vh] w-full overflow-hidden rounded-xl border-2"
      style={{ borderColor: 'color-mix(in srgb, var(--palace) 40%, transparent)', backgroundColor: 'var(--ivory-dark)' }}
    >
      <Canvas
        shadows={false}
        camera={{ position: [0, 17, 5], fov: 45 }} // 俯瞰（真上寄り）から開始
        onPointerMissed={() => setSelectedId(null)}
      >
        <color attach="background" args={['#f6f2e9']} />
        <Scene spaceId={spaceId} points={points} onMoved={onMoved} selectedId={selectedId} onSelect={setSelectedId} />
      </Canvas>
      {points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <p className="text-center text-sm text-muted-foreground">
            下の「ポイントを追加」で点を作り、部屋の床や壁へドラッグで配置しましょう。
          </p>
        </div>
      )}
    </div>
  )
}
