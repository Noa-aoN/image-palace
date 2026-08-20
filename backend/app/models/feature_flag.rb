# frozen_string_literal: true

# 作りかけの機能を、どこまで見せるかの設定。
#
# 行が無ければ DEFAULTS の段階で動く。運営が画面から変えたときだけ行ができる。
#
# **単位はページ**（サイドバーの1項目）にしてある。
# 機能ごとの細かいキーにすると、どこを触れば何が消えるのかが運営に分からない。
# 「サイドバーのこの項目を隠す」と言えるほうが、押す前に結果が読める。
# ページに紐づかないものだけ、その他としてわずかに持つ。
class FeatureFlag < ApplicationRecord
  # 見せ方の段階。
  #
  # hidden      … 入口ごと出さない。ページを開いても中身は出ない
  # development … サイドバーには「準備中」と出るが、中身は出ない
  # prototype   … 使える。ただし「プロトタイプ版」と明示して、粗さを了解してもらう
  # released    … 普通の機能。印は付けない
  STAGES = %w[hidden development prototype released].freeze

  STAGE_LABELS = {
    "hidden" => "表示しない",
    "development" => "準備中と出す",
    "prototype" => "プロトタイプ版",
    "released" => "公開"
  }.freeze

  # サイドバーの分類。画面の並びもこの順にする
  GROUPS = {
    "palace" => "宮殿",
    "outside" => "市街",
    "ops" => "公式",
    "other" => "ページ以外"
  }.freeze

  # 画面が参照しているキーと既定。
  # path があるものはページ。サイドバーとページ本体の両方がこの段階に従う。
  #
  # ここに無いキーは保存できない（打ち間違いで効かない設定が増えるのを防ぐ）。
  DEFAULTS = {
    # ── 宮殿 ──
    "page.entrance" => { label: "エントランス", group: "palace", path: "/entrance", stage: "released" },
    "page.atelier" => { label: "アトリエ", group: "palace", path: "/atelier", stage: "released" },
    "page.library" => { label: "ライブラリ", group: "palace", path: "/library", stage: "released" },
    "page.items" => { label: "カード一覧", group: "palace", path: "/items", stage: "released" },
    "page.views" => { label: "キャンバス一覧", group: "palace", path: "/views", stage: "released" },
    "page.spaces" => { label: "スペース一覧", group: "palace", path: "/spaces", stage: "released" },
    "page.boxes" => { label: "ボックス一覧", group: "palace", path: "/boxes", stage: "released" },
    "page.materials" => { label: "マテリアル一覧", group: "palace", path: "/materials", stage: "released" },
    "page.study" => { label: "スタディ", group: "palace", path: "/study", stage: "released" },
    "page.study_practice" => { label: "プラクティス", group: "palace", path: "/study/practice", stage: "released" },
    "page.study_quiz" => { label: "クイズ", group: "palace", path: "/study/quiz", stage: "released" },
    "page.study_game" => { label: "プレイ", group: "palace", path: "/study/game", stage: "prototype" },
    "page.study_record" => { label: "レコード", group: "palace", path: "/study/record", stage: "released" },
    "page.myroom" => { label: "マイルーム", group: "palace", path: "/myroom", stage: "released" },
    "page.achievements" => {
      label: "アチーブメント", group: "palace", path: "/achievements", stage: "prototype"
    },
    "page.settings" => { label: "環境設定", group: "palace", path: "/settings", stage: "released" },
    "page.billing" => { label: "利用と支払い", group: "palace", path: "/billing", stage: "released" },
    "page.account" => { label: "アカウント管理", group: "palace", path: "/account", stage: "released" },

    # ── 市街 ──
    "page.acropolis" => { label: "デルフォイ", group: "outside", path: "/delphi", stage: "released" },
    "page.agora" => { label: "アゴラ", group: "outside", path: "/agora", stage: "released" },
    "page.stadion" => { label: "スタディオン", group: "outside", path: "/stadion", stage: "released" },

    # ── 公式 ──
    "page.board" => { label: "公示板", group: "ops", path: "/board", stage: "released" },
    "page.news" => { label: "お知らせ", group: "ops", path: "/news", stage: "released" },
    "page.guide" => { label: "使い方", group: "ops", path: "/guide", stage: "released" },
    "page.blog" => { label: "コラム", group: "ops", path: "/blog", stage: "released" },

    # ── ページ以外 ──
    "material_picture_list" => {
      label: "ピクチャーリスト", group: "other", path: nil, stage: "development",
      note: "マテリアルの種類のひとつ。ページではないので個別に持つ"
    },
    # 体験用の宮殿の入口。**ここが「一般に開いているか」の栓**。
    #
    # ページではないので個別に持つ。段階の意味はこう読む。
    #   hidden      … 入口ごと出さない
    #   development … 入口は見えるが「準備中」と伝えて、入れない
    #   released    … 入れる
    #
    # デプロイ無しで開け閉めできる。**公開の判断を、運営の手に置くため**
    "demo_entry" => {
      label: "体験用の宮殿の入口", group: "other", path: nil, stage: "development",
      note: "はじまりの宮殿へ入れるかどうか。準備中にすると、入口は見えるが入れない"
    }
  }.freeze

  validates :key, presence: true, uniqueness: true, inclusion: { in: DEFAULTS.keys }
  validates :stage, inclusion: { in: STAGES }

  # キー → 段階。画面はこれだけを見る
  def self.stages
    overrides = pluck(:key, :stage).to_h
    DEFAULTS.transform_values { |d| d[:stage] }.merge(overrides.slice(*DEFAULTS.keys))
  end

  # 「なぜ準備中か」を利用者にも伝えるための一言。
  #
  # **「使えない」だけが伝わるのが、いちばん困る。** 壊れているのか、
  # これから来るのかが分からないと、待ってよいのかも判断できない。
  # 運営が書いたものだけを返す（既定の note は運営向けの覚え書きなので出さない）。
  def self.public_notes
    where.not(notes: [ nil, "" ]).pluck(:key, :notes).to_h.slice(*DEFAULTS.keys)
  end

  # 運営画面用。既定との違いが分かる形で、サイドバーの並び順に返す
  def self.overview
    rows = all.index_by(&:key)
    DEFAULTS.map do |key, default|
      record = rows[key]
      {
        key: key,
        label: default[:label],
        group: default[:group],
        group_label: GROUPS[default[:group]],
        path: default[:path],
        note: default[:note],
        stage: record&.stage || default[:stage],
        default_stage: default[:stage],
        customized: record.present? && record.stage != default[:stage],
        notes: record&.notes
      }
    end
  end
end
