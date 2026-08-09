require "rails_helper"

RSpec.describe "Api::V1::Views カードから作る", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:view) { create(:view, user: user, view_type: "deck") }
  let(:board) { create(:view, user: user, view_type: "freeboard") }

  # 語を選ぶところは GenerateWordsService（ワードリスト生成と共通）に任せている
  def ai_response(words)
    { "choices" => [ { "message" => { "content" => { words: words }.to_json } } ] }
  end

  describe "POST /api/v1/views/:id/card_proposal" do
    it "案を返すだけで、カードは作らない" do
      allow(Ai::Chat).to receive(:call).and_return(ai_response([ "光合成", "呼吸" ]))

      expect {
        post "/api/v1/views/#{view.id}/card_proposal",
          params: { proposal: { instruction: "生物の基本を足して" } }, headers: headers, as: :json
      }.not_to change(Item, :count)

      expect(response).to have_http_status(:success)
      expect(json_response["proposals"].map { |p| p["title"] }).to eq([ "光合成", "呼吸" ])
      expect(json_response).to have_key("available_credits")
    end

    # 同じ単語のカードが増えても嬉しくない
    it "すでに持っているカードは提案しない" do
      item_type = ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" }
      user.items.create!(title: "光合成", item_type: item_type, generation_status: "completed")
      allow(Ai::Chat).to receive(:call).and_return(ai_response([ "光合成", "呼吸" ]))

      post "/api/v1/views/#{view.id}/card_proposal",
        params: { proposal: { instruction: "足して" } }, headers: headers, as: :json

      expect(json_response["proposals"].map { |p| p["title"] }).to eq([ "呼吸" ])
    end

    # デッキは語の集まりなので、ワードリスト作成と同じ経路でよい
    it "デッキでは語の選定をワードリスト生成に任せる" do
      allow(GenerateWordsService).to receive(:call).and_return([ "光合成" ])

      post "/api/v1/views/#{view.id}/card_proposal",
        params: { proposal: { instruction: "生物" } }, headers: headers, as: :json

      expect(GenerateWordsService).to have_received(:call).with(hash_including(theme: "生物", user: user))
      expect(json_response["proposals"].map { |p| p["title"] }).to eq([ "光合成" ])
    end

    # 枚数を先に決めると、図に要る階層が枚数に合わせて切り詰められる
    # （齧歯目の亜目は5つあるのに3つしか出ない、など）
    it "枚数は既定でおまかせにする" do
      allow(GenerateWordsService).to receive(:call).and_return([ "光合成" ])

      post "/api/v1/views/#{view.id}/card_proposal",
        params: { proposal: { instruction: "生物" } }, headers: headers, as: :json

      expect(GenerateWordsService).to have_received(:call).with(hash_including(count: nil))
    end

    it "枚数を指定すればその上限を守る" do
      allow(GenerateWordsService).to receive(:call).and_return([ "光合成" ])

      post "/api/v1/views/#{view.id}/card_proposal",
        params: { proposal: { instruction: "生物", count: 5 } }, headers: headers, as: :json

      expect(GenerateWordsService).to have_received(:call).with(hash_including(count: 5))
    end

    # 「齧歯目の系統図」で具体例だけが並ぶと図にならない。
    # フリーボードでは完成図を設計させ、その部品を出させる
    context "フリーボードのとき" do
      it "語彙の列挙ではなく、図の部品として提案する" do
        allow(GenerateWordsService).to receive(:call)
        allow(Ai::Chat).to receive(:call).and_return(
          { "choices" => [ { "message" => { "content" => {
            plan: "齧歯目を頂点に、亜目、代表種の順で枝分かれする系統図",
            cards: [
              { "title" => "齧歯目", "reason" => "最上位の分類" },
              { "title" => "ネズミ亜目", "reason" => "主要な亜目" }
            ]
          }.to_json } } ] }
        )

        post "/api/v1/views/#{board.id}/card_proposal",
          params: { proposal: { instruction: "齧歯目の系統図" } }, headers: headers, as: :json

        expect(GenerateWordsService).not_to have_received(:call)
        expect(json_response["plan"]).to include("系統図")
        expect(json_response["proposals"].map { |p| p["title"] }).to eq([ "齧歯目", "ネズミ亜目" ])
        expect(json_response["proposals"].first["reason"]).to eq("最上位の分類")
      end

      # 節だけ挙げてもつながりが無ければ図にならない
      it "つながりも一緒に返す" do
        allow(Ai::Chat).to receive(:call).and_return(
          { "choices" => [ { "message" => { "content" => {
            plan: "系統図",
            cards: [ { "title" => "齧歯目" }, { "title" => "ネズミ亜目" } ],
            edges: [
              { "from" => "齧歯目", "to" => "ネズミ亜目", "label" => "下位分類" },
              { "from" => "齧歯目", "to" => "知らない語" }
            ]
          }.to_json } } ] }
        )

        post "/api/v1/views/#{board.id}/card_proposal",
          params: { proposal: { instruction: "齧歯目の系統図" } }, headers: headers, as: :json

        edges = json_response["edges"]
        expect(edges.size).to eq(1)
        expect(edges.first).to include("from" => "齧歯目", "to" => "ネズミ亜目", "label" => "下位分類")
      end

      # 手持ちにあるものを作り直すとクレジットの無駄。図には組み込む
      it "手持ちのカードは作らずに組み込む候補として返す" do
        item_type = ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" }
        owned = user.items.create!(title: "齧歯目", item_type: item_type, generation_status: "completed")
        allow(Ai::Chat).to receive(:call).and_return(
          { "choices" => [ { "message" => { "content" => {
            plan: "系統図",
            cards: [ { "title" => "ネズミ亜目" } ],
            reuse: [ { "title" => "齧歯目", "reason" => "最上位の分類" } ]
          }.to_json } } ] }
        )

        post "/api/v1/views/#{board.id}/card_proposal",
          params: { proposal: { instruction: "齧歯目の系統図" } }, headers: headers, as: :json

        expect(json_response["reuse"].first).to include("id" => owned.id, "title" => "齧歯目")
        expect(json_response["proposals"].map { |p| p["title"] }).to eq([ "ネズミ亜目" ])
      end
    end

    it "指示が空なら弾く" do
      post "/api/v1/views/#{view.id}/card_proposal",
        params: { proposal: { instruction: "  " } }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "他人のキャンバスは触れない" do
      other = create(:view, user: create(:user, :confirmed))

      post "/api/v1/views/#{other.id}/card_proposal",
        params: { proposal: { instruction: "足して" } }, headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/views/:id/create_cards" do
    before { user.ensure_free_credits! }

    it "承認された分だけ作ってキャンバスに載せる" do
      expect {
        post "/api/v1/views/#{view.id}/create_cards",
          params: { titles: [ "光合成" ] }, headers: headers, as: :json
      }.to change(Item, :count).by(1)

      expect(response).to have_http_status(:success)
      expect(json_response["created_cards"]["count"]).to eq(1)
      expect(view.reload.view_items.count).to eq(1)
    end

    # 作っただけでは部品が積み上がっただけ。指示があれば図として組み上げる
    it "指示を渡すと、作成後に配置まで行う" do
      allow(Views::AiEditService).to receive(:call).and_return(
        Views::AiEditService::Result.new(summary: "並べた", added: 0, removed: 0, placed: 1, connected: 1)
      )

      post "/api/v1/views/#{board.id}/create_cards",
        params: { titles: [ "齧歯目" ], instruction: "齧歯目の系統図" }, headers: headers, as: :json

      expect(Views::AiEditService).to have_received(:call).with(hash_including(instruction: "齧歯目の系統図"))
      expect(json_response["created_cards"]["arranged"]).to be(true)
    end

    it "手持ちのカードも図に載せる（クレジットは使わない）" do
      item_type = ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" }
      owned = user.items.create!(title: "齧歯目", item_type: item_type, generation_status: "completed")

      expect {
        post "/api/v1/views/#{board.id}/create_cards",
          params: { titles: [], reuse_ids: [ owned.id ], instruction: "系統図" }, headers: headers, as: :json
      }.not_to change(Item, :count)

      expect(response).to have_http_status(:success)
      expect(json_response["created_cards"]["reused"]).to eq(1)
      expect(board.reload.view_items.pluck(:item_id)).to include(owned.id)
    end

    # 指示文だけ渡し直すと、AI が設計を一から考え直して別の図になる
    it "承認した設計を配置へ引き継ぐ" do
      allow(Views::AiEditService).to receive(:call).and_return(
        Views::AiEditService::Result.new(summary: "並べた", added: 0, removed: 0, placed: 1, connected: 1)
      )

      post "/api/v1/views/#{board.id}/create_cards",
        params: {
          titles: [ "ネズミ亜目" ], instruction: "齧歯目の系統図",
          plan: "齧歯目を頂点にした系統図",
          edges: [ { from: "齧歯目", to: "ネズミ亜目", label: "下位分類" } ]
        }, headers: headers, as: :json

      expect(Views::AiEditService).to have_received(:call) do |args|
        expect(args[:instruction]).to include("齧歯目を頂点にした系統図")
        expect(args[:instruction]).to include("齧歯目 → ネズミ亜目（下位分類）")
      end
    end

    it "配置に失敗しても、作ったカードは残す" do
      allow(Views::AiEditService).to receive(:call).and_raise(Views::AiEditService::EditError, "失敗")

      post "/api/v1/views/#{board.id}/create_cards",
        params: { titles: [ "齧歯目" ], instruction: "系統図" }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["created_cards"]["count"]).to eq(1)
      expect(json_response["created_cards"]["arranged"]).to be(false)
    end

    it "空なら弾く" do
      post "/api/v1/views/#{view.id}/create_cards", params: { titles: [] }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "上限を超える枚数は弾く" do
      titles = Array.new(Views::CardProposalService::MAX_COUNT + 1) { |n| "語#{n}" }

      post "/api/v1/views/#{view.id}/create_cards", params: { titles: titles }, headers: headers, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    # 残高が尽きたら、作れたぶんは残す（全部巻き戻すとクレジットだけ減ったように見える）
    it "途中で残高が尽きても作れたぶんは残す" do
      allow(Items::CreateService).to receive(:call).and_wrap_original do |original, **kwargs|
        raise Items::CreateService::InsufficientCredits, "クレジットが不足しています" if kwargs[:params][:title] == "二枚目"

        original.call(**kwargs)
      end

      post "/api/v1/views/#{view.id}/create_cards",
        params: { titles: [ "一枚目", "二枚目" ] }, headers: headers, as: :json

      expect(response).to have_http_status(:success)
      expect(json_response["created_cards"]["count"]).to eq(1)
    end
  end
end
