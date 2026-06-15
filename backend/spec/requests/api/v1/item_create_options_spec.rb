require "rails_helper"

RSpec.describe "Api::V1::Items create with style options", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }

  before { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  it "スタイルとカスタムプロンプト付きで作成できる" do
    post "/api/v1/items",
      params: { item: { title: "cat", style: "watercolor", custom_prompt: "wearing a hat" } },
      headers: headers

    expect(response).to have_http_status(:accepted)
    expect(json_response["style"]).to eq("watercolor")
    item = user.items.last
    expect(item.style).to eq("watercolor")
    expect(item.custom_prompt).to eq("wearing a hat")
  end

  it "不正なスタイルは 422" do
    post "/api/v1/items",
      params: { item: { title: "cat", style: "invalid-style" } },
      headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it "スタイル未指定でも従来どおり作成できる" do
    post "/api/v1/items", params: { item: { title: "dog" } }, headers: headers

    expect(response).to have_http_status(:accepted)
    expect(json_response["style"]).to be_nil
  end

  describe "deck_ids での作成時デッキ追加" do
    it "指定した自分のデッキに作成カードを追加する" do
      deck1 = create(:deck, user: user)
      deck2 = create(:deck, user: user)

      post "/api/v1/items",
        params: { item: { title: "cat", deck_ids: [ deck1.id, deck2.id ] } },
        headers: headers

      expect(response).to have_http_status(:accepted)
      item = user.items.last
      expect(deck1.reload.items).to include(item)
      expect(deck2.reload.items).to include(item)
    end

    it "他人のデッキ ID は無視する" do
      other_deck = create(:deck, user: create(:user, :confirmed))

      post "/api/v1/items",
        params: { item: { title: "cat", deck_ids: [ other_deck.id ] } },
        headers: headers

      expect(response).to have_http_status(:accepted)
      expect(other_deck.reload.items).to be_empty
    end
  end

  describe "generate_meaning オプション" do
    it "true なら設定 OFF でも GenerateMeaningJob をエンキューする" do
      create(:setting, user: user, auto_generate_meanings: false)

      expect {
        post "/api/v1/items", params: { item: { title: "光合成", generate_meaning: true } }, headers: headers
      }.to have_enqueued_job(GenerateMeaningJob)
      expect(response).to have_http_status(:accepted)
    end
  end
end
