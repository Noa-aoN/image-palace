# frozen_string_literal: true

# カード1枚の、ある項目の値。
#
# 中身は `value["v"]` に入れる。型ごとに列を分けないのは、
# 型が増えるたびに移行が要るのと、list（複数値）が列に収まらないため。
# そのぶん**出し入れは必ずこのモデルを通す**。生の jsonb を画面まで運ばない。
class ItemProperty < ApplicationRecord
  belongs_to :item
  belongs_to :property_definition

  # 自由な指示の上限。長い文はそのまま費用と待ち時間になる
  MAX_FREE_IMAGE_PROMPT = 500
  MAX_TEXT_LENGTH = 2_000
  # 1つの項目に置ける読み方の数。**多すぎると、主にしたいものが埋もれる**
  MAX_READINGS = 12
  READING_CODE_LENGTH = 12
  READING_TEXT_LENGTH = 120

  MAX_LIST_SIZE = 50

  validate :value_must_match_type

  # 型に合わせて整えた値を返す。未設定は list なら空配列、それ以外は nil
  def typed_value
    raw = value.is_a?(Hash) ? value["v"] : nil
    property_definition.list? ? Array(raw) : raw
  end

  def boolean?
    property_definition&.value_type == "boolean"
  end

  def free_text?
    property_definition&.value_type == "free_text"
  end

  # 言語ごとの読み方を、ひとつの項目で持つ。
  #
  # **どれを主として出すかは、そのときの基本言語で決まる。**
  # 基本言語を変えても、値は動かさない（出す順が変わるだけ）
  def reading?
    property_definition&.value_type == "reading"
  end

  def free_image?
    property_definition&.value_type == "free_image"
  end

  # 画面・API から来た値を、型に合わせて整えてから入れる
  def typed_value=(input)
    self.value = { "v" => normalize(input) }
  end

  # 値が空か（空なら行ごと消す。空の行を残すと「未設定」と区別が付かない）
  def blank_value?
    v = typed_value
    return v.nil? if boolean? # **false は「入っていない」ではない**
    return v.blank? || v.values.all?(&:blank?) if free_text?
    return v.blank? if free_image?
    return v.blank? if reading?

    property_definition.list? ? v.empty? : v.blank?
  end

  private

  def normalize(input)
    case property_definition.value_type
    when "list"
      Array(input).map { |v| v.to_s.strip }.reject(&:blank?).first(MAX_LIST_SIZE)
    when "number"
      # 数として読めないものは捨てる（"12個" のような入力を黙って 12 にしない）
      Float(input.to_s, exception: false)
    when "boolean"
      # 空で来たら「触っていない」。false と分けて持つ
      input.nil? || input == "" ? nil : ActiveModel::Type::Boolean.new.cast(input)
    when "free_text"
      normalize_free_text(input)
    when "free_image"
      normalize_free_image(input)
    when "reading"
      normalize_reading(input)
    else
      input.to_s.strip.presence
    end
  end

  # 言語ごとの読み方。
  #
  #   [ { "language" => "ja", "text" => "でぃーえぬえす" },
  #     { "language" => "en", "text" => "dee-en-ess" } ]
  #
  # **並びで持つ。** 対応表（`{ "ja" => … }`）にすると jsonb が鍵の順を保たず、
  # 書いた順が失われる（長さと綴りで並び替えられる）。
  # どれを主にするかは基本の言語で決まるが、残りは書いた順に出したい。
  #
  # **言語の綴りは決め打ちしない。** 学ぶ言語は人によって違い、
  # こちらが並べた一覧に無い言語を書けないほうが困る。
  # ただし綴りの形（小文字と `-`）だけは揃える（`ja` と `JA` を別にしない）。
  #
  # 空になった言語と、同じ言語の重複は落とす
  def normalize_reading(input)
    raw = input.is_a?(String) ? (JSON.parse(input) rescue nil) : input
    rows = raw.is_a?(Hash) ? raw.map { |k, v| { "language" => k, "text" => v } } : raw
    return nil unless rows.is_a?(Array)

    seen = Set.new
    rows.filter_map { |row|
      next unless row.is_a?(Hash)

      code = row["language"].to_s.strip.downcase.gsub(/[^a-z0-9-]/, "")[0, READING_CODE_LENGTH]
      text = row["text"].to_s.strip[0, READING_TEXT_LENGTH]
      next if code.blank? || text.blank? || !seen.add?(code)

      { "language" => code, "text" => text }
    }.first(MAX_READINGS).presence
  end

  # 見出しと中身の2つを持つ。**どちらも空なら未設定**（片方だけでも入っていれば残す）。
  # 文字列で来ることもある（画面からは JSON で送る）ので、そこも受ける
  def normalize_free_text(input)
    raw = input.is_a?(String) ? (JSON.parse(input) rescue { "body" => input }) : input
    return nil unless raw.is_a?(Hash)

    # **黙って切らない。** 長すぎるものは検証で断る（切ると、書いた人は
    # 消えたことに気づけない）
    heading = raw["heading"].to_s.strip
    body = raw["body"].to_s.strip
    return nil if heading.blank? && body.blank?

    { "heading" => heading, "body" => body }
  end

  # 小見出し・指示・出来上がった絵・いまの状態を持つ。
  # 絵そのものは shared_medias にあるので、ここは指し示すだけ
  FREE_IMAGE_STATUSES = %w[pending processing completed failed].freeze

  def normalize_free_image(input)
    raw = input.is_a?(String) ? (JSON.parse(input) rescue nil) : input
    return nil unless raw.is_a?(Hash)

    heading = raw["heading"].to_s.strip
    prompt = raw["prompt"].to_s.strip
    return nil if heading.blank? && prompt.blank?

    {
      "heading" => heading,
      "prompt" => prompt,
      "shared_media_id" => raw["shared_media_id"].presence,
      "status" => FREE_IMAGE_STATUSES.include?(raw["status"].to_s) ? raw["status"].to_s : "pending",
      "error" => raw["error"].presence
    }.compact
  end

  def value_must_match_type
    v = typed_value
    case property_definition&.value_type
    when "list"
      errors.add(:value, "は#{MAX_LIST_SIZE}件までです") if v.size > MAX_LIST_SIZE
      errors.add(:value, "の1件が長すぎます") if v.any? { |s| s.to_s.length > MAX_TEXT_LENGTH }
    when "number"
      errors.add(:value, "は数で入力してください") if value["v"].present? && !v.is_a?(Numeric)
    when "date"
      errors.add(:value, "は日付で入力してください") if v.present? && (Date.parse(v.to_s) rescue nil).nil?
    when "url"
      errors.add(:value, "は http(s) の URL で入力してください") if v.present? && !v.to_s.match?(%r{\Ahttps?://})
    when "boolean"
      errors.add(:value, "は入 / 切で入力してください") unless [ true, false, nil ].include?(v)
    when "free_text"
      errors.add(:value, "が長すぎます") if v.is_a?(Hash) && v.values.any? { |t| t.to_s.length > MAX_TEXT_LENGTH }
    when "free_image"
      errors.add(:value, "の指示が長すぎます") if v.is_a?(Hash) && v["prompt"].to_s.length > MAX_FREE_IMAGE_PROMPT
    else
      errors.add(:value, "が長すぎます") if v.to_s.length > MAX_TEXT_LENGTH
    end
  end
end
