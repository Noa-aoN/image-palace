'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Edges, Html } from '@react-three/drei'
import { updateSpacePoint } from '@/lib/api/spaces'
import type { SpacePoint, RoomSurface } from '@/types/space'
import { type RoomStyle } from '@/lib/room-style'
import { pointImageUrl } from '@/lib/space-points'
import { useImageTexture } from './useImageTexture'
import {
  buildSurfaces,
  makeFloorGridTexture,
  surfaceColor,
  noRaycast,
  SURFACE_KEYS,
  PLACEABLE_3D,
  type Vec3,
  type SurfaceDef,
  type Surfaces,
} from './room-geometry'

const MARKER = 0.55 // 点マーカー（正方形）の一辺（部屋のインテリア程度＝壁の小さな絵くらい）
// 部屋の大きさから初期カメラ距離を決める（小さい部屋でも画面いっぱいに見えるように）。
// 対角の長さに掛ける係数。大きいほど引いた絵になる。
const START_ZOOM = 1.15
const roomReach = (W: number, H: number, D: number) => Math.sqrt(W * W + H * H + D * D)
// 点マーカーのアクセント。2D（var(--palace)）と同じ色にして、切り替えても点の見え方を揃える
const ACCENT = '#c6a75e'
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

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
  const url = pointImageUrl(point)
  const tex = useImageTexture(url)


  const [px, py, pz] = def.pos(clamp01(u), clamp01(v))
  const position: Vec3 = [px + def.offset[0], py + def.offset[1], pz + def.offset[2]]
  const m = MARKER * sizeScale
  const grab = Math.max(m * 2, 0.9) // 掴みやすいよう当たり判定は大きめに

  const rad = (deg: number) => ((deg ?? 0) * Math.PI) / 180

  return (
    <group position={position} rotation={def.rotation}>
      {/* 面の向きの内側で画像だけを回す（x/y は傾き、z は面内の回転） */}
      <group rotation={[rad(point.rotation_x), rad(point.rotation_y), rad(point.rotation_z)]}>
      {/* 見た目（小さめ・当たり判定は掴み面に任せる） */}
      <mesh raycast={noRaycast}>
        <planeGeometry args={[m, m]} />
        {/* map の有無が変わるとシェーダーの再コンパイルが要る。key で作り直す */}
        <meshBasicMaterial
          key={tex ? tex.uuid : 'flat'}
          map={tex ?? undefined}
          color={tex ? '#ffffff' : ACCENT}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
        {selected && <Edges color={ACCENT} lineWidth={3} />}
      </mesh>
      </group>
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
function SurfacePlane({ surface, def, map, style, registerMesh }: { surface: RoomSurface; def: SurfaceDef; map?: THREE.Texture; style: RoomStyle; registerMesh: (s: RoomSurface, m: THREE.Mesh | null) => void }) {
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
        key={map ? map.uuid : 'flat'}
        ref={matRef}
        map={map}
        color={map ? '#ffffff' : surfaceColor(surface, style)}
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
  style,
}: {
  spaceId: string
  points: SpacePoint[]
  onMoved: (id: string, surface: RoomSurface, u: number, v: number) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  dims: { W: number; H: number; D: number }
  pointScale: number
  style: RoomStyle
}) {
  const { W, H, D } = dims
  const reach = roomReach(W, H, D)
  const surfaces = useMemo(() => buildSurfaces(W, H, D), [W, H, D])
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)), [W, H, D])
  // スタイル（床色・グリッド）と寸法からテクスチャを作る。
  // repeat は生成時に決める（作成後に書き換えると hooks の不変ルールに触れるため）。
  const floorTex = useMemo(() => {
    const t = makeFloorGridTexture(style)
    t.repeat.set(Math.max(1, W), Math.max(1, D)) // 1m グリッド（寸法連動）
    return t
  }, [style, W, D])
  // 作り直したら前のテクスチャは GPU から解放する
  useEffect(() => () => floorTex.dispose(), [floorTex])
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
      <OrbitControls
        ref={orbit}
        target={[0, 0, 0]}
        enablePan={false}
        minDistance={reach * 0.5}
        maxDistance={reach * 2.6}
        maxPolarAngle={Math.PI * 0.49}
      />
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={style.edge} transparent opacity={0.55} />
      </lineSegments>
      <WallLabels surfaces={surfaces} />
      {SURFACE_KEYS.map((surface) => (
        <SurfacePlane key={surface} surface={surface} def={surfaces[surface]} map={surface === 'floor' ? floorTex : undefined} style={style} registerMesh={registerMesh} />
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
  style: RoomStyle
  onMoved: (id: string, surface: RoomSurface, u: number, v: number) => void
  onRotated?: (id: string, axis: 'x' | 'y' | 'z', deg: number) => void
}

// 3D の部屋ビュー。寸法(width/depth/height)から箱のアスペクトを作り、点を床・壁へドラッグ配置。
export function Room3D({ spaceId, points, width, depth, height, pointScale, style, onMoved, onRotated }: Room3DProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedPoint = points.find((p) => p.id === selectedId) ?? null
  // 実寸（1m = 1unit）。各寸法が独立に反映され、幅を変えても高さは変わらない。
  const dims = { W: width, H: height, D: depth }
  // 部屋の大きさに合わせた俯瞰スタート位置（小さい部屋でも寄って見える）
  const startCamera = useMemo<[number, number, number]>(() => {
    const dist = roomReach(width, height, depth) * START_ZOOM
    return [0, dist * 0.82, dist * 0.58]
  }, [width, height, depth])

  return (
    <div
      className="relative h-[60vh] w-full overflow-hidden rounded-xl border-2"
      style={{ borderColor: `color-mix(in srgb, ${style.edge} 40%, transparent)`, backgroundColor: style.background }}
    >
      {/*
        R3F はキャンバスの「親要素」にネイティブのリスナーを張り、そこで拾った
        ポインタ操作のうち何にも当たらなかったものを onPointerMissed として扱う。
        パネルを同じ親の下に置くと、パネルのクリックが「外し」と判定されて選択が解除される。
        （React の stopPropagation はネイティブのリスナーより後に走るので効かない）
        そのため、キャンバス専用のホストで包んでパネルと兄弟にしている。
      */}
      <div className="absolute inset-0">
        <Canvas dpr={[1, 1.75]} shadows={false} camera={{ position: startCamera, fov: 45 }} onPointerMissed={() => setSelectedId(null)}>
          <color attach="background" args={[style.background]} />
          <Scene spaceId={spaceId} points={points} onMoved={onMoved} selectedId={selectedId} onSelect={setSelectedId} dims={dims} pointScale={pointScale} style={style} />
        </Canvas>
      </div>
      {/* 選択中の点の回転（3軸）。3D は面の向きがあるので、傾きもここで調整する */}
      {selectedPoint && onRotated && (
        <div className="absolute bottom-3 left-3 z-10 w-56 rounded-lg border border-border bg-card/85 p-2.5 shadow backdrop-blur">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="truncate text-xs font-medium">{selectedPoint.name || '未命名'} の向き</span>
            <button
              type="button"
              onClick={() => {
                onRotated(selectedPoint.id, 'x', 0)
                onRotated(selectedPoint.id, 'y', 0)
                onRotated(selectedPoint.id, 'z', 0)
                updateSpacePoint(spaceId, selectedPoint.id, { rotation_x: 0, rotation_y: 0, rotation_z: 0 }).catch(() => {})
              }}
              className="text-[11px] text-muted-foreground underline hover:text-foreground"
            >
              戻す
            </button>
          </div>
          {(['x', 'y', 'z'] as const).map((axis) => {
            const value =
              axis === 'x' ? selectedPoint.rotation_x : axis === 'y' ? selectedPoint.rotation_y : selectedPoint.rotation_z
            const label = axis === 'x' ? '縦の傾き' : axis === 'y' ? '横の傾き' : '面内の回転'
            return (
              <label key={axis} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="w-14 shrink-0">{label}</span>
                <input
                  type="range"
                  min={-180}
                  max={179}
                  step={1}
                  value={value ?? 0}
                  onChange={(e) => onRotated(selectedPoint.id, axis, Number(e.target.value))}
                  onPointerUp={(e) =>
                    updateSpacePoint(spaceId, selectedPoint.id, {
                      [`rotation_${axis}`]: Number((e.target as HTMLInputElement).value),
                    }).catch(() => {})
                  }
                  className="flex-1 accent-[var(--palace)]"
                  aria-label={`${label}（度）`}
                />
                <span className="w-9 shrink-0 text-right tabular-nums">{Math.round(value ?? 0)}°</span>
              </label>
            )
          })}
        </div>
      )}
      {points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <p className="text-center text-sm text-muted-foreground">下の「ポイントを追加」で点を作り、部屋の床や壁へドラッグで配置しましょう。</p>
        </div>
      )}
    </div>
  )
}
