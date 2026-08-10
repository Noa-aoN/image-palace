# frozen_string_literal: true

# AI モデルの登録簿。
#
# これまでモデルの情報は3か所に散っていた。
#   ・使えるかどうか  … コードの定数と環境変数
#   ・原価            … cost_parameters
#   ・消費クレジット  … Billing::CreditCost / Ai::UsageLimit の定数
# 「1枚いくらで、いくら貰っていて、誰に見せているか」を一度に見る場所が無く、
# 値を変えるのにデプロイが要った。ここに寄せる。
#
# **組み込みは BUILTINS に置き、初回の読み出しで行として取り込む。**
# 取り込んだ後は行が正（運営が画面から変えられる）。コード側の値は
# 「最初に何だったか」を示すだけになる。
class AiModel < ApplicationRecord
  KINDS = %w[image text].freeze

  # 画像の用途。空なら制限なし
  IMAGE_PURPOSES = %w[item avatar cover point].freeze

  # 組み込みのモデル。ここにある key は消せない（コードが参照しているため）
  BUILTINS = [
    {
      key: "openai", kind: "image", provider: "openai", model_id: "gpt-image-1",
      label: "標準", description: "文字や細部が崩れにくく、説明図に向きます。",
      requires_env: "OPENAI_API_KEY", default_for_kind: true,
      credit_points: 100, unit_cost_usd: 0.04, position: 1
    },
    {
      key: "flux", kind: "image", provider: "flux", model_id: "fal-ai/flux/schnell",
      label: "速い", description: "生成が速く、絵画的な表現が得意です。",
      requires_env: "FAL_API_KEY", credit_points: 100, unit_cost_usd: 0.003, position: 2
    },
    {
      key: "gpt-4o-mini", kind: "text", provider: "openai", model_id: "gpt-4o-mini",
      label: "文章（軽い）", description: "意味・タグなど、ふだんの文章生成に使います。",
      requires_env: "OPENAI_API_KEY", default_for_kind: true,
      credit_points: 1, unit_cost_usd: 0.15, output_cost_usd: 0.6, position: 3
    },
    {
      key: "gpt-4o", kind: "text", provider: "openai", model_id: "gpt-4o",
      label: "文章（重い）", description: "ファクトチェックなど、確かさが要る場面に使います。",
      requires_env: "OPENAI_API_KEY", credit_points: 1, unit_cost_usd: 2.5, output_cost_usd: 10.0,
      position: 4
    }
  ].freeze

  BUILTIN_KEYS = BUILTINS.map { |b| b[:key] }.freeze

  validates :key, presence: true, uniqueness: true, format: { with: /\A[a-z0-9][a-z0-9._:-]*\z/ }
  validates :kind, inclusion: { in: KINDS }
  validates :provider, :model_id, :label, presence: true
  validates :credit_points, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :daily_limit, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :unit_cost_usd, :output_cost_usd,
            numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validate :provider_must_exist

  scope :ordered, -> { order(:position, :created_at) }
  scope :of_kind, ->(kind) { where(kind: kind) }
  scope :usable, -> { where(enabled: true) }

  # 組み込みを取り込んでから全件返す。画面もコードもここを通す
  def self.registry
    ensure_builtins!
    ordered.to_a
  end

  # 足りない組み込みだけ入れる。既にある行は触らない（運営が変えた値を戻さない）。
  #
  # 本番では1プロセスに1回だけ確かめる（毎リクエスト数えると無駄な問い合わせが増える）。
  # 開発とテストは毎回確かめる。行を消したり作り直したりするため
  def self.ensure_builtins!
    return if @builtins_checked && !Rails.env.local?

    existing = where(key: BUILTIN_KEYS).pluck(:key).to_set
    BUILTINS.each do |attrs|
      next if existing.include?(attrs[:key])

      create!(attrs)
    rescue ActiveRecord::RecordNotUnique
      # 同時に走った別プロセスが入れた。あるならそれでよい
      nil
    end
    @builtins_checked = true
  end

  # その環境で実際に使えるか（鍵が入っているか）
  def available?
    return false unless enabled?
    return true if requires_env.blank?

    ENV[requires_env].present?
  end

  # 利用者に選ばせてよいか
  def selectable?
    available? && visible?
  end

  # その用途に使ってよいか。空なら制限なし
  def serves?(purpose)
    purposes.blank? || purposes.include?(purpose.to_s)
  end

  # 今日ぶんの上限に達しているか。制限なしなら常に false
  def daily_limit_reached?(now = Time.current)
    return false if daily_limit.blank?

    ImageUsage.where(model: model_id, created_at: now.beginning_of_day..).count >= daily_limit
  end

  def builtin?
    BUILTIN_KEYS.include?(key)
  end

  private

  # 実装の無い provider を登録できてしまうと、選んだ瞬間に落ちる
  def provider_must_exist
    return unless kind == "image"
    return if GenerateImageService::PROVIDERS.key?(provider)

    errors.add(:provider, "に対応する実装がありません（#{GenerateImageService::PROVIDERS.keys.join(" / ")}）")
  end
end
