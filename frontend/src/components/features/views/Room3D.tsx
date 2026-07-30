'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Edges, Html } from '@react-three/drei'
import { updateSpacePoint } from '@/lib/api/spaces'
import type { SpacePoint, RoomSurface } from '@/types/space'

const EPS = 0.04 // 面から内側へわずかに浮かせて z-fighting を避ける
const MARKER = 0.55 // 点マーカー（正方形）の一辺（部屋のインテリア程度＝壁の小さな絵くらい）
const SCENE_MAX = 10 // 表示エリアの基準サイズ（この広さを一定に見せ、実寸で部屋を描く）
const ACCENT = '#7c6bb0'
const BLACKOUT_3D = '#171420' // 部屋の外（最大エリアのうち余分な部分）
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

type Vec3 = [number, number, number]
type SurfaceDef = {
  size: [number, number]
  position: Vec3
  rotation: Vec3
  offset: Vec3
  pos: (u: number, v: number) => Vec3
  uv: (p: THREE.Vector3) => { u: number; v: number }
}
type Surfaces = Record<RoomSurface, SurfaceDef>

const SURFACE_KEYS: RoomSurface[] = ['floor', 'ceiling', 'wall_north', 'wall_south', 'wall_east', 'wall_west']
const PLACEABLE_3D: RoomSurface[] = ['floor', 'wall_north', 'wall_east', 'wall_south', 'wall_west']
const surfaceColor = (s: RoomSurface) => (s === 'floor' ? '#e3dccb' : s === 'ceiling' ? '#efeadd' : '#f2eee4')
const noRaycast = () => {}

// 床の 1m グリッド（tex.repeat = 幅×奥行き で寸法に連動）。
function makeFloorGridTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#e3dccb'
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = 'rgba(124,107,176,0.45)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(128, 0)
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 128)
  ctx.stroke()
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// 部屋の寸法(W,H,D)から各面の幾何と (u,v) 変換を作る。v=0 は壁の上端/床の奥。
function buildSurfaces(W: number, H: number, D: number): Surfaces {
  const HW = W / 2
  const HH = H / 2
  const HD = D / 2
  return {
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
      pos: (u, v) => [-HW, (0.5 - v) * H, (0.5 - u) * D],
      uv: (p) => ({ u: 0.5 - p.z / D, v: 0.5 - p.y / H }),
    },
  }
}

// 点マーカー: 面に貼られた正方形（loci 画像 or アクセント色）。選択中は縁取り。
function PointMarker({
  point,
  index,
  def,
  u,
  v,
  sizeScale,
  dragging,
  selected,
  onGrab,
}: {
  point: SpacePoint
  index: number
  def: SurfaceDef
  u: number
  v: number
  sizeScale: number
  dragging: boolean
  selected: boolean
  onGrab: (id: string) => void
}) {
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
        setLoaded({ url, tex: t })
      },
      undefined,
      () => {}
    )
    return () => {
      alive = false
    }
  }, [url])

  const tex = loaded && loaded.url === url ? loaded.tex : null
  const [px, py, pz] = def.pos(clamp01(u), clamp01(v))
  const position: Vec3 = [px + def.offset[0], py + def.offset[1], pz + def.offset[2]]
  const m = MARKER * sizeScale
  const grab = Math.max(m * 2, 0.9) // 掴みやすいよう当たり判定は大きめに

  return (
    <group position={position} rotation={def.rotation}>
      {/* 見た目（小さめ・当たり判定は掴み面に任せる） */}
      <mesh raycast={noRaycast}>
        <planeGeometry args={[m, m]} />
        <meshBasicMaterial map={tex ?? undefined} color={tex ? '#ffffff' : ACCENT} side={THREE.DoubleSide} toneMapped={false} />
        {selected && <Edges color={ACCENT} lineWidth={3} />}
      </mesh>
      {/* 掴み判定（透明・少し大きめ） */}
      <mesh
        position={[0, 0, 0.002]}
        raycast={dragging ? noRaycast : undefined}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          onGrab(point.id)
        }}
      >
        <planeGeometry args={[grab, grab]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[-m / 2, m / 2, 0.06]} center distanceFactor={11} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow" style={{ backgroundColor: ACCENT }}>
          {index + 1}
        </span>
      </Html>
    </group>
  )
}

// 部屋の1面（内側から見える板）。手前の壁は透明化。
function SurfacePlane({ surface, def, map, registerMesh }: { surface: RoomSurface; def: SurfaceDef; map?: THREE.Texture; registerMesh: (s: RoomSurface, m: THREE.Mesh | null) => void }) {
  const isWall = surface.startsWith('wall_')
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const outward = useMemo(() => new THREE.Vector3(...def.position).normalize(), [def.position])
  const dist = useMemo(() => new THREE.Vector3(...def.position).length(), [def.position])

  useFrame((state) => {
    if (!isWall || !matRef.current) return
    const near = state.camera.position.dot(outward) - dist > 0
    const target = near ? 0.05 : 0.5
    matRef.current.opacity += (target - matRef.current.opacity) * 0.15
  })

  return (
    <mesh position={def.position} rotation={def.rotation} userData={{ surface }} ref={(m) => registerMesh(surface, m)}>
      <planeGeometry args={def.size} />
      <meshStandardMaterial
        ref={matRef}
        map={map}
        color={map ? '#ffffff' : surfaceColor(surface)}
        side={THREE.DoubleSide}
        transparent
        depthWrite={!isWall}
        opacity={isWall ? 0.3 : surface === 'ceiling' ? 0.12 : 1}
      />
    </mesh>
  )
}

// 各壁の方位ラベル（◈北面 …）。壁の上部に常にカメラ向きで表示。
function WallLabels({ surfaces }: { surfaces: Surfaces }) {
  const labels: { surface: RoomSurface; text: string }[] = [
    { surface: 'wall_north', text: '北' },
    { surface: 'wall_south', text: '南' },
    { surface: 'wall_east', text: '東' },
    { surface: 'wall_west', text: '西' },
  ]
  return (
    <>
      {labels.map((w) => {
        const [x, y, z] = surfaces[w.surface].position
        // 壁の少し外側・低めに、視界を邪魔しない小さな半透明ラベル
        const out = new THREE.Vector3(x, 0, z).normalize().multiplyScalar(0.7)
        return (
          <Html
            key={w.surface}
            position={[x + out.x, y - Math.abs(y) * 0.4 - 0.3, z + out.z]}
            center
            distanceFactor={26}
            zIndexRange={[8, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span className="whitespace-nowrap rounded bg-slate-700/35 px-1 py-px text-[9px] font-medium tracking-wide text-white/80">
              {w.text}
            </span>
          </Html>
        )
      })}
    </>
  )
}

function Scene({
  spaceId,
  points,
  onMoved,
  selectedId,
  onSelect,
  dims,
  pointScale,
}: {
  spaceId: string
  points: SpacePoint[]
  onMoved: (id: string, surface: RoomSurface, u: number, v: number) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  dims: { W: number; H: number; D: number }
  pointScale: number
}) {
  const { W, H, D } = dims
  const surfaces = useMemo(() => buildSurfaces(W, H, D), [W, H, D])
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)), [W, H, D])
  const floorTexRef = useRef<THREE.CanvasTexture | null>(null)
  floorTexRef.current ??= makeFloorGridTexture()
  const floorTex = floorTexRef.current
  useEffect(() => {
    floorTex.repeat.set(Math.max(1, W), Math.max(1, D)) // 1m グリッド（寸法連動）
    floorTex.needsUpdate = true
  }, [floorTex, W, D])
  const { camera, gl, raycaster } = useThree()
  const orbit = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  // ドラッグ中は preview（ローカル）だけ更新して滑らかに。離した位置で親へ確定＝重い再描画を毎フレーム避ける。
  const [preview, setPreview] = useState<{ id: string; surface: RoomSurface; u: number; v: number } | null>(null)
  const last = useRef<{ id: string; surface: RoomSurface; u: number; v: number } | null>(null)
  const meshes = useRef<Partial<Record<RoomSurface, THREE.Mesh>>>({})
  const registerMesh = useCallback((s: RoomSurface, m: THREE.Mesh | null) => {
    if (m) meshes.current[s] = m
    else delete meshes.current[s]
  }, [])

  // ドラッグ中は window の pointermove/up で処理（hover 非依存で安定）。
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
        const { u, v } = surfaces[s].uv(hit.point)
        const next = { id: dragId, surface: s, u: clamp01(u), v: clamp01(v) }
        last.current = next
        setPreview(next) // ローカルのみ（親は再描画しない）
        break
      }
    }
    const onUp = () => {
      const d = last.current
      if (d) {
        onMoved(d.id, d.surface, d.u, d.v)
        updateSpacePoint(spaceId, d.id, { surface: d.surface, u: d.u, v: d.v }).catch(() => {})
      }
      last.current = null
      setPreview(null)
      setDragId(null)
      if (orbit.current) orbit.current.enabled = true
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragId, camera, gl, raycaster, spaceId, onMoved, surfaces])

  const grab = (id: string) => {
    setDragId(id)
    onSelect(id)
    if (orbit.current) orbit.current.enabled = false
  }

  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[8, 13, 6]} intensity={0.55} />
      <OrbitControls ref={orbit} target={[0, 0, 0]} enablePan={false} minDistance={SCENE_MAX * 0.8} maxDistance={SCENE_MAX * 2.6} maxPolarAngle={Math.PI * 0.49} />
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={ACCENT} transparent opacity={0.55} />
      </lineSegments>
      {/* 最大表示エリア（ブラックアウト）。実床（グリッド付き）はこの上に実寸で描かれる */}
      <mesh position={[0, -H / 2 - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SCENE_MAX, SCENE_MAX]} />
        <meshBasicMaterial color={BLACKOUT_3D} />
      </mesh>
      <WallLabels surfaces={surfaces} />
      {SURFACE_KEYS.map((surface) => (
        <SurfacePlane key={surface} surface={surface} def={surfaces[surface]} map={surface === 'floor' ? floorTex : undefined} registerMesh={registerMesh} />
      ))}
      {points.map((point, i) => {
        const eff =
          preview && preview.id === point.id
            ? preview
            : { surface: point.surface ?? 'floor', u: point.u ?? 0.5, v: point.v ?? 0.5 }
        return (
          <PointMarker
            key={point.id}
            point={point}
            index={i}
            def={surfaces[eff.surface]}
            u={eff.u}
            v={eff.v}
            sizeScale={pointScale * (point.scale ?? 1)}
            dragging={!!dragId}
            selected={point.id === selectedId}
            onGrab={grab}
          />
        )
      })}
    </>
  )
}

type Room3DProps = {
  spaceId: string
  points: SpacePoint[]
  width: number
  depth: number
  height: number
  pointScale: number
  onMoved: (id: string, surface: RoomSurface, u: number, v: number) => void
}

// 3D の部屋ビュー。寸法(width/depth/height)から箱のアスペクトを作り、点を床・壁へドラッグ配置。
export function Room3D({ spaceId, points, width, depth, height, pointScale, onMoved }: Room3DProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 実寸（1m = 1unit）。各寸法が独立に反映され、幅を変えても高さは変わらない。
  const dims = { W: width, H: height, D: depth }

  return (
    <div
      className="relative h-[60vh] w-full overflow-hidden rounded-xl border-2"
      style={{ borderColor: 'color-mix(in srgb, var(--palace) 40%, transparent)', backgroundColor: 'var(--ivory-dark)' }}
    >
      <Canvas shadows={false} camera={{ position: [0, 15, 7], fov: 45 }} onPointerMissed={() => setSelectedId(null)}>
        <color attach="background" args={['#f6f2e9']} />
        <Scene spaceId={spaceId} points={points} onMoved={onMoved} selectedId={selectedId} onSelect={setSelectedId} dims={dims} pointScale={pointScale} />
      </Canvas>
      {points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <p className="text-center text-sm text-muted-foreground">下の「ポイントを追加」で点を作り、部屋の床や壁へドラッグで配置しましょう。</p>
        </div>
      )}
    </div>
  )
}
