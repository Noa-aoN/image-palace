require "rails_helper"

# 夫婦から子への線を、1本の幹にまとめる。
#
# そうしないと父から子へ・母から子へと2本ずつ線が出る。子が3人なら6本になり、
# そのどれもが兄弟の並びを横切る。
RSpec.describe Views::Layout::Bus do
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
    [ { from: "父", to: "母", type: "spouse" },
      { from: "父", to: "子1", type: "parent" }, { from: "母", to: "子1", type: "parent" },
      { from: "父", to: "子2", type: "parent" }, { from: "母", to: "子2", type: "parent" } ]
  end

  subject(:bus) { described_class.new(boxes: boxes, relations: relations) }

  describe "組を見つける" do
    it "共通の子を持つ夫婦を見つける" do
      expect(bus.groups.size).to eq(1)
      expect(bus.groups.first.members.keys).to contain_exactly("子1", "子2")
    end

    it "幹は、二人の中ほどに立つ" do
      expect(bus.groups.first.trunk_x).to eq((father.center_x + mother.center_x) / 2)
    end

    it "渡しは、親と子の間に来る" do
      group = bus.groups.first
      expect(group.bus_y).to be > father.bottom
      expect(group.bus_y).to be < child1.top
    end
  end

  describe "まとめないとき" do
    it "共通の子が無ければ、まとめない" do
      apart = [ { from: "父", to: "母", type: "spouse" },
                { from: "父", to: "子1", type: "parent" }, { from: "母", to: "子2", type: "parent" } ]

      expect(described_class.new(boxes: boxes, relations: apart).groups).to be_empty
    end

    it "子が1枚しか居ない親は、まとめない（幹にする意味が無い）" do
      one_child = [ { from: "父", to: "子1", type: "parent" } ]

      expect(described_class.new(boxes: boxes, relations: one_child).groups).to be_empty
    end

    it "二人が同じ段に居なければ、まとめない" do
      split = boxes_of(father, box("母", x: 500, y: 600), child1, child2)

      expect(described_class.new(boxes: split, relations: relations).groups).to be_empty
    end

    # 無理に幹を通すと、かえって遠回りな線になる
    it "二人が離れすぎていたら、まとめない" do
      far = boxes_of(father, box("母", x: 5000, y: 0), child1, child2)

      expect(described_class.new(boxes: far, relations: relations).groups).to be_empty
    end

    it "子が親より上にあれば、まとめない" do
      inverted = boxes_of(father, mother, box("子1", x: 150, y: -600), box("子2", x: 550, y: -600))

      expect(described_class.new(boxes: inverted, relations: relations).groups).to be_empty
    end
  end

  describe "道すじ" do
    let(:group) { bus.groups.first }

    it "父からも母からも、同じ幹を通る" do
      from_father = bus.route(group, { from: "父", to: "子1", type: "parent" })
      from_mother = bus.route(group, { from: "母", to: "子1", type: "parent" })

      trunk = ->(route) { route.points.select { |p| p["x"] == group.trunk_x.round } }
      expect(trunk.call(from_father)).to eq(trunk.call(from_mother))
      expect(trunk.call(from_father)).not_to be_empty
    end

    it "同じ子へ向かう2本は、幹から下で同じ道になる" do
      from_father = bus.route(group, { from: "父", to: "子1", type: "parent" })
      from_mother = bus.route(group, { from: "母", to: "子1", type: "parent" })

      expect(from_father.points.last).to eq(from_mother.points.last)
    end

    it "違う子へは、渡しから別々に降りる" do
      to_first = bus.route(group, { from: "父", to: "子1", type: "parent" })
      to_second = bus.route(group, { from: "父", to: "子2", type: "parent" })

      expect(to_first.points.last).not_to eq(to_second.points.last)
      expect(to_first.points.last["y"]).to eq(to_second.points.last["y"])
    end

    it "曲がりが増えすぎない" do
      route = bus.route(group, { from: "父", to: "子1", type: "parent" })

      expect(route.points.size).to be <= 4
    end

    it "盤に無い子へは引かない" do
      expect(bus.route(group, { from: "父", to: "居ない", type: "parent" })).to be_nil
    end
  end

  describe "どの線が幹を通るか" do
    it "夫婦の線そのものは、幹を通らない" do
      expect(bus.group_for({ from: "父", to: "母", type: "spouse" })).to be_nil
    end

    it "共通の子への線は、幹を通る" do
      expect(bus.group_for({ from: "父", to: "子1", type: "parent" })).not_to be_nil
    end
  end
end

# ひとり親と、その兄弟。**作例集の階層図はこの形。**
#
# まとめる理由は線が減るからではなく、兄弟が「同じ親の子」だと形で読めるから。
# 個別に引くと、どこまでが兄弟なのかは位置から推し量るしかない。
RSpec.describe "#{Views::Layout::Bus} ひとり親" do
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

  subject(:bus) { Views::Layout::Bus.new(boxes: boxes, relations: relations) }

  it "子が2枚以上なら、幹にまとめる" do
    expect(bus.groups.size).to eq(1)
    expect(bus.groups.first.members.keys).to contain_exactly("子1", "子2", "子3")
  end

  it "幹は、親の真下に立つ" do
    expect(bus.groups.first.trunk_x).to eq(boxes["親"].center_x)
  end

  it "どの子への線も、同じ渡しを通る" do
    routes = %w[子1 子2 子3].map { |id| bus.route(bus.groups.first, { from: "親", to: id, type: "parent" }) }
    bus_y = bus.groups.first.bus_y.round

    expect(routes.map { |r| r.points.last["y"] }.uniq).to eq([ bus_y ])
  end

  # 幹が2本立つと、どちらの子か読めなくなる
  it "夫婦の幹に入っている親は、ひとり親としては数えない" do
    with_partner = boxes.merge("配偶者" => box("配偶者", x: 700, y: 0))
    paired = relations + [ { from: "親", to: "配偶者", type: "spouse" },
                           { from: "配偶者", to: "子1", type: "parent" },
                           { from: "配偶者", to: "子2", type: "parent" } ]

    found = Views::Layout::Bus.new(boxes: with_partner, relations: paired).groups
    expect(found.size).to eq(1)
    expect(found.first.anchor_ids).to contain_exactly("親", "配偶者")
  end
end

# まとめる条件は4つ。**どれか1つでも欠けたら束ねない。**
RSpec.describe "#{Views::Layout::Bus} まとめる条件" do
  def box(id, x:, y:, width: 144, height: 176)
    Views::Layout::Box.new(id: id, title: id, x: x, y: y, width: width, height: height,
                           footprint_width: width)
  end

  def boxes_of(*list) = list.to_h { |b| [ b.id, b ] }

  let(:parent) { box("親", x: 400, y: 0) }
  let(:kids) { [ box("子1", x: 100, y: 500), box("子2", x: 700, y: 500) ] }
  let(:boxes) { boxes_of(parent, *kids) }

  def groups_for(relations)
    Views::Layout::Bus.new(boxes: boxes, relations: relations).groups
  end

  describe "① 同じ種類の関係" do
    it "同じ種類なら束ねる" do
      relations = kids.map { |k| { from: "親", to: k.id, type: "parent" } }

      expect(groups_for(relations).size).to eq(1)
    end

    # 親子と所属を1本にまとめると、どちらの関係なのか読めない
    it "種類が違えば束ねない" do
      relations = [ { from: "親", to: "子1", type: "parent" },
                    { from: "親", to: "子2", type: "belongs_to" } ]

      expect(groups_for(relations)).to be_empty
    end
  end

  describe "② 出どころか行き先が同じ" do
    it "1枚から複数へ（扇・出）" do
      relations = kids.map { |k| { from: "親", to: k.id, type: "parent" } }

      expect(groups_for(relations).first.kind).to eq(:fan_out)
    end

    it "複数から1枚へ（扇・入）" do
      shrine = box("神殿", x: 400, y: 500)
      gods = [ box("神A", x: 100, y: 0), box("神B", x: 700, y: 0) ]
      relations = gods.map { |g| { from: g.id, to: "神殿", type: "belongs_to" } }

      found = Views::Layout::Bus.new(boxes: boxes_of(shrine, *gods), relations: relations).groups
      expect(found.first.kind).to eq(:fan_in)
      expect(found.first.anchor_ids).to eq([ "神殿" ])
    end

    it "要が共通でなければ束ねない" do
      other = box("別の親", x: 900, y: 0)
      relations = [ { from: "親", to: "子1", type: "parent" },
                    { from: "別の親", to: "子2", type: "parent" } ]

      expect(Views::Layout::Bus.new(boxes: boxes.merge("別の親" => other), relations: relations).groups)
        .to be_empty
    end
  end

  describe "③ 2本以上ある" do
    it "1本だけなら束ねない（幹にしても線が1本のまま）" do
      expect(groups_for([ { from: "親", to: "子1", type: "parent" } ])).to be_empty
    end
  end

  describe "④ 束ねてよい関係" do
    # 「AとBは同じもの」は、何と何なのかが読めることが意味
    it "同一視は束ねない" do
      relations = kids.map { |k| { from: "親", to: k.id, type: "equivalent" } }

      expect(groups_for(relations)).to be_empty
    end

    # 「AとBを見比べる」も、どれとどれなのかが読めることが意味
    it "対比は束ねない" do
      relations = kids.map { |k| { from: "親", to: k.id, type: "contrast" } }

      expect(groups_for(relations)).to be_empty
    end

    it "所属は束ねる" do
      relations = kids.map { |k| { from: "親", to: k.id, type: "belongs_to" } }

      expect(groups_for(relations).size).to eq(1)
    end
  end

  describe "幹を立てるのは夫婦だけ" do
    # 要が1つなら幹は要らない。足すと曲がりが2つ増えるだけ
    it "ひとり親には幹を立てない" do
      relations = kids.map { |k| { from: "親", to: k.id, type: "parent" } }
      group = groups_for(relations).first

      expect(group.trunk?).to be(false)
      expect(Views::Layout::Bus.new(boxes: boxes, relations: relations)
        .route(group, relations.first).points.size).to eq(2)
    end

    it "夫婦には幹を立てる" do
      partner = box("配偶者", x: 700, y: 0)
      all = boxes.merge("配偶者" => partner)
      relations = [ { from: "親", to: "配偶者", type: "spouse" } ] +
                  kids.flat_map { |k| [ { from: "親", to: k.id, type: "parent" },
                                        { from: "配偶者", to: k.id, type: "parent" } ] }

      group = Views::Layout::Bus.new(boxes: all, relations: relations).groups.first
      expect(group.trunk?).to be(true)
    end
  end

  describe "1本の線は、1つの幹にだけ属する" do
    it "夫婦の幹に入った線は、ひとり親の扇に数えない" do
      partner = box("配偶者", x: 700, y: 0)
      all = boxes.merge("配偶者" => partner)
      relations = [ { from: "親", to: "配偶者", type: "spouse" } ] +
                  kids.flat_map { |k| [ { from: "親", to: k.id, type: "parent" },
                                        { from: "配偶者", to: k.id, type: "parent" } ] }

      expect(Views::Layout::Bus.new(boxes: all, relations: relations).groups.size).to eq(1)
    end
  end
end
