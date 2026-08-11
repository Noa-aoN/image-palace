# frozen_string_literal: true

# ミッションのシリーズ。順に開けていく1本の道。
#
# 単発のミッションだけだと、続けた人ほど先に「もう取るものが無い」に着く。
# シリーズは、**先があること**を見せながら、渡すのは**いま挑む1段だけ**にするための入れ物。
# 全段を最初から並べると、長い道は「終わらない宿題」に見えてしまう。
class MissionSeries < ApplicationRecord
  self.table_name = "mission_series"

  has_many :mission_definitions, dependent: :nullify

  validates :key, presence: true, uniqueness: true, format: { with: /\A[a-z][a-z0-9_]*\z/ }
  validates :name, presence: true

  scope :ordered, -> { order(:position, :created_at) }
  scope :active, -> { where(enabled: true) }

  # 初期のシリーズ。段は MissionDefinition::BUILTINS 側が series_key で指す。
  # 他の登録簿（AiModel / FeatureFlag / RewardDefinition）と同じで、
  # 行が無ければここが既定になり、画面から変えたときだけ行ができる
  # 道は「作る」「思い出す」「続ける」の3本。
  # 1本に詰め込むと、作るのが好きな人と続けるのが得意な人が同じ順路を歩かされる。
  # 3本あれば、自分の得意な道から進めて、他の道は先の目印として置いておける。
  BUILTINS = [
    { key: "build_palace", name: "宮殿を建てる", position: 10,
      description: "覚えるための場所を、少しずつ整えていく道のり。" },
    { key: "train_memory", name: "記憶を鍛える", position: 20,
      description: "作るだけでなく、思い出すほうを積み上げる道のり。" },
    { key: "keep_visiting", name: "通い続ける", position: 30,
      description: "続けた日数だけが積み上がる道のり。焦らず、途切れさせないこと。" }
  ].freeze

  BUILTIN_KEYS = BUILTINS.map { |b| b[:key] }.freeze

  def self.registry
    ensure_builtins!
    ordered.to_a
  end

  def self.ensure_builtins!
    return if @builtins_checked && !Rails.env.local?

    existing = where(key: BUILTIN_KEYS).pluck(:key).to_set
    BUILTINS.each do |attrs|
      next if existing.include?(attrs[:key])

      create!(attrs)
    rescue ActiveRecord::RecordNotUnique
      nil
    end
    @builtins_checked = true
  end

  def builtin?
    BUILTIN_KEYS.include?(key)
  end

  def available?
    enabled?
  end
end
