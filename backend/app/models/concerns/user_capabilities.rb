# frozen_string_literal: true

# その人に何ができるかを、**名前で呼ぶ**ための層。
#
# ## なぜ役割を直に見ないのか
#
# 役割（`user < support < operator < admin`）は「上位が下位を含む」順位で、
# 運営の仕事の強さを表している。
#
# 一方、公式コンテンツの制作は**強さではなく、関わっているかどうか**。
# デザイナーに請求を見せたくないし、調査担当が公式コンテンツを
# 編集できる必要もない。**段の違うものを1本の梯子に並べると、
# どちらかが必ず余計なものを持つ。**
#
# そこで、役割の上に「できることの名前」を1枚置く。
#
#     能力（can_*?）           ← 呼ぶ側はここだけ見る
#       ↑          ↑
#   運営の役割   宮殿の一員か（将来）
#
# ## 今日と明日
#
# 今日は右側が空なので、能力は役割だけから決まる。
# 人が増えたら、宮殿ごとの一員かどうかを見るようになる。
# **そのとき変わるのはここの中身だけで、呼ぶ側は1文字も変わらない。**
module UserCapabilities
  extend ActiveSupport::Concern

  # 画面へ配る能力の一覧。**ここに書いたものだけが画面へ渡る**
  CAPABILITIES = %i[
    access_ops_room
    support_users
    view_analytics
    operate_service
    manage_billing
    manage_members
    manage_security
    access_official_studio
    edit_official_content
    publish_official_content
  ].freeze

  # ── 運営 ────────────────────────────────────────────

  # 執務室に入れるか
  def can_access_ops_room?
    at_least?("support")
  end

  # 利用者を調べられるか（見るだけ）
  def can_support_users?
    at_least?("support")
  end

  # 数字を見られるか
  def can_view_analytics?
    at_least?("support")
  end

  # 日々の運営（配信・付与・設定変更）
  def can_operate_service?
    at_least?("operator")
  end

  # ── 触ると戻せないもの ──────────────────────────────

  def can_manage_billing?
    at_least?("admin")
  end

  def can_manage_members?
    at_least?("admin")
  end

  def can_manage_security?
    at_least?("admin")
  end

  # ── 公式コンテンツ ──────────────────────────────────
  #
  # **admin と、原本を持つ口座。**
  #
  # `operator` へは開かない。招待の仕組みがまだ無い段階で開くと、
  # 運営業務の担当者が公式コンテンツを触れることになり、職務が分かれない。
  #
  # 原本の持ち主を入れているのは、**その口座が既に全部を所有している**から。
  # 奪われた時点で原本は書き換え放題なので、公開の可否だけを分けても
  # 守れる範囲はさほど増えない。一方、分けると原本を直すたびに
  # 口座を行き来することになる。
  #
  # （代わりに、工房へ入るときは**もう一度ご本人か確かめる**。執務室と同じ）
  #
  # 編集・公開を今から名前で分けてある。今日は同じ判定だが、
  # 公開だけを任せる人を招くとき、**その1行だけ**変えれば済む。

  def can_access_official_studio?
    at_least?("admin") || official_content_account?
  end

  def can_edit_official_content?
    can_access_official_studio?
  end

  def can_publish_official_content?
    can_access_official_studio?
  end

  # ── まとめ ──────────────────────────────────────────

  # 画面へ渡す形。**役割の文字列は渡さない**（画面に持ち込むと、
  # 出し分けの条件が役割で書かれ始める）
  def capabilities
    CAPABILITIES.index_with { |name| public_send("can_#{name}?") }
  end

  def capability?(name)
    return false unless CAPABILITIES.include?(name.to_sym)

    public_send("can_#{name}?")
  end
end
