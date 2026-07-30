'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { WalkthroughStop } from './constants'
import type { RoomSurface } from '@/types/space'
import { type RoomStyle } from '@/lib/room-style'
import { useImageTexture } from '@/components/features/views/useImageTexture'
import {
  buildSurfaces,
  makeFloorGridTexture,
  surfaceColor,
  noRaycast,
  SURFACE_KEYS,
  type Surfaces,
  type Vec3,
} from '@/components/features/views/room-geometry'

const MARKER = 0.8 // ウォークスルーでは配置ビューより大きく見せる（近づいて眺めるため）
// 視点の遠さ（0=一人称で近い / 1=部屋の外から俯瞰）に応じた立ち位置
const NEAR_STANDOFF = 1.8
const FAR_STANDOFF = 7.0
// 0.5 を超えると部屋の外へ出て見下ろす（天井は邪魔なので消す）
const OVERHEAD_FROM = 0.5
const EYE_RATIO = 0.55 // 目線の高さ（部屋の高さに対する比）
const MOVE_MS = 900 // 点から点への移動時間
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

const surfaceOf = (s: WalkthroughStop): RoomSurface => s.surface ?? 'floor'

/** 点の面から、部屋の内側を向く法線を得る */
function inwardNormal(surface: RoomSurface): THREE.Vector3 {
  switch (surface) {
    case 'floor':
      return new THREE.Vector3(0, 1, 0)
    case 'ceiling':
      return new THREE.Vector3(0, -1, 0)
    case 'wall_north':
      return new THREE.Vector3(0, 0, 1)
    case 'wall_south':
      return new THREE.Vector3(0, 0, -1)
    case 'wall_east':
      return new THREE.Vector3(-1, 0, 0)
    default:
      return new THREE.Vector3(1, 0, 0)
  }
}

/**
 * ある点を見るときの「立ち位置」と「注視点」。
 *
 * 立ち位置は点の正面 STANDOFF だけ内側。ただし目線の高さは床からの一定比に固定し、
 * 部屋の壁にめり込まないよう内側へクランプする（歩いている感じを保つため）。
 */
function viewpointFor(
  stop: WalkthroughStop,
  surfaces: Surfaces,
  dims: { W: number; H: number; D: number },
  distance: number
): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const { W, H, D } = dims
  const t = clamp01(distance)
  const standoff = NEAR_STANDOFF + (FAR_STANDOFF - NEAR_STANDOFF) * t
  const overhead = t > OVERHEAD_FROM
  const surface = surfaceOf(stop)
  const def = surfaces[surface]
  const [px, py, pz] = def.pos(clamp01(stop.x ?? 0.5), clamp01(stop.y ?? 0.5))
  const look = new THREE.Vector3(px, py, pz)

  const pos = look.clone().add(inwardNormal(surface).multiplyScalar(standoff))

  if (surface === 'floor' || surface === 'ceiling') {
    // 床・天井の点は真上/真下からではなく、少し引いた位置から見下ろす／見上げる
    const toCenter = new THREE.Vector3(-look.x, 0, -look.z)
    if (toCenter.lengthSq() < 1e-6) toCenter.set(0, 0, 1)
    pos.copy(look).add(toCenter.normalize().multiplyScalar(standoff))
  }

  // 目線の高さ。遠ざけるほど高く上がり、途中から天井を越えて見下ろす
  const eyeY = -H / 2 + H * EYE_RATIO
  const overY = H / 2 + H * 0.9
  pos.y = overhead ? eyeY + (overY - eyeY) * ((t - OVERHEAD_FROM) / (1 - OVERHEAD_FROM)) : eyeY

  if (!overhead) {
    // 部屋の中にいる間は壁にめり込ませない
    const margin = 0.35
    pos.x = THREE.MathUtils.clamp(pos.x, -W / 2 + margin, W / 2 - margin)
    pos.z = THREE.MathUtils.clamp(pos.z, -D / 2 + margin, D / 2 - margin)
  }
  return { pos, look }
}

/** 部屋の面（内側から見える板）。ウォークスルーでは中にいるので不透明に描く */
function Surfaces3D({
  surfaces,
  style,
  floorTex,
  hideCeiling,
}: {
  surfaces: Surfaces
  style: RoomStyle
  floorTex: THREE.Texture
  hideCeiling: boolean
}) {
  return (
    <>
      {SURFACE_KEYS.map((surface) => {
        if (hideCeiling && surface === 'ceiling') return null
        const def = surfaces[surface]
        return (
          <mesh key={surface} position={def.position} rotation={def.rotation} raycast={noRaycast}>
            <planeGeometry args={def.size} />
            <meshStandardMaterial
              key={surface === 'floor' ? floorTex.uuid : 'flat'}
              map={surface === 'floor' ? floorTex : undefined}
              color={surface === 'floor' ? '#ffffff' : surfaceColor(surface, style)}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
    </>
  )
}

/** 点。現在地は少し大きく、縁取りを付ける */
function StopMarker({ stop, surfaces, active }: { stop: WalkthroughStop; surfaces: Surfaces; active: boolean }) {
  const tex = useImageTexture(stop.loci?.url ?? stop.card?.url ?? null)

  const def = surfaces[surfaceOf(stop)]
  const [px, py, pz] = def.pos(clamp01(stop.x ?? 0.5), clamp01(stop.y ?? 0.5))
  const position: Vec3 = [px + def.offset[0], py + def.offset[1], pz + def.offset[2]]
  const size = MARKER * (active ? 1.25 : 1)

  const rad = (deg: number) => ((deg ?? 0) * Math.PI) / 180
  const rot = stop.rotation

  return (
    <group position={position} rotation={def.rotation}>
      <group rotation={rot ? [rad(rot.x), rad(rot.y), rad(rot.z)] : [0, 0, 0]}>
      <mesh raycast={noRaycast}>
        <planeGeometry args={[size, size]} />
        {/* map の有無が変わるとシェーダーの再コンパイルが要る。key で作り直す */}
        <meshBasicMaterial
          key={tex ? tex.uuid : 'flat'}
          map={tex ?? undefined}
          color={tex ? '#ffffff' : '#c6a75e'}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {active && (
        <mesh position={[0, 0, -0.01]} raycast={noRaycast}>
          <planeGeometry args={[size * 1.12, size * 1.12]} />
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
      </group>
    </group>
  )
}

/**
 * カメラ。現在の点の立ち位置へ移動しながら、注視点も同時に補間する＝歩いて首を振る動き。
 * ドラッグ中はユーザーの見回し量（yaw/pitch）を足し、点が変わると 0 へ戻して進行方向を向き直る。
 */
function CameraRig({
  target,
  look,
  yaw,
  pitch,
}: {
  target: THREE.Vector3
  look: THREE.Vector3
  yaw: React.RefObject<number>
  pitch: React.RefObject<number>
}) {
  const { camera } = useThree()
  const from = useRef(new THREE.Vector3())
  const fromLook = useRef(new THREE.Vector3())
  const elapsed = useRef(MOVE_MS)
  const current = useRef(new THREE.Vector3())
  const currentLook = useRef(new THREE.Vector3())

  useEffect(() => {
    from.current.copy(current.current)
    fromLook.current.copy(currentLook.current)
    elapsed.current = 0
  }, [target, look])

  useFrame((_, delta) => {
    elapsed.current = Math.min(MOVE_MS, elapsed.current + delta * 1000)
    const t = easeInOut(elapsed.current / MOVE_MS)
    current.current.lerpVectors(from.current, target, t)
    currentLook.current.lerpVectors(fromLook.current, look, t)

    camera.position.copy(current.current)
    // 見回し（ドラッグ）は基準の視線方向に対する相対回転として足す
    const dir = currentLook.current.clone().sub(current.current)
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1)
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current)
    const right = dir.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()
    dir.applyAxisAngle(right, pitch.current)
    camera.lookAt(current.current.clone().add(dir))
  })

  return null
}

type Props = {
  stops: WalkthroughStop[]
  activeIndex: number
  style: RoomStyle
  dims: { width: number; height: number; depth: number }
  /** 視点の遠さ 0（近い一人称）〜1（部屋の外から俯瞰） */
  distance: number
}

export function WalkthroughRoom3D({ stops, activeIndex, style, dims, distance }: Props) {
  const d = useMemo(() => ({ W: dims.width, H: dims.height, D: dims.depth }), [dims.width, dims.height, dims.depth])
  const surfaces = useMemo(() => buildSurfaces(d.W, d.H, d.D), [d])
  const floorTex = useMemo(() => {
    const t = makeFloorGridTexture(style)
    t.repeat.set(Math.max(1, d.W), Math.max(1, d.D))
    return t
  }, [style, d])
  useEffect(() => () => floorTex.dispose(), [floorTex])

  const active = stops[activeIndex]
  const view = useMemo(
    () =>
      active
        ? viewpointFor(active, surfaces, d, distance)
        : { pos: new THREE.Vector3(0, 0, 0), look: new THREE.Vector3(0, 0, -1) },
    [active, surfaces, d, distance]
  )

  // 見回し（ドラッグ）。点が変わったら 0 に戻して進行方向へ向き直る
  const yaw = useRef(0)
  const pitch = useRef(0)
  useEffect(() => {
    yaw.current = 0
    pitch.current = 0
  }, [activeIndex])

  const onPointerDown = (e: React.PointerEvent) => {
    const sx = e.clientX
    const sy = e.clientY
    const y0 = yaw.current
    const p0 = pitch.current
    const onMove = (ev: PointerEvent) => {
      // 掴んだ方向へ景色が動く（写真を手で回す感覚）。逆にすると視点が動く感覚になる
      yaw.current = y0 + (ev.clientX - sx) * 0.005
      pitch.current = THREE.MathUtils.clamp(p0 + (ev.clientY - sy) * 0.004, -0.6, 0.6)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className="relative h-full w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing"
      style={{ backgroundColor: style.background }}
      onPointerDown={onPointerDown}
    >
      <Canvas dpr={[1, 1.75]} camera={{ fov: 60, near: 0.05 }}>
        <color attach="background" args={[style.background]} />
        <ambientLight intensity={1.05} />
        <directionalLight position={[3, 6, 4]} intensity={0.4} />
        <Surfaces3D surfaces={surfaces} style={style} floorTex={floorTex} hideCeiling={distance > OVERHEAD_FROM} />
        {stops.map((stop, i) => (
          <StopMarker key={stop.id} stop={stop} surfaces={surfaces} active={i === activeIndex} />
        ))}
        <CameraRig target={view.pos} look={view.look} yaw={yaw} pitch={pitch} />
      </Canvas>
      <span className="pointer-events-none absolute left-3 top-3 rounded bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
        ドラッグで見回す
      </span>
    </div>
  )
}
