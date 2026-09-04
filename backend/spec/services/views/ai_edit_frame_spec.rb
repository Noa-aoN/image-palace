require "rails_helper"

# かこみは、中身を追いかける。
#
# 控えないと、整えた後に空のかこみだけが盤に残る。カードは新しい場所へ移り、
# かこみは元の場所に取り残されるので「何も囲っていない枠が湧いた」ように見える。
RSpec.describe "Views::AiEditService かこみの追従" do
  let(:user) { create(:user) }
  let(:view) { create(:view, user: user, view_type: "freeboard") }
  let(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }

  def place(title, x:, y:)
    item = create(:item, user: user, item_type: item_type, title: title)
    create(:view_item, view: view, item: item, x: x, y: y)
    item.id
  end

  def frame(x:, y:, width:, height:)
    view.view_shapes.create!(kind: "frame", x: x, y: y, width: width, height: height)
  end

  def run(relations)
    plan = { "structure" => "hierarchy", "relations" => relations }
    allow(Ai::Chat).to receive(:call).and_return(
      { "choices" => [ { "message" => { "content" => plan.to_json } } ] }
    )
    Views::AiEditService.call(view: view, instruction: "整えて")
  end

  it "囲っていたカードが動いたら、かこみも付いていく" do
    a = place("ゼウス", x: 100, y: 100)
    b = place("ヘラ", x: 300, y: 100)
    enclosing = frame(x: 50, y: 50, width: 600, height: 400)

    run([ { "from" => a, "to" => b, "type" => "parent", "label" => "子" } ])

    enclosing.reload
    zeus = view.view_items.find_by(item_id: a)
    # かこみの中に、動いた後のカードが入っている
    expect(enclosing.x).to be <= zeus.x
    expect(enclosing.x + enclosing.width).to be >= zeus.x + 144
  end

  it "図形は増えない" do
    a = place("ゼウス", x: 100, y: 100)
    b = place("ヘラ", x: 300, y: 100)
    frame(x: 50, y: 50, width: 600, height: 400)

    expect { run([ { "from" => a, "to" => b, "type" => "parent", "label" => "子" } ]) }
      .not_to change { view.view_shapes.count }
  end

  # 空の枠は、そこに置いた理由がある
  it "何も囲っていないかこみは、動かさない" do
    a = place("ゼウス", x: 100, y: 100)
    b = place("ヘラ", x: 300, y: 100)
    empty = frame(x: 2000, y: 2000, width: 400, height: 300)
    before = [ empty.x, empty.y, empty.width, empty.height ]

    run([ { "from" => a, "to" => b, "type" => "parent", "label" => "子" } ])

    empty.reload
    expect([ empty.x, empty.y, empty.width, empty.height ]).to eq(before)
  end

  it "かこみ以外の図形は、動かさない" do
    a = place("ゼウス", x: 100, y: 100)
    b = place("ヘラ", x: 300, y: 100)
    sticky = view.view_shapes.create!(kind: "sticky", x: 100, y: 100, width: 180, height: 180)
    before = [ sticky.x, sticky.y ]

    run([ { "from" => a, "to" => b, "type" => "parent", "label" => "子" } ])

    sticky.reload
    expect([ sticky.x, sticky.y ]).to eq(before)
  end

  it "かこみが1つも無くても落ちない" do
    a = place("ゼウス", x: 100, y: 100)
    b = place("ヘラ", x: 300, y: 100)

    expect { run([ { "from" => a, "to" => b, "type" => "parent", "label" => "子" } ]) }.not_to raise_error
  end
end
