import {
  DoorOpen,
  LibraryBig,
  GalleryHorizontal,
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
} from 'lucide-react'
import { CreateIcon } from './CreateIcon'

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
  { href: '/search', icon: <Search size={20} />, label: '横断検索' },
  { href: '/tags', icon: <Tag size={20} />, label: 'タグ' },
  { href: '/index', icon: <List size={20} />, label: 'インデックス' },
]

// サイドバー（デスクトップ）とモバイルドロワーで共有するセクション付きナビ。
export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'palace',
    title: '宮殿',
    items: [
      { href: '/entrance', icon: <DoorOpen size={22} />, label: 'エントランス', description: '宮殿の入口。いまの様子と、次にやることが分かる' },
      {
        // 親はアトリエのトップ（作成ハブ）へのリンク兼開閉グループ。
        href: '/atelier',
        icon: <Palette size={22} />,
        label: 'アトリエ', description: 'つくる場所。カード・キャンバス・スペースなどを新しく作る',
        children: [
          // 他の「◯◯を作成」と同じくページへ移る。
          // ここだけ右パネルが開くと、押した人は同じ操作をしたつもりで違う結果を受け取る
          { href: '/items/new', icon: <CreateIcon><GalleryHorizontal size={20} /></CreateIcon>, label: 'カードを作成' },
          { href: '/views/new', icon: <CreateIcon><LayoutGrid size={20} /></CreateIcon>, label: 'キャンバスを作成' },
          { href: '/spaces/new', icon: <CreateIcon><Frame size={20} /></CreateIcon>, label: 'スペースを作成' },
          { href: '/boxes/new', icon: <CreateIcon><Box size={20} /></CreateIcon>, label: 'ボックスを作成' },
          { href: '/materials/new', icon: <CreateIcon><Boxes size={20} /></CreateIcon>, label: 'マテリアルを作成' },
        ],
      },
      {
        href: '/library',
        icon: <LibraryBig size={22} />,
        label: 'ライブラリ', description: 'しまう場所。作ったものを一覧で見て、探して、整理する',
        children: [
          { href: '/items', icon: <GalleryHorizontal size={20} />, label: 'カード一覧' },
          {
            href: '/views',
            icon: <LayoutGrid size={20} />,
            label: 'キャンバス一覧',
            // デッキはキャンバスの一種（view_type='deck'）。よく使うので下階層から直接開けるようにする
            children: [{ href: '/views?type=deck', icon: <Layers size={18} />, label: 'デッキ一覧' }],
          },
          { href: '/spaces', icon: <Frame size={20} />, label: 'スペース一覧' },
          { href: '/boxes', icon: <Box size={20} />, label: 'ボックス一覧' },
          { href: '/materials', icon: <Boxes size={20} />, label: 'マテリアル一覧' },
        ],
      },
      {
        // スタディのトップ（学習ハブ）へのリンク兼開閉グループ。準備中のゲーム/レコードはハブのみ。
        href: '/study',
        icon: <GraduationCap size={22} />,
        label: 'スタディ', description: 'おぼえる場所。作ったカードで練習・クイズをする',
        children: [
          { href: '/study/practice', icon: <Layers size={20} />, label: 'プラクティス' },
          { href: '/study/quiz', icon: <HelpCircle size={20} />, label: 'クイズ' },
          { href: '/study/game', icon: <Gamepad2 size={20} />, label: 'プレイ' },
          { href: '/study/record', icon: <BarChart3 size={20} />, label: 'レコード' },
        ],
      },
      {
        // 個人用ハブ。自身もマイルームのページへリンクする。
        // 子は触る頻度の高い順に並べる（見る → 調整する → 確認する → 管理する）。
        // トロフィーは眺めて楽しむもの、アカウント管理はほとんど触らないもの。
        href: '/myroom',
        icon: <House size={22} />,
        label: 'マイルーム', description: '自分の部屋。設定・支払い・記録をまとめて置いてある',
        children: [
          { href: '/achievements', icon: <Crown size={20} />, label: 'アチーブメント' },
          { href: '/settings', icon: <Settings size={20} />, label: '環境設定' },
          { href: '/billing', icon: <CreditCard size={20} />, label: '利用と支払い' },
          { href: '/account', icon: <UserCog size={20} />, label: 'アカウント管理' },
        ],
      },
    ],
  },
  {
    key: 'outside',
    title: '市街',
    items: [
      { href: '/delphi', icon: <Wand2 size={22} />, label: 'デルフォイ', description: 'AI に相談する場所。何を覚えるとよいか、言葉を選んでもらう' },
      { href: '/agora', icon: <Store size={22} />, label: 'アゴラ', description: 'みんなの広場。ほかの人が作ったものを見つける' },
      { href: '/stadion', icon: <Swords size={22} />, label: 'スタディオン', description: '腕試しの場所。競って学ぶ（準備中）' },
    ],
  },
  {
    key: 'ops',
    title: '公式',
    items: [
      {
        // 読みもの3つは同じ性質（運営から届くもの）なので、1つにまとめて畳む。
        // 並べたままだと、日々使う項目と同じ重さで場所を取り続ける。
        // 親自身も面を持つ（3種を一望する掲示板）。畳んだままでも新着に届く
        href: '/board',
        icon: <Megaphone size={22} />,
        label: '掲示板', description: '運営からのお知らせ・使い方・コラムを読む',
        children: [
          { href: '/news', icon: <Megaphone size={20} />, label: 'お知らせ' },
          { href: '/guide', icon: <BookOpen size={20} />, label: '使い方' },
          { href: '/blog', icon: <Newspaper size={20} />, label: 'コラム' },
        ],
      },
    ],
  },
]

// 運営メンバーにだけ出す項目。既存の「公式」セクションの末尾へ足す。
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
  label: '執務室', description: '運営向け。数字の確認と、日々の運営操作',
  children: [
    { href: '/admin', icon: <House size={20} />, label: '概要', exact: true },
    {
      icon: <BarChart3 size={20} />,
      label: '分析',
      children: [
        { href: '/admin/business', icon: <BarChart3 size={20} />, label: '経営' },
        { href: '/admin/finance', icon: <CreditCard size={20} />, label: '収支' },
      ],
    },
    {
      icon: <UserCog size={20} />,
      label: '運営',
      children: [
        { href: '/admin/users', icon: <UserCog size={20} />, label: '利用者' },
        { href: '/admin/campaigns', icon: <Megaphone size={20} />, label: 'キャンペーン' },
        { href: '/admin/rewards', icon: <Crown size={20} />, label: '獲得物' },
        { href: '/admin/posts', icon: <Newspaper size={20} />, label: '読みもの' },
      ],
    },
    {
      icon: <Compass size={20} />,
      label: '戦略',
      children: [{ href: '/admin/strategy', icon: <Compass size={20} />, label: 'AI分析' }],
    },
    {
      icon: <Settings size={20} />,
      label: 'システム',
      children: [
        { href: '/admin/grants', icon: <CreditCard size={20} />, label: '料金と枠' },
        { href: '/admin/models', icon: <Wand2 size={20} />, label: 'AIモデル' },
        { href: '/admin/features', icon: <Layers size={20} />, label: '機能管理' },
        { href: '/admin/audit', icon: <List size={20} />, label: '監査ログ' },
      ],
    },
  ],
}

/** 運営メンバーなら「公式」セクションの末尾に執務室を足したものを返す */
export function navSectionsFor(isAdmin: boolean): NavSection[] {
  if (!isAdmin) return NAV_SECTIONS

  return NAV_SECTIONS.map((section) =>
    section.key === ADMIN_SECTION_KEY ? { ...section, items: [...section.items, ADMIN_ITEM] } : section
  )
}
