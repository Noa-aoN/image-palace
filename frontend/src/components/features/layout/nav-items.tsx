import {
  LayoutDashboard,
  GalleryHorizontal,
  LibraryBig,
  Library,
  Layers,
  LayoutGrid,
  Frame,
  Route,
  DoorOpen,
  Tag,
  Plus,
  CreditCard,
} from 'lucide-react'

export interface NavNode {
  label: string
  icon: React.ReactNode
  // 葉ノードはリンク先を持つ。親（カテゴリ）ノードは href を持たず children を持つ。
  href?: string
  children?: NavNode[]
}

// サイドバー（デスクトップ）とモバイルドロワーで共有する入れ子ツリー。
// ライブラリの階層を「ビュー（デッキ/ビュー）」「スペース（ロード/ルーム）」の親子で表現する。
export const NAV_TREE: NavNode[] = [
  { href: '/dashboard', icon: <LayoutDashboard size={22} />, label: 'ダッシュボード' },
  { href: '/library', icon: <LibraryBig size={22} />, label: 'ライブラリ' },
  { href: '/items', icon: <GalleryHorizontal size={22} />, label: 'カード' },
  { href: '/collections', icon: <Library size={22} />, label: 'コレクション' },
  {
    // 親自身も「ビュー」一覧へのリンク。配下にデッキ等の表示形式を入れ子にする。
    href: '/views',
    label: 'ビュー',
    icon: <LayoutGrid size={22} />,
    children: [
      { href: '/decks', icon: <Layers size={20} />, label: 'デッキ' },
    ],
  },
  {
    // 親自身も「スペース」一覧へのリンク。配下にロード/ルームを入れ子にする。
    href: '/spaces',
    label: 'スペース',
    icon: <Frame size={22} />,
    children: [
      { href: '/spaces', icon: <Route size={20} />, label: 'ロード' },
      { href: '/spaces', icon: <DoorOpen size={20} />, label: 'ルーム' },
    ],
  },
  { href: '/tags', icon: <Tag size={22} />, label: 'タグ' },
  { href: '/items/new', icon: <Plus size={22} />, label: 'カードを作成' },
  { href: '/billing', icon: <CreditCard size={22} />, label: 'プラン' },
]
