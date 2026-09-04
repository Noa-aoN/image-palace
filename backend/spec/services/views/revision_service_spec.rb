require "rails_helper"

RSpec.describe Views::RevisionService do
  let(:user) { create(:user, :confirmed) }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }
  let(:view) { user.views.create!(name: "テスト", view_type: "freeboard") }

  def card(title)
    user.items.create!(title: title, item_type: item_type, generation_status: "completed")
  end

  let!(:a) { card("あ") }
  let!(:b) { card("い") }

  before do
    view.view_items.create!(item: a, x: 10, y: 10)
    view.view_items.create!(item: b, x: 20, y: 20)
    view.view_edges.create!(source_node_id: a.id, target_node_id: b.id, label: "もと")
  end

  it "はじめての控えでは、調整前の状態も一緒に残す（1回目の調整を戻せるように）" do
    expect { described_class.snapshot!(view, label: "AI調整の前") }
      .to change(ViewRevision, :count).by(2)

    expect(view.reload.revision_cursor).to eq(2)
  end

  it "戻ると配置と線が元に戻る" do
    described_class.snapshot!(view, label: "AI調整の前")
    view.view_items.find_by(item_id: a.id).update!(x: 999, y: 999)
    view.view_edges.destroy_all
    described_class.snapshot!(view.reload, label: "AI調整の後")

    described_class.undo!(view.reload)

    expect(view.reload.view_items.find_by(item_id: a.id).x).to eq(10)
    expect(view.view_edges.count).to eq(1)
    expect(view.view_edges.first.label).to eq("もと")
  end

  it "進むともう一度やり直した状態へ行ける" do
    described_class.snapshot!(view, label: "前")
    view.view_items.find_by(item_id: a.id).update!(x: 999)
    described_class.snapshot!(view.reload, label: "後")
    described_class.undo!(view.reload)

    described_class.redo!(view.reload)

    expect(view.reload.view_items.find_by(item_id: a.id).x).to eq(999)
  end

  it "戻れるところが無ければ何も変えない" do
    status = described_class.undo!(view)

    expect(status[:can_undo]).to be(false)
    expect(view.reload.view_items.count).to eq(2)
  end

  it "戻ったあとで新しく調整すると、先に進んでいた分は捨てる" do
    described_class.snapshot!(view, label: "前")
    view.view_items.find_by(item_id: a.id).update!(x: 100)
    described_class.snapshot!(view.reload, label: "後1")
    described_class.undo!(view.reload)

    view.reload.view_items.find_by(item_id: a.id).update!(x: 200)
    described_class.snapshot!(view.reload, label: "後2")

    expect(described_class.status(view.reload)[:can_redo]).to be(false)
    expect(view.view_revisions.ordered.last.label).to eq("後2")
  end

  it "控えは際限なく貯めない" do
    (described_class::MAX_REVISIONS + 5).times { |i| described_class.snapshot!(view.reload, label: "#{i}") }

    expect(view.reload.view_revisions.count).to eq(described_class::MAX_REVISIONS)
  end

  it "控えたあとに本当に消したカードは戻さない（欠けたまま戻す）" do
    described_class.snapshot!(view, label: "前")
    view.view_items.find_by(item_id: a.id).update!(x: 500)
    described_class.snapshot!(view.reload, label: "後")
    a.destroy!

    described_class.undo!(view.reload)

    expect(view.reload.view_items.pluck(:item_id)).to eq([ b.id ])
    expect(view.view_edges.count).to eq(0)
  end

  it "戻る／進むの可否を返す" do
    described_class.snapshot!(view, label: "前")

    status = described_class.status(view.reload)
    expect(status[:can_undo]).to be(true)
    expect(status[:can_redo]).to be(false)
  end
end

# 図形も控える。
#
# 控えていなかった頃は、図形を置いてから「戻る」を押しても図形が残り、
# 何が戻ったのか読めなかった（カードと線だけが戻る）。
RSpec.describe "#{Views::RevisionService} 図形の控え" do
  let(:user) { create(:user, :confirmed) }
  let(:view) { create(:view, user: user, view_type: "freeboard") }

  # snapshot! は状態（進める／戻せる）を返すので、控えそのものは引き直す
  def snapshot(label)
    Views::RevisionService.snapshot!(view.reload, label: label)
    view.reload.view_revisions.order(:position).last
  end

  it "置いた図形が控えに入る" do
    view.view_shapes.create!(kind: "sticky", x: 10, y: 20, width: 180, height: 180, text: "覚書")

    revision = snapshot("置いた後")

    expect(revision.state["shapes"].first).to include("kind" => "sticky", "text" => "覚書")
  end

  it "戻ると、置く前の状態へ返る" do
    snapshot("置く前")
    view.view_shapes.create!(kind: "sticky", x: 10, y: 20, width: 180, height: 180)
    snapshot("置いた後")

    Views::RevisionService.new(view).undo!

    expect(view.reload.view_shapes.count).to eq(0)
  end

  it "進むと、置いた状態へ返る" do
    snapshot("置く前")
    view.view_shapes.create!(kind: "frame", x: 0, y: 0, width: 400, height: 300)
    snapshot("置いた後")
    service = Views::RevisionService.new(view)
    service.undo!

    service.redo!

    expect(view.reload.view_shapes.count).to eq(1)
    expect(view.view_shapes.first.kind).to eq("frame")
  end

  # 「控えていない」と「1つも無かった」は別のこと
  it "図形を控える前の版へ戻しても、図形を消さない" do
    view.view_shapes.create!(kind: "sticky", x: 10, y: 20, width: 180, height: 180)
    old = snapshot("古い版")
    old.update!(state: old.state.except("shapes"))

    Views::RevisionService.new(view.reload).send(:restore!, old.reload)

    expect(view.reload.view_shapes.count).to eq(1)
  end

  it "知らない種類は戻さない（壊れた控えを通さない）" do
    snapshot("空")
    view.view_shapes.create!(kind: "sticky", x: 0, y: 0, width: 180, height: 180)
    revision = snapshot("あり")
    revision.update!(state: revision.state.merge("shapes" => [ { "kind" => "なにか", "x" => 0, "y" => 0,
                                                                 "width" => 100, "height" => 100 } ]))
    view.view_shapes.destroy_all

    Views::RevisionService.new(view.reload).send(:restore!, revision.reload)

    expect(view.reload.view_shapes.count).to eq(0)
  end
end
