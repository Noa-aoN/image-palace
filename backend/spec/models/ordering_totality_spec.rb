# frozen_string_literal: true

require "rails_helper"

# ページを送る問い合わせは、**並びを決め切る**こと。
#
# 同着があると LIMIT/OFFSET はページごとに違う順を返し得るので、
# 同じものが2ページに出て、別のものがどこにも出ない、という形で現れる。
# カード一覧で実際に起きた（#630）。
#
# ## なぜ「順を見るテスト」ではなく「並びの指定を見るテスト」なのか
#
# 少ない行数だと、Postgres は同着でも安定した順を返してしまう。
# 実際、対策を外しても順を確かめるテストは通った（#775 の調査で確認）。
# **通ってしまうテストは守りにならない**ので、決め切る指定があること自体を固定する。
RSpec.describe "ページ送りの並びが決め切られていること" do
  # 一意な列（主キー）が並びの最後に入っていれば、同着があっても順は1つに定まる
  def orders_by_unique_column?(sql)
    sql.match?(/ORDER BY .*\bid\b[^,]*$/i)
  end

  it "お知らせの一覧" do
    expect(orders_by_unique_column?(Notification.recent.to_sql)).to be(true),
      "Notification.recent の並びが決め切られていない: #{Notification.recent.to_sql}"
  end

  it "カード一覧（既定の並び）" do
    controller = Api::V1::ItemsController.new
    controller.params = ActionController::Parameters.new({})
    sql = Item.order(controller.send(:sort_clause)).to_sql

    expect(orders_by_unique_column?(sql)).to be(true), "カード一覧の並びが決め切られていない: #{sql}"
  end

  it "カード一覧（名前の並び）" do
    controller = Api::V1::ItemsController.new
    controller.params = ActionController::Parameters.new(sort: "title", direction: "asc")
    sql = Item.order(controller.send(:sort_clause)).to_sql

    expect(orders_by_unique_column?(sql)).to be(true), "名前で並べたときに決め切られていない: #{sql}"
  end
end
