import {
  DoorOpen,
  LibraryBig,
  GalleryHorizontal,
  Library,
  LayoutGrid,
  Frame,
  GraduationCap,
  Layers,
  HelpCircle,
  Gamepad2,
  BarChart3,
  Palette,
  Boxes,
  Search,
  Tag,
  Wand2,
  Store,
  Swords,
  CreditCard,
  UserCog,
  Settings,
  Trophy,
  House,
  BookOpen,
  Newspaper,
} from 'lucide-react'

export interface NavNode {
  label: string
  icon: React.ReactNode
  // 葉ノードはリンク先を持つ。children を持つノードは開閉可能。
  // children + href（ライブラリ）= リンク＋開閉、children のみ（アトリエ）= 開閉グループ見出し。
  href?: string
  children?: NavNode[]
}

export interface NavSection {
  title: string
  items: NavNode[]
}

// サイドバー上部に固定するグローバル操作（場所に属さない横断操作）。アイコンのみで表示する。
export const GLOBAL_ACTIONS: NavNode[] = [
  { href: '/search', icon: <Search size={20} />, label: '横断検索' },
  { href: '/tags', icon: <Tag size={20} />, label: 'タグ' },
]

// サイドバー（デスクトップ）とモバイルドロワーで共有するセクション付きナビ。
export const NAV_SECTIONS: NavSection[] = [
  {
    title: '宮殿',
    items: [
      { href: '/entrance', icon: <DoorOpen size={22} />, label: 'エントランス' },
      {
        // 親はアトリエのトップ（作成ハブ）へのリンク兼開閉グループ。
        href: '/atelier',
        icon: <Palette size={22} />,
        label: 'アトリエ',
        children: [
          { href: '/materials/new', icon: <Boxes size={20} />, label: 'マテリアルを作成' },
          { href: '/items/new', icon: <GalleryHorizontal size={20} />, label: 'カードを作成' },
          { href: '/collections/new', icon: <Library size={20} />, label: 'コレクションを作成' },
          { href: '/views/new', icon: <LayoutGrid size={20} />, label: 'キャンバスを作成' },
          { href: '/spaces/new', icon: <Frame size={20} />, label: 'スペースを作成' },
        ],
      },
      {
        href: '/library',
        icon: <LibraryBig size={22} />,
        label: 'ライブラリ',
        children: [
          { href: '/materials', icon: <Boxes size={20} />, label: 'マテリアル一覧' },
          { href: '/items', icon: <GalleryHorizontal size={20} />, label: 'カード一覧' },
          { href: '/collections', icon: <Library size={20} />, label: 'コレクション一覧' },
          { href: '/views', icon: <LayoutGrid size={20} />, label: 'キャンバス一覧' },
          { href: '/spaces', icon: <Frame size={20} />, label: 'スペース一覧' },
        ],
      },
      {
        // スタディのトップ（学習ハブ）へのリンク兼開閉グループ。準備中のゲーム/レコードはハブのみ。
        href: '/study',
        icon: <GraduationCap size={22} />,
        label: 'スタディ',
        children: [
          { href: '/study/practice', icon: <Layers size={20} />, label: 'プラクティス' },
          { href: '/study/quiz', icon: <HelpCircle size={20} />, label: 'クイズ' },
          { href: '/study/game', icon: <Gamepad2 size={20} />, label: 'プレイ' },
          { href: '/study/record', icon: <BarChart3 size={20} />, label: 'レコード' },
        ],
      },
      {
        // 個人用ハブ。アカウント設定/環境設定/プラン・支払い/トロフィーを内包し、自身もマイルームのページへリンク。
        href: '/myroom',
        icon: <House size={22} />,
        label: 'マイルーム',
        children: [
          { href: '/account', icon: <UserCog size={20} />, label: 'アカウント設定' },
          { href: '/billing', icon: <CreditCard size={20} />, label: 'プラン・支払い' },
          { href: '/settings', icon: <Settings size={20} />, label: '環境設定' },
          { href: '/trophy', icon: <Trophy size={20} />, label: 'トロフィー' },
        ],
      },
    ],
  },
  {
    title: '宮殿外',
    items: [
      { href: '/delphi', icon: <Wand2 size={22} />, label: 'デルフォイ' },
      { href: '/agora', icon: <Store size={22} />, label: 'アゴラ' },
      { href: '/arena', icon: <Swords size={22} />, label: 'アリーナ' },
    ],
  },
  {
    title: '運営',
    items: [
      { href: '/guide', icon: <BookOpen size={22} />, label: '使い方' },
      { href: '/blog', icon: <Newspaper size={22} />, label: 'コラム' },
    ],
  },
]
