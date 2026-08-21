import {
  DoorOpen,
  LibraryBig,
  GalleryHorizontal,
  LayoutDashboard,
  Box,
  LayoutGrid,
  Frame,
  GraduationCap,
  Layers,
  HelpCircle,
  Gamepad2,
  BarChart3,
  Palette,
  Boxes,
  List,
  Search,
  Tag,
  Wand2,
  Store,
  Swords,
  CreditCard,
  UserCog,
  Settings,
  Crown,
  House,
  BookOpen,
  Newspaper,
  Megaphone,
  ShieldCheck,
  Compass,
  Hammer,
  Package,
} from 'lucide-react'
import { CreateIcon } from './CreateIcon'
import { hintFor } from '@/lib/page-help'

export interface NavNode {
  label: string
  icon: React.ReactNode
  /**
   * その場所が何をするところかを、ひとことで。
   *
   * 名前は宮殿の見立て（デルフォイ・アゴラ・スタディオン…）なので、
   * **初めての人には名前だけでは何があるのか分からない**。
   * 名前を説明的に変えると世界観が崩れるので、名前は残して説明を添える。
   */
  description?: string
  // 葉ノードはリンク先を持つ。children を持つノードは開閉可能。
  // children + href（ライブラリ）= リンク＋開閉、children のみ（アトリエ）= 開閉グループ見出し。
  href?: string
  children?: NavNode[]
  /**
   * 行き先がちょうどそこのときだけ点ける。
   *
   * 既定は前方一致（`/items` は `/items/123` でも点く）。
   * ただし `/admin` のような「入口そのもの」は、前方一致だと**中のどのページでも点いてしまい、
   * いま概要を見ているのかどうかが分からない**。
   */
  exact?: boolean
}

export interface NavSection {
  /** React の鍵と、条件付きで項目を足すときの目印。表題とは別に持つ */
  key: string
  title: string
  items: NavNode[]
}

// サイドバー上部に固定するグローバル操作（場所に属さない横断操作）。アイコンのみで表示する。
export const GLOBAL_ACTIONS: NavNode[] = [
  { href: '/search', icon: <Search size={20} />, label: '横断検索', description: hintFor('/search') },
  { href: '/tags', icon: <Tag size={20} />, label: 'タグ', description: hintFor('/tags') },
  { href: '/index', icon: <List size={20} />, label: 'インデックス', description: hintFor('/index') },
]

// サイドバー（デスクトップ）とモバイルドロワーで共有するセクション付きナビ。
export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'palace',
    title: '宮殿',
    items: [
      { href: '/entrance', icon: <DoorOpen size={22} />, label: 'エントランス', description: hintFor('/entrance') },
      {
        // 親はアトリエのトップ（作成ハブ）へのリンク兼開閉グループ。
        href: '/atelier',
        icon: <Palette size={22} />,
        label: 'アトリエ', description: hintFor('/atelier'),
        children: [
          // 他の「◯◯を作成」と同じくページへ移る。
          // ここだけ右パネルが開くと、押した人は同じ操作をしたつもりで違う結果を受け取る
          { href: '/items/new', icon: <CreateIcon><GalleryHorizontal size={20} /></CreateIcon>, label: 'カードを作成', description: hintFor('/items/new') },
          { href: '/views/new', icon: <CreateIcon><LayoutGrid size={20} /></CreateIcon>, label: 'キャンバスを作成', description: hintFor('/views/new') },
          { href: '/spaces/new', icon: <CreateIcon><Frame size={20} /></CreateIcon>, label: 'スペースを作成', description: hintFor('/spaces/new') },
          { href: '/boxes/new', icon: <CreateIcon><Box size={20} /></CreateIcon>, label: 'ボックスを作成', description: hintFor('/boxes/new') },
          { href: '/materials/new', icon: <CreateIcon><Boxes size={20} /></CreateIcon>, label: 'マテリアルを作成', description: hintFor('/materials/new') },
        ],
      },
      {
        href: '/library',
        icon: <LibraryBig size={22} />,
        label: 'ライブラリ', description: hintFor('/library'),
        children: [
          { href: '/items', icon: <GalleryHorizontal size={20} />, label: 'カード一覧', description: hintFor('/items') },
          // デッキはキャンバスの一種（view_type='deck'）。
          // 下階層に「デッキ一覧」を置いていたが、キャンバス一覧の中に絞り込みがあるので
          // 同じ場所への道が2本になっていた。階層を1つ浅くするほうが探しやすい
          { href: '/views', icon: <LayoutGrid size={20} />, label: 'キャンバス一覧', description: hintFor('/views') },
          { href: '/spaces', icon: <Frame size={20} />, label: 'スペース一覧', description: hintFor('/spaces') },
          { href: '/boxes', icon: <Box size={20} />, label: 'ボックス一覧', description: hintFor('/boxes') },
          { href: '/materials', icon: <Boxes size={20} />, label: 'マテリアル一覧', description: hintFor('/materials') },
        ],
      },
      {
        // スタディのトップ（学習ハブ）へのリンク兼開閉グループ。準備中のゲーム/レコードはハブのみ。
        href: '/study',
        icon: <GraduationCap size={22} />,
        label: 'スタディ', description: hintFor('/study'),
        children: [
          { href: '/study/practice', icon: <Layers size={20} />, label: 'プラクティス', description: hintFor('/study/practice') },
          { href: '/study/quiz', icon: <HelpCircle size={20} />, label: 'クイズ', description: hintFor('/study/quiz') },
          { href: '/study/game', icon: <Gamepad2 size={20} />, label: 'プレイ', description: hintFor('/study/game') },
          { href: '/study/record', icon: <BarChart3 size={20} />, label: 'レコード', description: hintFor('/study/record') },
        ],
      },
      {
        // 個人用ハブ。自身もマイルームのページへリンクする。
        // 子は触る頻度の高い順に並べる（見る → 調整する → 確認する → 管理する）。
        // トロフィーは眺めて楽しむもの、アカウント管理はほとんど触らないもの。
        href: '/myroom',
        icon: <House size={22} />,
        label: 'マイルーム', description: hintFor('/myroom'),
        children: [
          { href: '/achievements', icon: <Crown size={20} />, label: 'アチーブメント', description: hintFor('/achievements') },
          { href: '/settings', icon: <Settings size={20} />, label: '環境設定', description: hintFor('/settings') },
          { href: '/billing', icon: <CreditCard size={20} />, label: '利用と支払い', description: hintFor('/billing') },
          { href: '/account', icon: <UserCog size={20} />, label: 'アカウント管理', description: hintFor('/account') },
        ],
      },
    ],
  },
  {
    key: 'outside',
    title: '市街',
    items: [
      { href: '/delphi', icon: <Wand2 size={22} />, label: 'デルフォイ', description: hintFor('/delphi') },
      { href: '/agora', icon: <Store size={22} />, label: 'アゴラ', description: hintFor('/agora') },
      { href: '/stadion', icon: <Swords size={22} />, label: 'スタディオン', description: hintFor('/stadion') },
    ],
  },
  {
    key: 'ops',
    title: '公庁',
    items: [
      {
        // 読みもの3つは同じ性質（運営から届くもの）なので、1つにまとめて畳む。
        // 並べたままだと、日々使う項目と同じ重さで場所を取り続ける。
        // 親自身も面を持つ（3種を一望する公示板）。畳んだままでも新着に届く
        href: '/board',
        icon: <Megaphone size={22} />,
        label: '公示板', description: hintFor('/board'),
        children: [
          { href: '/news', icon: <Megaphone size={20} />, label: 'お知らせ', description: hintFor('/news') },
          { href: '/guide', icon: <BookOpen size={20} />, label: '使い方', description: hintFor('/guide') },
          { href: '/blog', icon: <Newspaper size={20} />, label: 'コラム', description: hintFor('/blog') },
        ],
      },
    ],
  },
]

// 運営メンバーにだけ出す項目。既存の「公庁」セクションの末尾へ足す。
// ここに出す／出さないは見た目の話で、守りはサーバー側の権限判定が行う。
export const ADMIN_SECTION_KEY = 'ops'
/**
 * 執務室。**これは管理画面そのものの名前**で、中に分類を持つ。
 *
 * 中で何をするかで分ける。
 *   概要   … いま何が起きているか（最初に開く）
 *   分析   … 数字を見る（読むだけ・変えない）
 *   運営   … 日々の操作（人・物・お知らせ）
 *   戦略   … 次に何をするか
 *   システム … 設定と安全（**壊せるもの**）
 *
 * 分類は畳める。開いていなければ5行のまま、開いた分類の中だけが伸びる。
 * 執務室の中の帯と同じ並びにしてある（片方だけ増えると、同じ場所の名前が2つになる）。
 */
export const ADMIN_ITEM: NavNode = {
  href: '/admin',
  icon: <ShieldCheck size={22} />,
  label: '執務室', description: hintFor('/admin'),
  children: [
    { href: '/admin', icon: <House size={20} />, label: '概要', description: hintFor('/admin'), exact: true },
    {
      icon: <BarChart3 size={20} />,
      label: '分析',
      children: [
        { href: '/admin/business', icon: <BarChart3 size={20} />, label: '経営', description: hintFor('/admin/business') },
        { href: '/admin/finance', icon: <CreditCard size={20} />, label: '収支', description: hintFor('/admin/finance') },
      ],
    },
    {
      icon: <UserCog size={20} />,
      label: '運営',
      children: [
        { href: '/admin/users', icon: <UserCog size={20} />, label: '利用者', description: hintFor('/admin/users') },
        { href: '/admin/campaigns', icon: <Megaphone size={20} />, label: 'キャンペーン', description: hintFor('/admin/campaigns') },
        { href: '/admin/rewards', icon: <Crown size={20} />, label: '獲得物', description: hintFor('/admin/rewards') },
        { href: '/admin/posts', icon: <Newspaper size={20} />, label: '読みもの', description: hintFor('/admin/posts') },
      ],
    },
    {
      icon: <Compass size={20} />,
      label: '戦略',
      children: [{ href: '/admin/strategy', icon: <Compass size={20} />, label: 'AI分析', description: hintFor('/admin/strategy') }],
    },
    {
      icon: <Settings size={20} />,
      label: 'システム',
      children: [
        { href: '/admin/grants', icon: <CreditCard size={20} />, label: '料金と枠', description: hintFor('/admin/grants') },
        { href: '/admin/models', icon: <Wand2 size={20} />, label: 'AIモデル', description: hintFor('/admin/models') },
        { href: '/admin/features', icon: <Layers size={20} />, label: '機能管理', description: hintFor('/admin/features') },
        { href: '/admin/audit', icon: <List size={20} />, label: '監査ログ', description: hintFor('/admin/audit') },
      ],
    },
  ],
}

/**
 * 工房室。**公式コンテンツを、選んで・確かめて・出す場所。**
 *
 * ここに編集の道具は置かない。カードを足したいなら公式の口座で普通に足せばよく、
 * 同じものをもう一度作ることになる。
 */
export const STUDIO_ITEM: NavNode = {
  href: '/studio',
  icon: <Hammer size={22} />,
  label: '工房室', description: hintFor('/studio'),
  children: [
    { href: '/studio', icon: <LayoutDashboard size={20} />, label: '概要', description: hintFor('/studio'), exact: true },
    { href: '/studio/originals', icon: <GalleryHorizontal size={20} />, label: '原本', description: hintFor('/studio/originals') },
    { href: '/studio/demo', icon: <DoorOpen size={20} />, label: '体験宮殿設定', description: hintFor('/studio/demo') },
    { href: '/studio/delivery', icon: <Package size={20} />, label: '個別配布設定', description: hintFor('/studio/delivery') },
    { href: '/studio/settings', icon: <Settings size={20} />, label: '全体設定', description: hintFor('/studio/settings') },
  ],
}

/**
 * 「公庁」の末尾に、その人に見せてよい入口を足す。
 *
 * **役割では決めない。** できることの名前で決める
 * （`opsEntriesFor` が能力から組み立てる）。
 */
export function navSectionsFor(entries: { opsRoom: boolean; officialStudio: boolean }): NavSection[] {
  const extra: NavNode[] = []
  if (entries.opsRoom) extra.push(ADMIN_ITEM)
  if (entries.officialStudio) extra.push(STUDIO_ITEM)
  if (extra.length === 0) return NAV_SECTIONS

  return NAV_SECTIONS.map((section) =>
    section.key === ADMIN_SECTION_KEY ? { ...section, items: [...section.items, ...extra] } : section
  )
}
