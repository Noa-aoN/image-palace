require "rails_helper"

RSpec.describe Views::AiEditService do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }

  def card(title)
    user.items.create!(title: title, item_type: item_type, generation_status: "completed")
  end

  def stub_plan(plan)
    allow(Ai::Chat).to receive(:call).and_return(
      { "choices" => [ { "message" => { "content" => plan.to_json } } ] }
    )
  end

  describe "デッキ" do
    let(:view) { user.views.create!(name: "テスト", view_type: "deck") }
    let(:a) { card("あ") }
    let(:b) { card("い") }

    before do
      view.view_items.create!(item: a, position: 1)
      view.view_items.create!(item: b, position: 2)
    end

    it "指示どおりに並び替える" do
      stub_plan("summary" => "覚えやすい順に並べ替えました", "order" => [ b.id, a.id ])

      result = described_class.call(view: view, instruction: "覚えやすい順に並べ替えて")

      expect(result.summary).to include("並べ替え")
      expect(view.view_items.order(:position).pluck(:item_id)).to eq([ b.id, a.id ])
    end

    it "並びに挙げられなかったカードは後ろへ残す（勝手に消えない）" do
      stub_plan("order" => [ b.id ])

      described_class.call(view: view, instruction: "整理して")

      expect(view.view_items.order(:position).pluck(:item_id)).to eq([ b.id, a.id ])
    end

    it "デッキから外してもカードそのものは残る" do
      stub_plan("remove" => [ a.id ])

      described_class.call(view: view, instruction: "あ を外して")

      expect(view.reload.view_items.pluck(:item_id)).to eq([ b.id ])
      expect(Item.exists?(a.id)).to be(true)
    end
  end

  describe "フリーボード" do
    let(:view) { user.views.create!(name: "テスト", view_type: "freeboard") }
    let(:a) { card("原因") }
    let(:b) { card("結果") }

    before do
      view.view_items.create!(item: a, x: 0, y: 0)
      view.view_items.create!(item: b, x: 0, y: 0)
    end

    it "配置と接続線を作る" do
      stub_plan(
        "summary" => "流れが分かるように並べました",
        "placements" => [ { "item_id" => a.id, "x" => 100, "y" => 200 },
                          { "item_id" => b.id, "x" => 500, "y" => 200 } ],
        "edges" => [ { "source" => a.id, "target" => b.id, "label" => "から" } ]
      )

      result = described_class.call(view: view, instruction: "原因と結果を線でつないで")

      expect(result.placed).to eq(2)
      expect(result.connected).to eq(1)
      expect(view.view_items.find_by(item_id: a.id).x).to eq(100)
      edge = view.view_edges.first
      expect(edge.source_node_id).to eq(a.id)
      expect(edge.label).to eq("から")
    end

    it "盤の外へ飛ばされた座標は中に収める" do
      stub_plan("placements" => [ { "item_id" => a.id, "x" => 999_999, "y" => -500 } ])

      described_class.call(view: view, instruction: "並べて")

      placement = view.view_items.find_by(item_id: a.id)
      expect(placement.x).to eq(described_class::BOARD_WIDTH)
      expect(placement.y).to eq(0)
    end

    it "ボードに無いカードの配置・接続は無視する" do
      other = card("よそ者")
      stub_plan(
        "placements" => [ { "item_id" => other.id, "x" => 10, "y" => 10 } ],
        "edges" => [ { "source" => a.id, "target" => other.id } ]
      )

      result = described_class.call(view: view, instruction: "並べて")

      expect(result.placed).to eq(0)
      expect(view.view_edges.count).to eq(0)
    end

    it "自分自身への線は作らない" do
      stub_plan("edges" => [ { "source" => a.id, "target" => a.id } ])

      described_class.call(view: view, instruction: "つないで")

      expect(view.view_edges.count).to eq(0)
    end

    it "外したカードにつながっていた線も消す" do
      view.view_edges.create!(source_node_id: a.id, target_node_id: b.id)
      stub_plan("remove" => [ a.id ], "edges" => [ { "source" => a.id, "target" => b.id } ])

      described_class.call(view: view, instruction: "原因を外して")

      expect(view.view_edges.count).to eq(0)
    end
  end

  describe "モード" do
    let(:view) { user.views.create!(name: "テスト", view_type: "deck") }
    let!(:candidate) { card("追加候補") }

    it "placed_only では、いま載っていないカードを足さない" do
      stub_plan("add" => [ candidate.id ])

      result = described_class.call(view: view, instruction: "足して", mode: "placed_only")

      expect(result.added).to eq(0)
      expect(view.view_items.count).to eq(0)
    end

    it "select なら候補から足せる" do
      stub_plan("add" => [ candidate.id ])

      result = described_class.call(view: view, instruction: "追加候補を足して", mode: "select")

      expect(result.added).to eq(1)
      expect(view.view_items.pluck(:item_id)).to eq([ candidate.id ])
    end

    it "select でも他人のカードは足せない" do
      theirs = create(:user, :confirmed).items.create!(
        title: "他人", item_type: item_type, generation_status: "completed"
      )
      stub_plan("add" => [ theirs.id ])

      result = described_class.call(view: view, instruction: "足して", mode: "select")

      expect(result.added).to eq(0)
      expect(view.view_items.count).to eq(0)
    end

    it "知らないモードは placed_only 扱いにする" do
      stub_plan("add" => [ candidate.id ])

      result = described_class.call(view: view, instruction: "足して", mode: "なんでもあり")

      expect(result.added).to eq(0)
    end
  end

  describe "受け付けないもの" do
    let(:view) { user.views.create!(name: "テスト", view_type: "deck") }

    it "指示が空なら呼ばない" do
      allow(Ai::Chat).to receive(:call)

      expect { described_class.call(view: view, instruction: "  ") }.to raise_error(described_class::EditError)
      expect(Ai::Chat).not_to have_received(:call)
    end

    it "指示が長すぎれば呼ばない" do
      allow(Ai::Chat).to receive(:call)
      long = "あ" * (described_class::MAX_INSTRUCTION_LENGTH + 1)

      expect { described_class.call(view: view, instruction: long) }.to raise_error(described_class::EditError)
      expect(Ai::Chat).not_to have_received(:call)
    end

    it "デッキ・フリーボード以外は対象外" do
      space = user.spaces.create!(name: "空間", space_type: "room")
      other = user.views.create!(name: "配置", view_type: "space_map", space: space)

      expect { described_class.call(view: other, instruction: "並べて") }
        .to raise_error(described_class::EditError, /対象外/)
    end

    it "応答が JSON でなければ EditError" do
      allow(Ai::Chat).to receive(:call).and_return(
        { "choices" => [ { "message" => { "content" => "これはJSONではない" } } ] }
      )

      expect { described_class.call(view: view, instruction: "並べて") }
        .to raise_error(described_class::EditError)
    end
  end

  describe "AIに渡す量" do
    let(:view) { user.views.create!(name: "テスト", view_type: "deck") }

    it "候補は上限までしか渡さない（蔵書が増えても呼び出しは大きくならない）" do
      (described_class::MAX_CANDIDATES + 10).times { |i| card("語#{i}") }
      stub_plan({})

      described_class.call(view: view, instruction: "適当に足して", mode: "select")

      expect(Ai::Chat).to have_received(:call) do |kind:, messages:, **|
        expect(kind).to eq("canvas_edit")
        lines = messages.last[:content].lines.count { |line| line.start_with?("- ") }
        expect(lines).to be <= described_class::MAX_CANDIDATES
      end
    end

    it "placed_only では候補一覧そのものを渡さない" do
      card("よそ者")
      stub_plan({})

      described_class.call(view: view, instruction: "並べ替えて", mode: "placed_only")

      expect(Ai::Chat).to have_received(:call) do |messages:, **|
        expect(messages.last[:content]).to include("カードの追加はできません")
      end
    end
  end
end
