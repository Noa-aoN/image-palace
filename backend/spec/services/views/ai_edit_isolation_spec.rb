require "rails_helper"

# 線に繋がらなかったカードを、黙って落とさない。
#
# 規則には「孤立を見落とさない」と書いてあるが、書いてあることと
# 実際にそうなったことは別。挙げ忘れは数えて、そのまま伝える。
RSpec.describe "Views::AiEditService 孤立の報告" do
  let(:user) { create(:user) }
  let(:view) { create(:view, user: user, view_type: "freeboard") }

  def place(title)
    item = create(:item, user: user, title: title)
    create(:view_item, view: view, item: item, x: 0, y: 0)
    item.id
  end

  def run(plan, edges: "rebuild")
    allow(Ai::Chat).to receive(:call).and_return(
      { "choices" => [ { "message" => { "content" => plan.to_json } } ] }
    )
    described_class = Views::AiEditService
    described_class.call(view: view, instruction: "整えて", edges: edges)
  end

  it "繋がらなかったカードの枚数と名前を伝える" do
    parent = place("ゼウス")
    child = place("アテナ")
    place("孤島")

    result = run({
      "structure" => "hierarchy",
      "relations" => [ { "from" => parent, "to" => child, "type" => "parent", "label" => "子" } ]
    })

    expect(result.notes).to include("1枚が線に繋がりませんでした")
    expect(result.notes).to include("孤島")
  end

  # 「何であるか」を読み取れているかどうかで、次にすべきことが変わる
  it "読み取れた意味を添える" do
    parent = place("ゼウス")
    child = place("アテナ")
    lonely = place("雷霆")

    result = run({
      "structure" => "hierarchy",
      "readings" => [ { "id" => lonely, "gist" => "ゼウスの武器" } ],
      "relations" => [ { "from" => parent, "to" => child, "type" => "parent", "label" => "子" } ]
    })

    expect(result.notes).to include("雷霆「ゼウスの武器」")
    expect(result.notes).to include("どう結ぶかを指示で伝える")
  end

  it "意味が読み取れていなければ、説明を足すよう勧める" do
    parent = place("ゼウス")
    child = place("アテナ")
    lonely = place("謎の語")

    result = run({
      "structure" => "hierarchy",
      "readings" => [ { "id" => lonely, "gist" => "不明" } ],
      "relations" => [ { "from" => parent, "to" => child, "type" => "parent", "label" => "子" } ]
    })

    expect(result.notes).to include("説明を足してください")
  end

  it "全部が繋がっていれば何も言わない" do
    parent = place("ゼウス")
    child = place("アテナ")

    result = run({
      "structure" => "hierarchy",
      "relations" => [ { "from" => parent, "to" => child, "type" => "parent", "label" => "子" } ]
    })

    expect(result.notes.to_s).not_to include("線に繋がりませんでした")
  end

  it "線を触らない設定では言わない（今回の結果ではない）" do
    place("ゼウス")
    place("孤島")

    result = run({ "structure" => "hierarchy", "relations" => [] }, edges: "keep")

    expect(result.notes.to_s).not_to include("線に繋がりませんでした")
  end

  it "孤立したカードでも、線が引かれれば繋がる（無視されない）" do
    a = place("DNA")
    b = place("遺伝子")

    result = run({
      "structure" => "network",
      "relations" => [ { "from" => a, "to" => b, "type" => "part", "label" => "含む" } ]
    })

    expect(result.connected).to eq(1)
    expect(view.view_edges.pluck(:source_node_id, :target_node_id)).to eq([ [ a, b ] ])
  end
end
