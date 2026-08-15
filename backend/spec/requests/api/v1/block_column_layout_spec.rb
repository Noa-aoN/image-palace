require "rails_helper"

# 列への振り分け。
#
# **カード1枚ごとの見え方**として持つ。次に開いたときも同じ並びで出る。
# 列の数そのものは端末ごとの設定なので、ここには持たない。
RSpec.describe "列への振り分け", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:item) { create(:item, :completed, user: user, item_type: item_type, title: "光合成") }

  def patch_view(params)
    patch "/api/v1/items/#{item.id}/block_view", params: params, headers: headers, as: :json
  end

  def view_of(response_body) = response_body["block_view"]

  it "書いていないカードは自動（画面が折り返しを決める）" do
    get "/api/v1/items/#{item.id}", headers: headers

    expect(view_of(json_response)["auto_flow"]).to be(true)
    expect(view_of(json_response)["column_counts"]).to eq([])
  end

  it "列ごとの個数を決めて残せる" do
    patch_view(order: [ "title", "image" ], auto_flow: false, column_counts: [ 1, 6, 2 ])

    expect(response).to have_http_status(:ok)
    expect(view_of(json_response)["auto_flow"]).to be(false)
    expect(view_of(json_response)["column_counts"]).to eq([ 1, 6, 2 ])
  end

  # ここが要。次に開いたときに戻っていたら、決めた意味が無い
  it "次に開いたときも、そのカードの決め方が残っている" do
    patch_view(order: [ "title" ], auto_flow: false, column_counts: [ 2, 3 ])

    get "/api/v1/items/#{item.id}", headers: headers

    expect(view_of(json_response)["auto_flow"]).to be(false)
    expect(view_of(json_response)["column_counts"]).to eq([ 2, 3 ])
  end

  # 並べ替えは order しか送らない。そこで振り分けが消えると、
  # 「動かしたら列が戻った」という原因の分かりにくい壊れ方をする
  it "並べ替えだけしても、振り分けは残る" do
    patch_view(order: [ "title" ], auto_flow: false, column_counts: [ 1, 4 ])

    patch_view(order: [ "image", "title" ])

    expect(view_of(json_response)["auto_flow"]).to be(false)
    expect(view_of(json_response)["column_counts"]).to eq([ 1, 4 ])
  end

  it "自動へ戻しても、決めた個数は覚えている（また切ったときに戻せる）" do
    patch_view(order: [ "title" ], auto_flow: false, column_counts: [ 1, 4 ])

    patch_view(order: [ "title" ], auto_flow: true)

    expect(view_of(json_response)["auto_flow"]).to be(true)
    expect(view_of(json_response)["column_counts"]).to eq([ 1, 4 ])
  end

  describe "受け取らないもの" do
    it "列は3つまで（4つ目以降は捨てる）" do
      patch_view(order: [ "title" ], column_counts: [ 1, 2, 3, 4, 5 ])

      expect(view_of(json_response)["column_counts"]).to eq([ 1, 2, 3 ])
    end

    it "負の数は0に丸める" do
      patch_view(order: [ "title" ], column_counts: [ -5, 2 ])

      expect(view_of(json_response)["column_counts"]).to eq([ 0, 2 ])
    end

    it "数でないものは0として扱う（画面から壊れた値が来ても落ちない）" do
      patch_view(order: [ "title" ], column_counts: [ "x", 2 ])

      expect(view_of(json_response)["column_counts"]).to eq([ 0, 2 ])
    end
  end

  it "ほかの人のカードは変えられない" do
    stranger = create(:user, :confirmed)

    patch "/api/v1/items/#{item.id}/block_view",
          params: { order: [ "title" ], auto_flow: false }, headers: auth_headers_for(stranger), as: :json

    expect(response).to have_http_status(:not_found)
  end
end
