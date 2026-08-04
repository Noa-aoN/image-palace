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
