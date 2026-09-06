require "rails_helper"

# 関係を、カード1枚ずつに書かせる。
#
# 平らな relations 配列で頼んでいた頃は、14枚の盤に6本しか返らなかった。
# 資料に「ゼウスの兄弟です」「アテナに相当します」と書いてあるのに、
# その線すら出てこない。一方 readings（1枚ずつ書かせる欄）は全枚数が返っていた。
# 差は**1枚ずつ数え上げさせているか**だけだったので、関係も同じ欄へ移した。
#
# 1枚ずつ書かせると、同じ組が両側から出てくる。それでよい——
# 「相手が書いたはず」と省かせるほうが見落としになる。1本にまとめるのはこちら。
RSpec.describe "Views::AiEditService カード単位の関係" do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:view) { user.views.create!(name: "テスト", view_type: "freeboard") }

  def card(title)
    item = user.items.create!(title: title, item_type: item_type, generation_status: "completed")
    view.view_items.create!(item: item, x: 0, y: 0)
    item
  end

  def stub_plan(plan)
    allow(Ai::Chat).to receive(:call).and_return(
      { "choices" => [ { "message" => { "content" => plan.to_json } } ] }
    )
  end

  def edges
    view.reload.view_edges.map { |e| [ e.source_node_id, e.target_node_id, e.style["relation"] ] }
  end

  let(:a) { card("親") }
  let(:b) { card("子") }
  let(:c) { card("孫") }

  describe "readings に書かれた links" do
    it "線になる" do
      stub_plan("readings" => [
        { "id" => a.id, "gist" => "親", "links" => [
          { "to" => b.id, "type" => "parent", "label" => "子", "strength" => 0.9 }
        ] },
        { "id" => b.id, "gist" => "子", "links" => [] }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges).to eq([ [ a.id, b.id, "parent" ] ])
    end

    it "根拠（basis）を線に残す" do
      stub_plan("readings" => [
        { "id" => a.id, "links" => [
          { "to" => b.id, "type" => "parent", "strength" => 0.9, "basis" => "explicit" }
        ] }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(view.reload.view_edges.first.style["basis"]).to eq("explicit")
    end

    it "知らない根拠の語は残さない（推測で埋めない）" do
      stub_plan("readings" => [
        { "id" => a.id, "links" => [
          { "to" => b.id, "type" => "parent", "strength" => 0.9, "basis" => "たぶん" }
        ] }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(view.reload.view_edges.first.style["basis"]).to be_nil
    end

    it "盤に無いカードへの links は捨てる" do
      other = user.items.create!(title: "盤の外", item_type: item_type, generation_status: "completed")
      stub_plan("readings" => [
        { "id" => a.id, "links" => [ { "to" => other.id, "type" => "parent", "strength" => 0.9 } ] }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges).to be_empty
    end

    it "links が空でも、他のカードの線は引ける（無理に繋がない）" do
      stub_plan("readings" => [
        { "id" => a.id, "links" => [ { "to" => b.id, "type" => "parent", "strength" => 0.9 } ] },
        { "id" => c.id, "links" => [], "no_link" => "関係が読み取れない" }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges).to eq([ [ a.id, b.id, "parent" ] ])
    end
  end

  describe "両側から出てきた同じ組" do
    it "1本にまとめる" do
      stub_plan("readings" => [
        { "id" => a.id, "links" => [ { "to" => b.id, "type" => "parent", "label" => "子", "strength" => 0.9 } ] },
        { "id" => b.id, "links" => [ { "to" => a.id, "type" => "parent", "label" => "親", "strength" => 0.7 } ] }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges).to eq([ [ a.id, b.id, "parent" ] ])
    end

    # 先勝ちだと、資料に書いてある関係を、思いつきの related が押しのける
    it "残すのは先に出たものではなく、いちばん確かなもの" do
      stub_plan("readings" => [
        { "id" => a.id, "links" => [ { "to" => b.id, "type" => "related", "label" => "関係", "strength" => 0.6 } ] },
        { "id" => b.id, "links" => [ { "to" => a.id, "type" => "spouse", "label" => "夫", "strength" => 0.95 } ] }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges).to eq([ [ b.id, a.id, "spouse" ] ])
    end

    # 根拠を見ないと、両側から同じ強さで書かれた親子の向きが id 順で決まり、
    # どちらが親かが盤ごとに変わってしまう
    it "確からしさが同じなら、資料に書いてあるほうを残す" do
      stub_plan("readings" => [
        { "id" => a.id, "links" => [
          { "to" => b.id, "type" => "parent", "strength" => 0.9, "basis" => "world" }
        ] },
        { "id" => b.id, "links" => [
          { "from" => b.id, "to" => a.id, "type" => "parent", "strength" => 0.9, "basis" => "explicit" }
        ] }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges).to eq([ [ b.id, a.id, "parent" ] ])
    end

    it "確からしさが同じなら、具体的な種類のほうを残す" do
      stub_plan("readings" => [
        { "id" => a.id, "links" => [ { "to" => b.id, "type" => "related", "strength" => 0.9 } ] },
        { "id" => b.id, "links" => [ { "to" => a.id, "type" => "sibling", "strength" => 0.9 } ] }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges.first.last).to eq("sibling")
    end
  end

  describe "これまでの形" do
    it "平らな relations だけでも、これまでどおり動く" do
      stub_plan("relations" => [
        { "from" => a.id, "to" => b.id, "type" => "parent", "strength" => 0.9 }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges).to eq([ [ a.id, b.id, "parent" ] ])
    end

    it "links と relations の両方があれば、どちらも使う" do
      stub_plan(
        "readings" => [ { "id" => a.id, "links" => [ { "to" => b.id, "type" => "parent", "strength" => 0.9 } ] } ],
        "relations" => [ { "from" => b.id, "to" => c.id, "type" => "parent", "strength" => 0.9 } ]
      )

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges).to contain_exactly([ a.id, b.id, "parent" ], [ b.id, c.id, "parent" ])
    end
  end
end

# 1枚ずつ読ませると、向きが読んだ順に引きずられる。
# ヘルメスのカードを読みながら「ゼウスの子」と書けば、素直に
# ヘルメス→ゼウス と書いてしまい、家系図の親子が上下さかさまになる
RSpec.describe "Views::AiEditService links の向き" do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:view) { user.views.create!(name: "テスト", view_type: "freeboard") }

  def card(title)
    item = user.items.create!(title: title, item_type: item_type, generation_status: "completed")
    view.view_items.create!(item: item, x: 0, y: 0)
    item
  end

  def stub_plan(plan)
    allow(Ai::Chat).to receive(:call).and_return(
      { "choices" => [ { "message" => { "content" => plan.to_json } } ] }
    )
  end

  let(:parent) { card("親") }
  let(:child) { card("子") }

  it "子のカードから書いても、from に親を書けばその向きで引く" do
    stub_plan("readings" => [
      { "id" => child.id, "links" => [
        { "from" => parent.id, "to" => child.id, "type" => "parent", "label" => "子", "strength" => 0.9 }
      ] }
    ])

    Views::AiEditService.call(view: view, instruction: "家系図に")

    edge = view.reload.view_edges.first
    expect([ edge.source_node_id, edge.target_node_id ]).to eq([ parent.id, child.id ])
  end

  it "from が無ければ、これまでどおりそのカードから相手へ引く" do
    stub_plan("readings" => [
      { "id" => parent.id, "links" => [ { "to" => child.id, "type" => "parent", "strength" => 0.9 } ] }
    ])

    Views::AiEditService.call(view: view, instruction: "家系図に")

    edge = view.reload.view_edges.first
    expect([ edge.source_node_id, edge.target_node_id ]).to eq([ parent.id, child.id ])
  end

  # 「片方はこのカード自身のはず」と決めて片端を書き換えていた頃は、
  # 読んでいるカードと関係のない2枚の関係を、別の関係にすり替えていた
  it "どちらの端もこのカードでなくても、書かれたまま引く（すり替えない）" do
    other = card("よそ")
    stub_plan("readings" => [
      { "id" => parent.id, "links" => [
        { "from" => other.id, "to" => child.id, "type" => "parent", "strength" => 0.9 }
      ] }
    ])

    Views::AiEditService.call(view: view, instruction: "家系図に")

    edge = view.reload.view_edges.first
    expect([ edge.source_node_id, edge.target_node_id ]).to eq([ other.id, child.id ])
  end
end

# 種類の言い換えと、省ける兄弟線。
RSpec.describe "Views::AiEditService 関係の整え方" do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let(:view) { user.views.create!(name: "テスト", view_type: "freeboard") }

  def card(title)
    item = user.items.create!(title: title, item_type: item_type, generation_status: "completed")
    view.view_items.create!(item: item, x: 0, y: 0)
    item
  end

  def stub_plan(plan)
    allow(Ai::Chat).to receive(:call).and_return(
      { "choices" => [ { "message" => { "content" => plan.to_json } } ] }
    )
  end

  def edges
    view.reload.view_edges.map { |e| [ e.source_node_id, e.target_node_id, e.style["relation"] ] }
  end

  let(:zeus) { card("ゼウス") }
  let(:hermes) { card("ヘルメス") }
  let(:ares) { card("アレス") }

  describe "語彙に無い種類" do
    # child を related に落としていた頃、家系図の親子が全部「関係」になっていた
    it "child は親子に直し、向きを入れ替える" do
      stub_plan("relations" => [
        { "from" => hermes.id, "to" => zeus.id, "type" => "child", "label" => "子", "strength" => 0.9 }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges).to eq([ [ zeus.id, hermes.id, "parent" ] ])
    end

    it "twin は兄弟に直す" do
      stub_plan("relations" => [
        { "from" => hermes.id, "to" => ares.id, "type" => "twin", "strength" => 0.9 }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges.first.last).to eq("sibling")
    end

    # 向きは「from が上」。言い換えごとに、入れ替えるかどうかが違う
    it "part_of は全体を上にする（入れ替える）" do
      stub_plan("relations" => [
        { "from" => hermes.id, "to" => ares.id, "type" => "part_of", "strength" => 0.9 }
      ])

      Views::AiEditService.call(view: view, instruction: "整えて")

      expect(edges).to eq([ [ ares.id, hermes.id, "part" ] ])
    end

    # 「アテナは神殿に祀られる」＝ from が神、to が場所。入れ替えない
    it "located_in は書かれた向きのまま所属にする" do
      stub_plan("relations" => [
        { "from" => hermes.id, "to" => ares.id, "type" => "located_in", "strength" => 0.9 }
      ])

      Views::AiEditService.call(view: view, instruction: "整えて")

      expect(edges).to eq([ [ hermes.id, ares.id, "belongs_to" ] ])
    end

    it "大文字や前後の空白があっても読む" do
      stub_plan("relations" => [
        { "from" => hermes.id, "to" => zeus.id, "type" => " Child ", "strength" => 0.9 }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges).to eq([ [ zeus.id, hermes.id, "parent" ] ])
    end

    it "見当のつかない語は、これまでどおり「その他」へ落とす" do
      stub_plan("relations" => [
        { "from" => hermes.id, "to" => ares.id, "type" => "ふしぎ", "strength" => 0.9 }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges.first.last).to eq("related")
    end
  end

  describe "省ける兄弟線" do
    def family
      [ { "from" => zeus.id, "to" => hermes.id, "type" => "parent", "label" => "子", "strength" => 0.9 },
        { "from" => zeus.id, "to" => ares.id, "type" => "parent", "label" => "子", "strength" => 0.9 },
        { "from" => hermes.id, "to" => ares.id, "type" => "sibling", "label" => "兄弟", "strength" => 0.9 } ]
    end

    it "共通の親が図にいる兄弟の線は引かない" do
      stub_plan("relations" => family)

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges).to contain_exactly([ zeus.id, hermes.id, "parent" ], [ zeus.id, ares.id, "parent" ])
    end

    it "省いたことを伝える" do
      stub_plan("relations" => family)

      result = Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(result.notes).to include("兄弟の線を1本、省きました")
    end

    it "共通の親が図にいなければ引く" do
      stub_plan("relations" => [
        { "from" => hermes.id, "to" => ares.id, "type" => "sibling", "label" => "兄弟", "strength" => 0.9 }
      ])

      Views::AiEditService.call(view: view, instruction: "家系図に")

      expect(edges).to eq([ [ hermes.id, ares.id, "sibling" ] ])
    end
  end
end
