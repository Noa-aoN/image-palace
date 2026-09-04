require "rails_helper"

# 夫婦から子への線を、1本の幹にまとめる。
#
# そうしないと父から子へ・母から子へと2本ずつ線が出る。子が3人なら6本になり、
# そのどれもが兄弟の並びを横切る。
RSpec.describe Views::Layout::CoupleBus do
  def box(id, x:, y:, width: 144, height: 176)
    Views::Layout::Box.new(id: id, title: id, x: x, y: y, width: width, height: height,
                           footprint_width: width)
  end

  def boxes_of(*list) = list.to_h { |b| [ b.id, b ] }

  # 父と母が隣に並び、子が2人
  let(:father) { box("父", x: 200, y: 0) }
  let(:mother) { box("母", x: 500, y: 0) }
  let(:child1) { box("子1", x: 150, y: 500) }
  let(:child2) { box("子2", x: 550, y: 500) }
  let(:boxes) { boxes_of(father, mother, child1, child2) }
  let(:relations) do
    [ { from: "父", to: "母", type: "peer" },
      { from: "父", to: "子1", type: "parent" }, { from: "母", to: "子1", type: "parent" },
      { from: "父", to: "子2", type: "parent" }, { from: "母", to: "子2", type: "parent" } ]
  end

  subject(:bus) { described_class.new(boxes: boxes, relations: relations) }

  describe "組を見つける" do
    it "共通の子を持つ夫婦を見つける" do
      expect(bus.couples.size).to eq(1)
      expect(bus.couples.first.children.keys).to contain_exactly("子1", "子2")
    end

    it "幹は、二人の中ほどに立つ" do
      expect(bus.couples.first.trunk_x).to eq((father.center_x + mother.center_x) / 2)
    end

    it "渡しは、親と子の間に来る" do
      couple = bus.couples.first
      expect(couple.bus_y).to be > father.bottom
      expect(couple.bus_y).to be < child1.top
    end
  end

  describe "まとめないとき" do
    it "共通の子が無ければ、まとめない" do
      apart = [ { from: "父", to: "母", type: "peer" },
                { from: "父", to: "子1", type: "parent" }, { from: "母", to: "子2", type: "parent" } ]

      expect(described_class.new(boxes: boxes, relations: apart).couples).to be_empty
    end

    it "子が1枚しか居ない親は、まとめない（幹にする意味が無い）" do
      one_child = [ { from: "父", to: "子1", type: "parent" } ]

      expect(described_class.new(boxes: boxes, relations: one_child).couples).to be_empty
    end

    it "二人が同じ段に居なければ、まとめない" do
      split = boxes_of(father, box("母", x: 500, y: 600), child1, child2)

      expect(described_class.new(boxes: split, relations: relations).couples).to be_empty
    end

    # 無理に幹を通すと、かえって遠回りな線になる
    it "二人が離れすぎていたら、まとめない" do
      far = boxes_of(father, box("母", x: 5000, y: 0), child1, child2)

      expect(described_class.new(boxes: far, relations: relations).couples).to be_empty
    end

    it "子が親より上にあれば、まとめない" do
      inverted = boxes_of(father, mother, box("子1", x: 150, y: -600), box("子2", x: 550, y: -600))

      expect(described_class.new(boxes: inverted, relations: relations).couples).to be_empty
    end
  end

  describe "道すじ" do
    let(:couple) { bus.couples.first }

    it "父からも母からも、同じ幹を通る" do
      from_father = bus.route(couple, { from: "父", to: "子1", type: "parent" })
      from_mother = bus.route(couple, { from: "母", to: "子1", type: "parent" })

      trunk = ->(route) { route.points.select { |p| p["x"] == couple.trunk_x.round } }
      expect(trunk.call(from_father)).to eq(trunk.call(from_mother))
      expect(trunk.call(from_father)).not_to be_empty
    end

    it "同じ子へ向かう2本は、幹から下で同じ道になる" do
      from_father = bus.route(couple, { from: "父", to: "子1", type: "parent" })
      from_mother = bus.route(couple, { from: "母", to: "子1", type: "parent" })

      expect(from_father.points.last).to eq(from_mother.points.last)
    end

    it "違う子へは、渡しから別々に降りる" do
      to_first = bus.route(couple, { from: "父", to: "子1", type: "parent" })
      to_second = bus.route(couple, { from: "父", to: "子2", type: "parent" })

      expect(to_first.points.last).not_to eq(to_second.points.last)
      expect(to_first.points.last["y"]).to eq(to_second.points.last["y"])
    end

    it "曲がりが増えすぎない" do
      route = bus.route(couple, { from: "父", to: "子1", type: "parent" })

      expect(route.points.size).to be <= 4
    end

    it "盤に無い子へは引かない" do
      expect(bus.route(couple, { from: "父", to: "居ない", type: "parent" })).to be_nil
    end
  end

  describe "どの線が幹を通るか" do
    it "夫婦の線そのものは、幹を通らない" do
      expect(bus.couple_for({ from: "父", to: "母", type: "peer" })).to be_nil
    end

    it "共通の子への線は、幹を通る" do
      expect(bus.couple_for({ from: "父", to: "子1", type: "parent" })).not_to be_nil
    end
  end
end

# ひとり親と、その兄弟。**作例集の階層図はこの形。**
#
# まとめる理由は線が減るからではなく、兄弟が「同じ親の子」だと形で読めるから。
# 個別に引くと、どこまでが兄弟なのかは位置から推し量るしかない。
RSpec.describe "#{Views::Layout::CoupleBus} ひとり親" do
  def box(id, x:, y:, width: 144, height: 176)
    Views::Layout::Box.new(id: id, title: id, x: x, y: y, width: width, height: height,
                           footprint_width: width)
  end

  let(:boxes) do
    { "親" => box("親", x: 400, y: 0),
      "子1" => box("子1", x: 100, y: 500),
      "子2" => box("子2", x: 400, y: 500),
      "子3" => box("子3", x: 700, y: 500) }
  end
  let(:relations) do
    %w[子1 子2 子3].map { |id| { from: "親", to: id, type: "parent" } }
  end

  subject(:bus) { Views::Layout::CoupleBus.new(boxes: boxes, relations: relations) }

  it "子が2枚以上なら、幹にまとめる" do
    expect(bus.couples.size).to eq(1)
    expect(bus.couples.first.children.keys).to contain_exactly("子1", "子2", "子3")
  end

  it "幹は、親の真下に立つ" do
    expect(bus.couples.first.trunk_x).to eq(boxes["親"].center_x)
  end

  it "どの子への線も、同じ渡しを通る" do
    routes = %w[子1 子2 子3].map { |id| bus.route(bus.couples.first, { from: "親", to: id, type: "parent" }) }
    bus_y = bus.couples.first.bus_y.round

    expect(routes.map { |r| r.points.last["y"] }.uniq).to eq([ bus_y ])
  end

  # 幹が2本立つと、どちらの子か読めなくなる
  it "夫婦の幹に入っている親は、ひとり親としては数えない" do
    with_partner = boxes.merge("配偶者" => box("配偶者", x: 700, y: 0))
    paired = relations + [ { from: "親", to: "配偶者", type: "peer" },
                           { from: "配偶者", to: "子1", type: "parent" },
                           { from: "配偶者", to: "子2", type: "parent" } ]

    couples = Views::Layout::CoupleBus.new(boxes: with_partner, relations: paired).couples
    expect(couples.size).to eq(1)
    expect(couples.first.a.id).to eq("親")
    expect(couples.first.b.id).to eq("配偶者")
  end
end
