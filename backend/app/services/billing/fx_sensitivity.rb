# frozen_string_literal: true

module Billing
  # 為替がどこまで動いても採算が持つか。
  #
  # 売る値段は円で、AI の原価はドルで決まる。**円安になるほど、同じ値段のまま原価だけが上がる。**
  # 気づくのが値上げの直前になると、利用者には「急に上げた」ようにしか見えない。
  #
  # ここでは値段も付与量も変えない。**あとどれだけ動いたら赤字になるか**を数えるだけ。
  # 数字が見えていれば、余裕のあるうちに付与量で調整できる。
  class FxSensitivity
    # ここまで細ると、値段か付与量を見直す合図（Catalog の下限と揃える）
    MIN_MARGIN = Catalog::MIN_MARGIN

    Result = Struct.new(:fx_rate, :usd_per_credit, :basis, :plans, keyword_init: true) do
      # いちばん先に音を上げるもの。**全体の余裕はここで決まる**
      def tightest = plans.min_by { |plan| plan[:break_even_fx] || Float::INFINITY }
    end

    def self.call(...) = new(...).call

    def initialize(costs: nil, consumed_credits: nil, ai_cost_jpy: nil)
      @costs = costs || CostParameter.table
      @consumed_credits = consumed_credits
      @ai_cost_jpy = ai_cost_jpy
    end

    def call
      Result.new(fx_rate: fx_rate, usd_per_credit: usd_per_credit, basis: basis, plans: plans)
    end

    private

    def fx_rate = @fx_rate ||= @costs.value_for("fx_usd_jpy").to_f

    # 1クレジットあたり、ドルでいくらか。
    #
    # 実際に使われたぶんから割り出せるならそちらを使う（設定値より実態に近い）。
    # 使われていない期間は、設定してある画像の単価に戻る。
    def usd_per_credit
      @usd_per_credit ||=
        if measured_usd_per_credit&.positive?
          measured_usd_per_credit
        else
          # 既定の画像モデルの単価に戻る（登録簿の既定）
          model = ::AiModel.registry.find { |row| row.kind == "image" && row.default_for_kind }&.model_id
          model ? @costs.image_unit_usd(model: model).to_f : 0.0
        end
    end

    def measured_usd_per_credit
      return nil if @consumed_credits.nil? || @consumed_credits.zero? || fx_rate.zero?

      @ai_cost_jpy.to_f / @consumed_credits / fx_rate
    end

    def basis = measured_usd_per_credit&.positive? ? "measured" : "configured"

    # 有料のものだけ。無料プランは採算の対象外
    def plans
      @plans ||= Catalog.paid_rows.map { |row| plan_row(row) }.compact
    end

    def plan_row(row)
      net = Catalog.unit_price(row) * (1 - Catalog::STRIPE_FEE_RATE)
      return nil if net.zero? || usd_per_credit.zero?

      {
        name: row[:name],
        jpy_per_credit: net.round(2),
        margin: margin_at(net, fx_rate),
        # ここを超えると赤字。**いまのレートからの余裕**が、備える時間そのもの
        break_even_fx: (net / usd_per_credit).round(1),
        # 赤字より手前で気づくための線
        margin_floor_fx: (net * (1 - MIN_MARGIN) / usd_per_credit).round(1),
        headroom_percent: headroom(net)
      }
    end

    def margin_at(net, rate)
      cost = usd_per_credit * rate
      return nil if net.zero?

      ((net - cost) / net * 100).round(1)
    end

    # いまのレートから、赤字になるまで何％円安に振れる余地があるか
    def headroom(net)
      return nil if fx_rate.zero? || usd_per_credit.zero?

      break_even = net / usd_per_credit
      ((break_even - fx_rate) / fx_rate * 100).round(1)
    end
  end
end
