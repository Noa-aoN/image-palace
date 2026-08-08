# frozen_string_literal: true

# 付与ポリシー。「何を・いくつ・どの条件で配るか」を運営が画面から変えられるようにする。
#
# 行が無いキーは DEFAULTS の値で動く。つまり何も設定しなければ現行の挙動のまま。
# 画面で触ったときだけ行ができて、以後はそちらが効く。
#
# 価格と原価の関係（Billing::Catalog::MIN_MARGIN）はここでは扱わない。
# 崩れると気づかないまま損をする性質なので、定数とテストで守る方針を維持する。
class GrantPolicy < ApplicationRecord
  REWARD_TYPES = %w[credits item].freeze

  # 配れるアイテムの種類。
  ITEM_KINDS = %w[box space view wordlist skin].freeze

  # このうち「実際に配れる」もの。受け取り側の仕組みができた種類をここへ足すと、
  # 管理画面の準備中の表示が外れて有効にできるようになる（機能追加とセットで1行）。
  #
  # いまは空。詰め合わせ（テーマ別のボックス）や初期コンテンツの配布、
  # スキンの実体ができるまでは、設定を保存できても配られない。
  READY_ITEM_KINDS = [].freeze

  # 既定。DB に行が無いときはこの値で動く（＝これまでの挙動）
  DEFAULTS = {
    "trial" => {
      label: "登録時のお試し",
      reward_type: "credits",
      amount: ::Billing::Catalog::TRIAL_CREDITS,
      description: "登録した人に1回だけ配る。退会して作り直しても配られない"
    },
    "monthly_free" => {
      label: "毎月の無料枠",
      reward_type: "credits",
      amount: ::Billing::Catalog::MONTHLY_FREE_CREDITS,
      description: "来た人にだけ月1回配る。休眠アカウントには出ていかない"
    }
  }.freeze

  validates :key, presence: true, uniqueness: true
  validates :reward_type, inclusion: { in: REWARD_TYPES }
  validates :amount, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validates :item_kind, inclusion: { in: ITEM_KINDS }, allow_blank: true
  validate :item_reward_needs_kind
  validate :cannot_enable_unready_item

  # 有効な付与量。無効化されていれば 0（＝配らない）。
  # DB に行が無ければ既定値を返すので、未設定でも動きは変わらない。
  def self.amount_for(key)
    policy = find_by(key: key)
    return DEFAULTS.dig(key, :amount).to_i if policy.nil?
    return 0 unless policy.enabled?

    policy.amount
  end

  def self.enabled?(key)
    policy = find_by(key: key)
    return DEFAULTS.key?(key) if policy.nil?

    policy.enabled?
  end

  # 画面に出す一覧。DB の行と、まだ行が無い既定のキーを合わせて返す
  def self.overview
    saved = all.index_by(&:key)

    keys = (DEFAULTS.keys + saved.keys).uniq
    keys.map do |key|
      policy = saved[key]
      default = DEFAULTS[key] || {}
      {
        key: key,
        label: default[:label] || key,
        description: default[:description],
        reward_type: policy&.reward_type || default[:reward_type] || "credits",
        enabled: policy ? policy.enabled? : DEFAULTS.key?(key),
        amount: policy ? policy.amount : default[:amount].to_i,
        item_kind: policy&.item_kind,
        conditions: policy&.conditions || {},
        notes: policy&.notes,
        # 既定のままか、画面で触った結果か
        customized: policy.present?,
        default_amount: default[:amount]&.to_i,
        # 受け取り側の仕組みが無いものは準備中。画面で「配る」にできない
        ready: policy ? policy.deliverable? : true
      }
    end
  end

  # 実際に配れる状態か（受け取り側の仕組みがあるか）
  def deliverable?
    return true if reward_type == "credits"

    READY_ITEM_KINDS.include?(item_kind)
  end

  private

  def item_reward_needs_kind
    return unless reward_type == "item"
    return if item_kind.present?

    errors.add(:item_kind, "はアイテムを配るときに必要です")
  end

  # 配れないものを「配る」にできてしまうと、配られていないことに気づけない。
  # 設定の保存自体は許し、有効化だけを止める
  def cannot_enable_unready_item
    return unless enabled?
    return if deliverable?

    errors.add(:base, "#{item_kind} の付与はまだ準備中です（受け取り側の仕組みができてから有効にできます）")
  end
end
