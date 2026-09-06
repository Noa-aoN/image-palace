require "rails_helper"

# 骨格と、あとから重ねるもの。
#
# 前は「同列でないもの全部」が段を作っていた。つまり related（迷ったときの
# 逃げ道）が親子と同じ強さで効いていて、アルテミス -[related]-> アポロン
# だけでアポロンが子の段へ落ちた。骨格は骨格の関係だけで組む。
RSpec.describe "Views::Layout 骨格と重ねる関係" do
  def box(id, index = 0)
    Views::Layout::Box.new(
      id: id, title: id, x: index * 200, y: 0, width: 144, height: 176, footprint_width: 144
    )
  end

  def rel(from, to, type, strength = 0.9)
    { from: from, to: to, type: type, label: type, strength: strength }
  end

  def lay(boxes, edges, **options)
    Views::Layout::Layered.new(boxes: boxes, edges: edges, **options).call
    boxes.to_h { |b| [ b.id, b ] }
  end

  describe "段を作るもの" do
    it "親子は段を作る" do
      boxes = [ box("親", 0), box("子", 1) ]
      at = lay(boxes, [ rel("親", "子", "parent") ])

      expect(at["子"].y).to be > at["親"].y
    end

    # 「その他」で段を作られると、意味の無い上下が図に生まれる
    it "その他（related）は段を作らない" do
      boxes = [ box("A", 0), box("B", 1) ]
      at = lay(boxes, [ rel("A", "B", "related") ])

      expect(at["B"].y).to eq(at["A"].y)
    end

    it "所属は下に置く（骨格が他に無くても）" do
      boxes = [ box("アテナ", 0), box("神殿", 1) ]
      at = lay(boxes, [ rel("アテナ", "神殿", "belongs_to") ])

      expect(at["神殿"].y).to be > at["アテナ"].y
    end

    # 並びの先頭がたまたま下側でも、上側が根になること
    it "所属だけの図で、並びの先頭が下側でも上下が入れ替わらない" do
      boxes = [ box("神殿", 0), box("アテナ", 1) ]
      at = lay(boxes, [ rel("アテナ", "神殿", "belongs_to") ])

      expect(at["神殿"].y).to be > at["アテナ"].y
    end
  end

  describe "重ねる関係は骨格を動かさない" do
    it "親子で決まった段を、その他の線が動かさない" do
      boxes = [ box("親", 0), box("子", 1), box("よそ", 2) ]
      at = lay(boxes, [ rel("親", "子", "parent"), rel("よそ", "子", "related") ])

      expect(at["子"].y).to be > at["親"].y
      expect(at["よそ"].y).to eq(at["子"].y)
    end
  end

  describe "兄弟は隣に置く" do
    # 段だけ同じにして位置を決めずにいると、段の端と端に離れて置かれ、
    # 段を横断する長い線になる（実際に1559pxの線ができた）
    it "兄弟どうしは隣り合う" do
      boxes = %w[A B C].each_with_index.map { |id, i| box(id, i) }
      at = lay(boxes, [ rel("A", "B", "parent"), rel("A", "C", "sibling") ])
      row = boxes.select { |b| b.y == at["A"].y }.sort_by(&:x).map(&:id)

      expect((row.index("A") - row.index("C")).abs).to eq(1)
    end

    # 隣にできるのは1枚だけなので、兄弟が多いと残りは段の端まで飛ばされ、
    # 段を横断する長い線になる（実測で1506pxの線ができた）
    it "同列の相手が3枚以上あるカードは、その真ん中に来る" do
      boxes = %w[中心 兄 弟 姉 妹].each_with_index.map { |id, i| box(id, i) }
      at = lay(boxes, %w[兄 弟 姉 妹].map { |m| rel("中心", m, "sibling") })
      row = boxes.sort_by(&:x).map(&:id)

      expect(row.index("中心")).to be_between(1, row.size - 2)
    end

    # 互いに兄弟の網だと、先頭の枝が一群を飲み込んで中心が段の端へ寄っていた
    it "互いに兄弟の網でも、中心が真ん中に来る" do
      boxes = %w[中心 A B C D].each_with_index.map { |id, i| box(id, i) }
      mesh = %w[A B C D].map { |m| rel("中心", m, "sibling") } +
             [ rel("A", "B", "sibling"), rel("C", "D", "sibling") ]
      lay(boxes, mesh)
      row = boxes.sort_by(&:x).map(&:id)

      expect(row.index("中心")).to be_between(1, row.size - 2)
    end

    # 親から降りて並んだ子を兄弟の都合で並べ替えると、親子の縦が崩れる
    it "骨格が置いた子は、兄弟の都合で並べ替えない" do
      boxes = %w[親 A B C D].each_with_index.map { |id, i| box(id, i) }
      before = boxes.map(&:id)
      lay(boxes, %w[A B C D].map { |c| rel("親", c, "parent") } +
                 %w[B C D].map { |m| rel("A", m, "sibling") })

      expect(boxes.sort_by(&:x).map(&:id) - [ "親" ]).to eq(before - [ "親" ])
    end

    it "夫婦を先に隣にする（兄弟と押し合わない）" do
      boxes = %w[夫 妻 子 弟].each_with_index.map { |id, i| box(id, i) }
      at = lay(boxes, [
        rel("夫", "妻", "spouse"), rel("夫", "子", "parent"), rel("妻", "子", "parent"),
        rel("夫", "弟", "sibling")
      ])
      top = boxes.select { |b| b.y == at["夫"].y }.sort_by(&:x).map(&:id)

      expect((top.index("夫") - top.index("妻")).abs).to eq(1)
    end
  end
end

# 共通の親が図にいる兄弟の線は、引かない。
# 親子の線をたどれば読めるので、引くと同じことを二度言うことになる。
RSpec.describe Views::Layout::Relation do
  def rel(from, to, type) = { from: from, to: to, type: type }

  it "共通の親が図にいる兄弟は、省ける線として挙がる" do
    relations = [
      rel("親", "兄", "parent"), rel("親", "弟", "parent"), rel("兄", "弟", "sibling")
    ]

    expect(described_class.redundant_siblings(relations)).to eq([ rel("兄", "弟", "sibling") ])
  end

  it "共通の親が図にいなければ、省かない" do
    relations = [ rel("親", "兄", "parent"), rel("兄", "弟", "sibling") ]

    expect(described_class.redundant_siblings(relations)).to be_empty
  end

  # 夫婦は共通の親ではない
  it "夫婦でつながっているだけでは省かない" do
    relations = [ rel("兄", "弟", "sibling"), rel("兄", "妻", "spouse") ]

    expect(described_class.redundant_siblings(relations)).to be_empty
  end

  describe "網になった兄弟" do
    # 6枚が互いに兄弟なら線は15本引ける。だが図では、つながっていることが
    # 読めれば足りる。網のまま描くと段の端から端まで走る線が何本もできる
    it "輪を閉じる線だけを落とす（3枚の輪なら1本）" do
      relations = [
        rel("中心", "A", "sibling"), rel("中心", "B", "sibling"),
        rel("A", "B", "sibling")
      ]

      expect(described_class.surplus_siblings(relations).size).to eq(1)
    end

    it "落としても、全員がつながったまま残る" do
      members = %w[中心 A B C]
      relations = members.combination(2).map { |a, b| rel(a, b, "sibling") }

      kept = relations - described_class.surplus_siblings(relations)

      expect(kept.size).to eq(members.size - 1)
      linked = kept.flat_map { |r| [ r[:from], r[:to] ] }.uniq
      expect(linked).to match_array(members)
    end

    it "相手の多いカードを幹にする" do
      relations = [
        rel("中心", "A", "sibling"), rel("中心", "B", "sibling"),
        rel("中心", "C", "sibling"), rel("A", "B", "sibling")
      ]

      kept = relations - described_class.surplus_siblings(relations)

      expect(kept.map { |r| r[:from] }.uniq).to eq([ "中心" ])
    end

    it "鎖が1本しか無ければ何も落とさない" do
      relations = [ rel("A", "B", "sibling"), rel("B", "C", "sibling") ]

      expect(described_class.surplus_siblings(relations)).to be_empty
    end

    it "兄弟以外は触らない" do
      relations = [ rel("親", "子", "parent"), rel("親", "子2", "parent") ]

      expect(described_class.surplus_siblings(relations)).to be_empty
    end
  end

  it "骨格と、重ねるものを分ける" do
    expect(described_class.primary?("parent")).to be(true)
    expect(described_class.primary?("related")).to be(false)
    expect(described_class.primary?("belongs_to")).to be(false)
    # 種類の無い古い線は、これまでどおり段を作る
    expect(described_class.primary?(nil)).to be(true)
  end
end
