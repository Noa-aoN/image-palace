# frozen_string_literal: true

# カード1枚の、ある項目の値。
#
# 中身は `value["v"]` に入れる。型ごとに列を分けないのは、
# 型が増えるたびに移行が要るのと、list（複数値）が列に収まらないため。
# そのぶん**出し入れは必ずこのモデルを通す**。生の jsonb を画面まで運ばない。
class ItemProperty < ApplicationRecord
  belongs_to :item
  belongs_to :property_definition

  MAX_TEXT_LENGTH = 2_000
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

  # 画面・API から来た値を、型に合わせて整えてから入れる
  def typed_value=(input)
    self.value = { "v" => normalize(input) }
  end

  # 値が空か（空なら行ごと消す。空の行を残すと「未設定」と区別が付かない）
  def blank_value?
    v = typed_value
    return v.nil? if boolean? # **false は「入っていない」ではない**
    return v.blank? || v.values.all?(&:blank?) if free_text?

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
    else
      input.to_s.strip.presence
    end
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
    else
      errors.add(:value, "が長すぎます") if v.to_s.length > MAX_TEXT_LENGTH
    end
  end
end
