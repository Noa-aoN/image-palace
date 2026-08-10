require "rails_helper"

# 例文の AI 生成。説明はそのままで、例文だけ書き直せるようにしたぶん。
RSpec.describe "例文の生成", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item) { create(:item, user: user, title: "光合成") }

  def stub_ai(examples)
    allow(Ai::Chat).to receive(:call).and_return(
      { "choices" => [ { "message" => { "content" => { examples: examples }.to_json } } ] }
    )
  end

  it "例文の無い意味に書き込む" do
    meaning = item.meanings.create!(definition: "植物が光でエネルギーを作ること", language_code: "ja")
    stub_ai([ { id: meaning.id, example: "葉が光合成をしている。" } ])

    post "/api/v1/items/#{item.id}/examples", headers: headers, as: :json

    expect(response).to have_http_status(:ok)
    expect(meaning.reload.example_sentence).to eq("葉が光合成をしている。")
  end

  # 手で書いたものを黙って上書きしない
  it "既に例文があるものは触らない" do
    filled = item.meanings.create!(definition: "説明1", language_code: "ja", example_sentence: "手で書いた例")
    empty = item.meanings.create!(definition: "説明2", language_code: "en")
    stub_ai([ { id: empty.id, example: "書いた例" } ])

    post "/api/v1/items/#{item.id}/examples", headers: headers, as: :json

    expect(filled.reload.example_sentence).to eq("手で書いた例")
    expect(empty.reload.example_sentence).to eq("書いた例")
  end

  it "1件だけ指定すると、その1件を書き直す" do
    target = item.meanings.create!(definition: "説明1", language_code: "ja", example_sentence: "古い例")
    other = item.meanings.create!(definition: "説明2", language_code: "en", example_sentence: "そのまま")
    stub_ai([ { id: target.id, example: "新しい例" } ])

    post "/api/v1/items/#{item.id}/examples",
         params: { meaning_id: target.id }, headers: headers, as: :json

    expect(target.reload.example_sentence).to eq("新しい例")
    expect(other.reload.example_sentence).to eq("そのまま")
  end

  # 知らない id を返されても、他のカードを書き換えられないようにする
  it "対象に無い id は無視する" do
    meaning = item.meanings.create!(definition: "説明", language_code: "ja")
    foreign = create(:item, user: user).meanings.create!(definition: "他のカード", language_code: "ja")
    stub_ai([ { id: foreign.id, example: "混ぜ込まれた例" } ])

    post "/api/v1/items/#{item.id}/examples", headers: headers, as: :json

    expect(foreign.reload.example_sentence).to be_nil
    expect(meaning.reload.example_sentence).to be_nil
  end

  it "意味がなければ書けないと返す" do
    post "/api/v1/items/#{item.id}/examples", headers: headers, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it "他人のカードは触れない" do
    other = create(:item, user: create(:user, :confirmed))

    post "/api/v1/items/#{other.id}/examples", headers: headers, as: :json

    expect(response).to have_http_status(:not_found)
  end
end
