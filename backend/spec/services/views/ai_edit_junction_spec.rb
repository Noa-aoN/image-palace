require "rails_helper"

# 幹の分かれ目に、接合点を置く。
#
# 線は既に1本の幹にまとめて描いているが、幹そのものは掴めなかった。
# 目には1本に見えるのに、触れるのは個々の線だけだった。
RSpec.describe "Views::AiEditService 幹の接合点" do
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
    Views::AiEditService.call(view: view, instruction: "家系図に")
  end

  # 父と母、その共通の子2人
  def family
    ids = { father: place("父"), mother: place("母"), child1: place("子1"), child2: place("子2") }
    relations = [
      { "from" => ids[:father], "to" => ids[:mother], "type" => "peer", "label" => "妻" },
      { "from" => ids[:father], "to" => ids[:child1], "type" => "parent", "label" => "子" },
      { "from" => ids[:mother], "to" => ids[:child1], "type" => "parent", "label" => "子" },
      { "from" => ids[:father], "to" => ids[:child2], "type" => "parent", "label" => "子" },
      { "from" => ids[:mother], "to" => ids[:child2], "type" => "parent", "label" => "子" }
    ]
    [ ids, relations ]
  end

  describe "置く" do
    it "夫婦から子への幹に、接合点ができる" do
      _, relations = family

      expect { run(relations) }.to change { view.view_shapes.where(kind: "junction").count }.by(1)
    end

    it "こちらが置いたものだと分かる印を付ける" do
      _, relations = family
      run(relations)

      expect(view.view_shapes.find_by(kind: "junction").style["source"]).to eq("auto")
    end

    it "幹が無い図には置かない" do
      a = place("A")
      b = place("B")

      expect { run([ { "from" => a, "to" => b, "type" => "parent", "label" => "子" } ]) }
        .not_to change { view.view_shapes.where(kind: "junction").count }
    end
  end

  describe "置き直す" do
    it "整えるたびに増えない" do
      _, relations = family
      run(relations)

      expect { run(relations) }.not_to change { view.view_shapes.where(kind: "junction").count }
    end

    # 手で置いた点は、こちらの都合で消さない
    it "手で置いた接合点は消さない" do
      _, relations = family
      manual = view.view_shapes.create!(kind: "junction", x: 900, y: 900, width: 14, height: 14)

      run(relations)

      expect(ViewShape.exists?(manual.id)).to be(true)
    end
  end

  describe "線の意味は変えない" do
    # 組み替えると、どちらの親から見た関係かが図から消える
    it "線は親から子のまま（接合点を経由する形にしない）" do
      ids, relations = family
      run(relations)

      pairs = view.view_edges.pluck(:source_node_id, :target_node_id)
      expect(pairs).to include([ ids[:father], ids[:child1] ])
      expect(pairs).to include([ ids[:mother], ids[:child1] ])
      expect(pairs.flatten).not_to include(view.view_shapes.find_by(kind: "junction").id)
    end
  end
end
