import {
  DoorOpen,
  LibraryBig,
  GalleryHorizontal,
  Library,
  LayoutGrid,
  Frame,
  GraduationCap,
  Palette,
  ListChecks,
  Search,
  Tag,
  Wand2,
  Store,
  Swords,
  CreditCard,
  UserCog,
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

// サイドバー（デスクトップ）とモバイルドロワーで共有するセクション付きナビ。
export const NAV_SECTIONS: NavSection[] = [
  {
    title: '宮殿',
    items: [
      { href: '/entrance', icon: <DoorOpen size={22} />, label: 'エントランス' },
      {
        href: '/library',
        icon: <LibraryBig size={22} />,
        label: 'ライブラリ',
        children: [
          { href: '/items', icon: <GalleryHorizontal size={20} />, label: 'カード' },
          { href: '/collections', icon: <Library size={20} />, label: 'コレクション' },
          { href: '/views', icon: <LayoutGrid size={20} />, label: 'ビュー' },
          { href: '/spaces', icon: <Frame size={20} />, label: 'スペース' },
          { href: '/wordlists', icon: <ListChecks size={20} />, label: 'ワードリスト' },
        ],
      },
      { href: '/study', icon: <GraduationCap size={22} />, label: 'スタディ' },
      {
        // 親はアトリエのトップ（作成ハブ）へのリンク兼開閉グループ。
        href: '/atelier',
        icon: <Palette size={22} />,
        label: 'アトリエ',
        children: [
          { href: '/wordlists/new', icon: <ListChecks size={20} />, label: 'ワードリストを作成' },
          { href: '/items/new', icon: <GalleryHorizontal size={20} />, label: 'カードを作成' },
          { href: '/collections/new', icon: <Library size={20} />, label: 'コレクションを作成' },
          { href: '/views/new', icon: <LayoutGrid size={20} />, label: 'ビューを作成' },
          { href: '/spaces/new', icon: <Frame size={20} />, label: 'スペースを作成' },
        ],
      },
    ],
  },
  {
    title: '検索',
    items: [
      { href: '/search', icon: <Search size={22} />, label: '横断検索' },
      { href: '/tags', icon: <Tag size={22} />, label: 'タグ' },
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
    title: '会員',
    items: [
      { href: '/billing', icon: <CreditCard size={22} />, label: 'プラン' },
      { href: '/account', icon: <UserCog size={22} />, label: 'アカウント設定' },
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
