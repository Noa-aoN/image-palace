'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Edges, Html } from '@react-three/drei'
import { Maximize2 } from 'lucide-react'
import { updateSpacePoint } from '@/lib/api/spaces'
import type { SpacePoint, RoomSurface } from '@/types/space'
import { type RoomStyle } from '@/lib/room-style'
import { pointImageUrl } from '@/lib/space-points'
import { isDoublePress, type PressRecord } from '@/lib/pointer-gestures'
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
const clampScale = (n: number) => Math.min(3, Math.max(0.3, n))

// 点マーカー: 面に貼られた正方形（loci 画像 or アクセント色）。選択中は縁取り。
function PointMarker({
  point,
  index,
  def,
  u,
  v,
  sizeScale,
  selected,
  onGrab,
  onOpen,
  onScaled,
  onScaleCommit,
  onInteracting,
}: {
  point: SpacePoint
  index: number
  def: SurfaceDef
  u: number
  v: number
  sizeScale: number
  selected: boolean
  onGrab: (id: string) => void
  onOpen: (id: string) => void
  onScaled: (id: string, scale: number) => void
  onScaleCommit: (id: string, scale: number) => void
  onInteracting: (value: boolean) => void
}) {
  const { camera, gl } = useThree()
  const url = pointImageUrl(point)
  // 直前に押した点と時刻（2回続けて押したか＝設定を開くかの判定に使う）
  const lastPressRef = useRef<PressRecord>(null)
  const tex = useImageTexture(url)


  const [px, py, pz] = def.pos(clamp01(u), clamp01(v))
  const position: Vec3 = [px + def.offset[0], py + def.offset[1], pz + def.offset[2]]
  const m = MARKER * sizeScale
  const grab = Math.max(m * 2, 0.9) // 掴みやすいよう当たり判定は大きめに

  const rad = (deg: number) => ((deg ?? 0) * Math.PI) / 180
  const [hovered, setHovered] = useState(false)
  const showHandle = hovered || selected

  // 拡大縮小（中心からの距離の比をそのまま倍率にする）。向きの調整は右パネルに集約している
  const startResize = (e: { clientX: number; clientY: number; stopPropagation: () => void }) => {
    e.stopPropagation()
    onInteracting(true)
    const rect = gl.domElement.getBoundingClientRect()
    const center = new THREE.Vector3(...position).project(camera)
    const cx = rect.left + ((center.x + 1) / 2) * rect.width
    const cy = rect.top + ((1 - center.y) / 2) * rect.height
    const distOf = (x: number, y: number) => Math.hypot(x - cx, y - cy) || 1
    const startDist = distOf(e.clientX, e.clientY)
    const base = point.scale ?? 1
    const next = (ev: PointerEvent) => clampScale(base * (distOf(ev.clientX, ev.clientY) / startDist))
    const onMove = (ev: PointerEvent) => onScaled(point.id, next(ev))
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const value = next(ev)
      onScaled(point.id, value)
      onScaleCommit(point.id, value)
      setTimeout(() => onInteracting(false), 0)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <group position={position} rotation={def.rotation}>
      {/* 選択中は縁取りの板を後ろに敷いて、どれを選んでいるか一目で分かるようにする */}
      {selected && (
        <mesh position={[0, 0, -0.004]} raycast={noRaycast}>
          <planeGeometry args={[m * 1.22, m * 1.22]} />
          <meshBasicMaterial color={ACCENT} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
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
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          // 2D と同じ約束。押しただけでは選ぶだけ、続けて2回押したら設定を開く
          if (isDoublePress(lastPressRef.current, point.id, e.nativeEvent.timeStamp)) {
            lastPressRef.current = null
            onOpen(point.id)
            return
          }
          lastPressRef.current = { id: point.id, at: e.nativeEvent.timeStamp }
          onGrab(point.id)
        }}
      >
        <planeGeometry args={[grab, grab]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* マーカーの上に置くつまみはサイズ変更だけにする。
          設定はマーカーの外（盤面の上の行）から開く。点は小さく数も多いので、
          ここに的を増やすと絵そのものが見えなくなる。
          （上下に分けて置くと、床の点は投影で潰れて重なるという問題もあった） */}
      {showHandle && (
        <Html position={[m / 2 + 0.12, -m / 2 - 0.12, 0.05]} center distanceFactor={11} zIndexRange={[20, 0]}>
          <div
            onPointerDown={startResize}
            title="ドラッグでサイズ変更"
            aria-label="サイズ変更"
            className="flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-full border-2 border-white shadow"
            style={{ backgroundColor: ACCENT }}
          >
            {/* 矢印の対角を左右反転して、右下ハンドルの引く向き（↖↘）に合わせる */}
            <Maximize2 size={10} strokeWidth={3} className="-scale-x-100 text-white" />
          </div>
        </Html>
      )}
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
  onOpen,
  dims,
  pointScale,
  style,
  onInteracting,
  onScaled,
}: {
  spaceId: string
  points: SpacePoint[]
  onMoved: (id: string, surface: RoomSurface, u: number, v: number) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpen: (id: string) => void
  dims: { W: number; H: number; D: number }
  pointScale: number
  style: RoomStyle
  onInteracting: (value: boolean) => void
  onScaled: (id: string, scale: number) => void
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
  // ドラッグ中は preview（ローカル）だけ更新して滑らかに。離した位置で親へ確定＝重い再描画を毎フレーム避ける。
  const [preview, setPreview] = useState<{ id: string; surface: RoomSurface; u: number; v: number } | null>(null)
  const last = useRef<{ id: string; surface: RoomSurface; u: number; v: number } | null>(null)
  const meshes = useRef<Partial<Record<RoomSurface, THREE.Mesh>>>({})
  const registerMesh = useCallback((s: RoomSurface, m: THREE.Mesh | null) => {
    if (m) meshes.current[s] = m
    else delete meshes.current[s]
  }, [])

  // ドラッグ処理。掴んだ時点で直接 window に登録する。
  // effect で後追い登録にすると、素早いクリックでは pointerup を取り逃す。
  //
  // なお、ドラッグ中にマーカーのレイキャストを切る実装にはしない。移動先の判定は
  // 面プレーンだけを対象にしているのでマーカーを外す必要が無く、
  // 切ってしまうと「掴み状態が解けない＝以後どの点も選べない」事故に直結するため。
  const stopDrag = useRef<(() => void) | null>(null)
  useEffect(() => () => stopDrag.current?.(), [])

  const grab = (id: string) => {
    onInteracting(true)
    onSelect(id)
    if (orbit.current) orbit.current.enabled = false

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
        const next = { id, surface: s, u: clamp01(u), v: clamp01(v) }
        last.current = next
        setPreview(next) // ローカルのみ（親は再描画しない）
        break
      }
    }
    const finish = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      stopDrag.current = null
      const d = last.current
      if (d) {
        onMoved(d.id, d.surface, d.u, d.v)
        updateSpacePoint(spaceId, d.id, { surface: d.surface, u: d.u, v: d.v }).catch(() => {})
      }
      last.current = null
      setPreview(null)
      if (orbit.current) orbit.current.enabled = true
      // onPointerMissed は同じ pointerup で先に走るため、解除は次のタスクまで遅らせる
      setTimeout(() => onInteracting(false), 0)
    }
    stopDrag.current = finish
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    // ウィンドウ外へ出た・OS に取り上げられた場合も確実に終わらせる
    window.addEventListener('pointercancel', finish)
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
            selected={point.id === selectedId}
            onGrab={grab}
            onOpen={onOpen}
            onScaled={onScaled}
            onScaleCommit={(id, scale) => {
              updateSpacePoint(spaceId, id, { scale }).catch(() => {})
            }}
            onInteracting={onInteracting}
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
  /** 選択の外部管理（向きの調整は右パネルで行うため、ページ側が選択を持つ） */
  selectedPointId?: string | null
  onSelectPoint?: (id: string | null) => void
  /** 設定を開く（ダブルクリック）。選ぶだけの onSelectPoint とは分ける */
  onOpenPoint?: (id: string) => void
  onScaled?: (id: string, scale: number) => void
}

// 3D の部屋ビュー。寸法(width/depth/height)から箱のアスペクトを作り、点を床・壁へドラッグ配置。
export function Room3D({
  spaceId,
  points,
  width,
  depth,
  height,
  pointScale,
  style,
  onMoved,
  selectedPointId,
  onSelectPoint,
  onOpenPoint,
  onScaled,
}: Room3DProps) {
  const [innerSelectedId, setInnerSelectedId] = useState<string | null>(null)
  const selectedId = selectedPointId !== undefined ? selectedPointId : innerSelectedId
  const applySelection = onSelectPoint ?? setInnerSelectedId

  // 点を掴んでいる間はマーカーのレイキャストを切っているため、離した瞬間の判定は
  // 必ず「何にも当たっていないクリック」になる。時間で見分けるとゆっくり押したときに
  // 解除されてしまうので、掴み操作中だったかどうかで判断する。
  const interacting = useRef(false)
  const setInteracting = useCallback((value: boolean) => {
    interacting.current = value
  }, [])
  const setSelectedId = applySelection
  // 設定を開く指示が無いとき（単体利用）は、選ぶだけにしておく
  const openPoint = useCallback(
    (id: string) => {
      if (onOpenPoint) onOpenPoint(id)
      else applySelection(id)
    },
    [onOpenPoint, applySelection]
  )
  const clearSelectionOnMiss = useCallback(() => {
    if (interacting.current) return
    applySelection(null)
  }, [applySelection])
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
        <Canvas dpr={[1, 1.75]} shadows={false} camera={{ position: startCamera, fov: 45 }} onPointerMissed={clearSelectionOnMiss}>
          <color attach="background" args={[style.background]} />
          <Scene spaceId={spaceId} points={points} onMoved={onMoved} selectedId={selectedId} onSelect={setSelectedId} onOpen={openPoint} dims={dims} pointScale={pointScale} style={style} onInteracting={setInteracting} onScaled={onScaled ?? (() => {})} />
        </Canvas>
      </div>
      {points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <p className="text-center text-sm text-muted-foreground">下の「ポイントを追加」で点を作り、部屋の床や壁へドラッグで配置しましょう。</p>
        </div>
      )}
    </div>
  )
}
