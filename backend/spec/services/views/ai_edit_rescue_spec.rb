require "rails_helper"

# 取りこぼした関係を、もう一度だけ訊く。
#
# 規則を厚くしても readings を先に書かせても、見落としは残った。
# 全体を組み立てる仕事の中では、1枚ずつの確認が後回しになるため。
RSpec.describe "Views::AiEditService 取りこぼしの拾い直し" do
  let(:user) { create(:user) }
  let(:view) { create(:view, user: user, view_type: "freeboard") }

  def place(title)
    item = create(:item, user: user, title: title)
    create(:view_item, view: view, item: item, x: 0, y: 0)
    item.id
  end

  # 1回目は計画、2回目は拾い直し
  def stub_calls(*plans)
    responses = plans.map { |plan| { "choices" => [ { "message" => { "content" => plan.to_json } } ] } }
    allow(Ai::Chat).to receive(:call).and_return(*responses)
  end

  def run(edges: "rebuild")
    Views::AiEditService.call(view: view, instruction: "家系図に", edges: edges)
  end

  it "浮いたカードを拾い直して、線に組み込む" do
    zeus = place("ゼウス")
    hera = place("ヘラ")
    athena = place("アテナ")

    stub_calls(
      { "structure" => "hierarchy",
        "relations" => [ { "from" => zeus, "to" => hera, "type" => "peer", "label" => "妻" } ] },
      { "relations" => [ { "from" => zeus, "to" => athena, "type" => "parent", "label" => "娘" } ] }
    )

    result = run

    expect(Ai::Chat).to have_received(:call).twice
    expect(result.connected).to eq(2)
    expect(view.view_edges.pluck(:target_node_id)).to include(athena)
    expect(result.notes).to include("追い足しました")
  end

  it "浮いたカードが無ければ訊き直さない" do
    zeus = place("ゼウス")
    hera = place("ヘラ")

    stub_calls({ "structure" => "hierarchy",
                 "relations" => [ { "from" => zeus, "to" => hera, "type" => "peer", "label" => "妻" } ] })

    run

    expect(Ai::Chat).to have_received(:call).once
  end

  # 無理に繋げさせるための仕組みではない
  it "「繋がらない」と返ってきたら、そのまま浮かせておく" do
    zeus = place("ゼウス")
    hera = place("ヘラ")
    temple = place("パルテノン神殿")

    stub_calls(
      { "structure" => "hierarchy",
        "relations" => [ { "from" => zeus, "to" => hera, "type" => "peer", "label" => "妻" } ] },
      { "relations" => [] }
    )

    result = run

    expect(result.connected).to eq(1)
    expect(result.notes).to include("パルテノン神殿")
    expect(result.notes).not_to include("追い足しました")
  end

  it "線を触らない設定では訊き直さない" do
    place("ゼウス")
    place("アテナ")

    stub_calls({ "structure" => "hierarchy", "relations" => [] })

    run(edges: "keep")

    expect(Ai::Chat).to have_received(:call).once
  end

  # 図の作り直しであって、取りこぼしではない
  it "全部が浮いているなら訊き直さない" do
    place("ゼウス")
    place("アテナ")

    stub_calls({ "structure" => "grid", "relations" => [] })

    run

    expect(Ai::Chat).to have_received(:call).once
  end

  it "拾い直しが失敗しても、図はそのまま出来上がる" do
    zeus = place("ゼウス")
    hera = place("ヘラ")
    place("アテナ")

    plan = { "structure" => "hierarchy",
             "relations" => [ { "from" => zeus, "to" => hera, "type" => "peer", "label" => "妻" } ] }
    call_count = 0
    allow(Ai::Chat).to receive(:call) do
      call_count += 1
      raise StandardError, "落ちている" if call_count > 1

      { "choices" => [ { "message" => { "content" => plan.to_json } } ] }
    end

    expect { run }.not_to raise_error
    expect(view.view_edges.count).to eq(1)
    expect(call_count).to eq(2)
  end
end
