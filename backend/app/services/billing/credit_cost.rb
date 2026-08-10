# frozen_string_literal: true

module Billing
  # 生成1件あたりの消費コスト（ポイント）を返すポリシー。
  #
  # モデルごとの値は登録簿（AiModel）が持つ。原価の高いモデルを足したときに、
  # 消費クレジットを上げ忘れて粗利だけ減る、ということが起きないようにするため
  # 同じ行に並べてある。
  #
  # 登録簿に値が無ければ既定（1クレジット）。値を消しても止まらないようにする。
  module CreditCost
    module_function

    BASE_GENERATION = POINTS_PER_CREDIT

    # model_key を渡すと、そのモデルの設定を使う。
    # 作り直しも新しい画像を1枚作るので、原価は初回と同じ。値引きの根拠が無い
    def call(kind: :item_generation, model_key: nil, **_context)
      points_for(model_key) || BASE_GENERATION
    end

    def points_for(model_key)
      return nil if model_key.blank?

      model = AiModel.registry.find { |m| m.kind == "image" && m.key == model_key.to_s }
      model&.credit_points
    end
  end
end
