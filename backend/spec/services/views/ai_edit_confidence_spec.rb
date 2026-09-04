require "rails_helper"

# 確かでない関係は、線にしない。
RSpec.describe "Views::AiEditService 確からしさ" do
  let(:user) { create(:user) }
  let(:view) { create(:view, user: user, view_type: "freeboard") }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }

  def place(title)
    item = create(:item, user: user, item_type: item_type, title: title)
    create(:view_item, view: view, item: item, x: 0, y: 0)
    item.id
  end

  def run(relations)
    plan = { "structure" => "hierarchy", "relations" => relations }
    allow(Ai::Chat).to receive(:call).and_return(
      { "choices" => [ { "message" => { "content" => plan.to_json } } ] }
    )
    Views::AiEditService.call(view: view, instruction: "整えて")
  end

  it "確かな関係は線になる" do
    a = place("ゼウス")
    b = place("アテナ")

    run([ { "from" => a, "to" => b, "type" => "parent", "label" => "娘", "strength" => 0.9 } ])

    expect(view.view_edges.count).to eq(1)
  end

  it "確かでない関係は線にしない" do
    a = place("ゼウス")
    b = place("アテナ")

    run([ { "from" => a, "to" => b, "type" => "parent", "label" => "娘", "strength" => 0.3 } ])

    expect(view.view_edges.count).to eq(0)
  end

  it "落としたことを黙らない" do
    a = place("ゼウス")
    b = place("アテナ")

    result = run([ { "from" => a, "to" => b, "type" => "parent", "label" => "娘", "strength" => 0.3 } ])

    expect(result.notes).to include("確かでない関係を1本、線にしませんでした")
  end

  # 「AはBの親だ」は間違っていれば誤り。「AはBと関係がある」は幅がある
  it "同じ確からしさでも、種類で結果が変わる" do
    a = place("ゼウス")
    b = place("アテナ")

    run([ { "from" => a, "to" => b, "type" => "related", "label" => "関わり", "strength" => 0.45 } ])
    expect(view.view_edges.count).to eq(1)

    view.view_edges.destroy_all
    run([ { "from" => a, "to" => b, "type" => "parent", "label" => "娘", "strength" => 0.45 } ])
    expect(view.reload.view_edges.count).to eq(0)
  end

  describe "新しい種類" do
    it "夫婦は二重線になる" do
      a = place("ゼウス")
      b = place("ヘラ")

      run([ { "from" => a, "to" => b, "type" => "spouse", "label" => "妻", "strength" => 0.9 } ])

      expect(view.view_edges.first.style["line_style"]).to eq("double")
    end

    it "兄弟は二重線にしない（夫婦と見分けが付かなくなる）" do
      a = place("ゼウス")
      b = place("ポセイドン")

      run([ { "from" => a, "to" => b, "type" => "sibling", "label" => "兄弟", "strength" => 0.9 } ])

      expect(view.view_edges.first.style["line_style"]).not_to eq("double")
    end

    it "同一視は両向きの矢印になる" do
      a = place("アテナ")
      b = place("ミネルヴァ")

      run([ { "from" => a, "to" => b, "type" => "equivalent", "label" => "同一視", "strength" => 0.9 } ])

      style = view.view_edges.first.style
      expect(style["marker_start"]).to eq("arrow")
      expect(style["marker_end"]).to eq("arrow")
    end

    it "所属は段を作る（親子と同じく上下に置かれる）" do
      a = place("アテナ")
      b = place("パルテノン神殿")

      run([ { "from" => a, "to" => b, "type" => "belongs_to", "label" => "祀られる", "strength" => 0.8 } ])

      athena = view.view_items.find_by(item_id: a)
      temple = view.view_items.find_by(item_id: b)
      expect(temple.y).to be > athena.y
    end

    it "知らない種類は「その他」へ落とす" do
      a = place("A")
      b = place("B")

      run([ { "from" => a, "to" => b, "type" => "しらない", "label" => "x", "strength" => 0.9 } ])

      expect(view.view_edges.first.style["relation"]).to eq("related")
    end
  end
end
