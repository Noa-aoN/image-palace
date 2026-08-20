# frozen_string_literal: true

# 荷物の届け先。**どこで配るか。**
#
# 「何であるか」（`kind`）と「どこへ出るか」を分ける。
# 分ける前は `kind` を決めた時点で出し先が固まり、
# 「デルフォイには出さないが、引き換えコードでだけ渡す」ができなかった。
#
# 版ではなく**鍵**に付ける。「starter_it はデルフォイで配る」は
# その線の性質であって、v3 の性質ではない。
class ContentDelivery < ApplicationRecord
  # 届け先。**足すときは、受け取る側の仕組みとセットで**
  #
  #   demo     … 体験用の宮殿に置く。**ON のものを全部入れて宮殿を組む**
  #   delphi   … デルフォイで受け取れる（無料枠を使う）
  #   campaign … 引き換えコードで渡せる（受け取る側は #838 で作る）
  #   mission  … ミッションの報酬にできる（同上）
  #   purchase … 買って手に入る（将来）
  CHANNELS = %w[demo delphi campaign mission purchase].freeze

  # 画面に出す言い方。**「配る」とだけ言わない。**
  # どこで・誰に届くのかが分かる言葉にする
  CHANNEL_LABELS = {
    "demo" => "体験の宮殿に置く",
    "delphi" => "デルフォイで受け取れる",
    "campaign" => "引き換えコードで渡す",
    "mission" => "ミッションの報酬にする",
    "purchase" => "購入で手に入る"
  }.freeze

  CHANNEL_NOTES = {
    "demo" => "ログインせずに入れる宮殿の中身になります",
    "delphi" => "登録した方が、無料枠のひとつとして受け取れます",
    "campaign" => "配ったコードと引き換えに渡せます",
    "mission" => "ミッションを達成した方へ配れます",
    "purchase" => "有料で手に入るようにします"
  }.freeze

  # まだ受け取る側の仕組みが無いもの。**設定はできるが、実際には届かない**
  #
  # ここに載っているうちは、画面に「準備中」と出す。
  # 設定できるのに届かない、を黙って起こさないため
  PENDING_CHANNELS = %w[campaign mission purchase].freeze

  validates :package_key, presence: true
  validates :channel, inclusion: { in: CHANNELS }
  validates :channel, uniqueness: { scope: :package_key }

  scope :on, -> { where(enabled: true) }

  # その届け先で、いま配っている荷物の鍵
  def self.keys_for(channel)
    on.where(channel: channel).pluck(:package_key)
  end

  # その届け先で、いま配れる荷物（公開中のものだけ）
  def self.packages_for(channel)
    keys_for(channel).filter_map { |key| ContentPackage.latest_published(key) }
  end

  # 荷物の届け先を、画面へ渡す形で。**まだ無い届け先も並べる**
  # （設定できる場所が見えないと、そこへ出せると気づけない）
  def self.state_for(package_key)
    rows = where(package_key: package_key).index_by(&:channel)

    CHANNELS.map do |channel|
      {
        channel: channel,
        label: CHANNEL_LABELS.fetch(channel),
        note: CHANNEL_NOTES.fetch(channel),
        enabled: rows[channel]&.enabled || false,
        pending: PENDING_CHANNELS.include?(channel)
      }
    end
  end

  def self.set!(package_key:, channel:, enabled:)
    row = find_or_initialize_by(package_key: package_key, channel: channel)
    row.enabled = enabled
    row.save!
    row
  end

  def pending?
    PENDING_CHANNELS.include?(channel)
  end
end
