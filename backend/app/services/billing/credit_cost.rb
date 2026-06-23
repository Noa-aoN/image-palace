# frozen_string_literal: true

module Billing
  # 生成1件あたりの消費コスト（ポイント）を返すポリシー。
  # 将来 model/quality・キャッシュHIT/MISS・再生成かどうか等で倍率や割引を入れられるよう
  # context を受ける口だけ用意しておく（現状は一律 1クレジット）。
  module CreditCost
    module_function

    BASE_GENERATION = POINTS_PER_CREDIT

    def call(kind: :item_generation, **_context)
      case kind
      when :item_generation, :point_generation
        BASE_GENERATION
      else
        BASE_GENERATION
      end
    end
  end
end
