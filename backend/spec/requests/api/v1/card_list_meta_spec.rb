require "rails_helper"

# 一覧の並べ方を、カードではなく一覧そのものに1回だけ返す。
#
# これを渡していなかったころ、絵と項目の並びはカード側に固定で書かれていた。
# そのため **設定で「イメージ」を外しても絵が出続け、項目を並べ替えても順が変わらなかった。**
RSpec.describe "一覧の並べ方（meta.card_list）", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  def layout!(rows)
    setting = user.setting || user.create_setting!
    setting.update!(card_list_layout: rows)
  end

  def meta
    get "/api/v1/items", headers: headers
    json_response["meta"]["card_list"]
  end

  before { user.items.create!(title: "語", item_type: item_type) }

  it "既定では見出し語と絵と意味・説明を出す" do
    expect(meta["blocks"]).to eq(%w[image meaning])
    expect(meta["image"]).to be(true)
  end

  it "イメージを外すと、絵を出さないと分かる形で返る" do
    layout!([ { "key" => "title", "visible" => true }, { "key" => "image", "visible" => false },
              { "key" => "meaning", "visible" => true } ])

    expect(meta["image"]).to be(false)
    expect(meta["blocks"]).to eq([ "meaning" ])
  end

  it "並べ替えた順のまま返る（絵と項目が入れ替わる）" do
    layout!([ { "key" => "title", "visible" => true }, { "key" => "meaning", "visible" => true },
              { "key" => "image", "visible" => true } ])

    expect(meta["blocks"]).to eq(%w[meaning image])
  end

  it "名前として使っている項目は、下にもう一度出さない" do
    PropertyDefinition.create!(user: user, item_type: item_type, key: "reading", label: "読み方", value_type: "text")
    layout!([ { "key" => "reading", "visible" => true }, { "key" => "image", "visible" => true } ])

    # reading が見出しに使われるので blocks からは落ちる
    expect(meta["blocks"]).to eq([ "image" ])
  end

  it "隠した項目は返らない" do
    layout!([ { "key" => "title", "visible" => true }, { "key" => "image", "visible" => true },
              { "key" => "meaning", "visible" => false } ])

    expect(meta["blocks"]).to eq([ "image" ])
  end

  describe "設定を変えた直後" do
    it "次に取り直した一覧へそのまま出る（再読み込みを挟まない）" do
      expect(meta["blocks"]).to eq(%w[image meaning])

      patch "/api/v1/settings",
            params: { setting: { card_list_layout: [ { key: "title", visible: true },
                                                     { key: "meaning", visible: true },
                                                     { key: "image", visible: false } ] } },
            headers: headers, as: :json
      expect(response).to have_http_status(:ok)

      expect(meta["blocks"]).to eq([ "meaning" ])
      expect(meta["image"]).to be(false)
    end
  end
end
