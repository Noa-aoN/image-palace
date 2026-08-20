# frozen_string_literal: true

require "rails_helper"

# 書き出して、取り込んで、もう一度書き出す。**2回の結果が一致すること。**
#
# 公式コンテンツの仕組みは、この一対がすべて。
# rake も公式工房の公開も、デモの宮殿づくりも Starter の受け取りも、
# 最後はここを呼ぶだけになる。だから、ここが正しければ全部が正しい。
#
# 往復で見ると、次がまとめて捕まる。
#
#   ・運び忘れ（項目が落ちる）
#   ・取り違え（同じ題のカードが2枚あるとき）
#   ・繋がらない線（キャンバスの線はカードの id を文字列で持っている）
#   ・見出しの無い項目（項目の定義は利用者ごとの行）
RSpec.describe "公式コンテンツの往復", type: :service do
  # 1x1 の PNG。中身は問わない。**同じ blob が付け替わるか**だけを見る。
  # 定数にすると別の spec と名前がぶつかる（読み込み順で警告が出る）ので、let で持つ
  let(:png) do
    [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
      "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
      "0000000049454e44ae426082" ].pack("H*")
  end

  let(:author) { create(:user, :confirmed) }
  let(:receiver) { create(:user, :confirmed) }
  let(:word) { create(:item_type, name: "word", label: "単語") }
  let(:concept) { create(:item_type, name: "concept", label: "概念") }

  # ── 元になる箱を作る ────────────────────────────────
  #
  # ご指定の項目を全部入れる。
  # **同じ題のカードを2枚**入れてあるのが肝で、
  # 題で参照を繋いでいたらここで必ず落ちる
  let!(:box) { author.boxes.create!(name: "ネットワークのことば", description: "通り道を絵で覚える") }

  def make_item(title:, type:, tags:, meanings:, properties: [])
    item = author.items.create!(title: title, item_type: type, generation_status: "completed")
    media = item.medias.create!(media_type: "image", position: 0)
    media.file.attach(io: StringIO.new(png), filename: "#{SecureRandom.hex(4)}.png", content_type: "image/png")

    meanings.each_with_index do |m, i|
      item.meanings.create!(definition: m[:definition], language_code: m[:language_code] || "ja",
                            example_sentence: m[:example], position: i)
    end
    tags.each { |name| item.tags << (author.tags.find_by(name: name) || author.tags.create!(name: name)) }
    properties.each do |p|
      definition = author.property_definitions.create!(
        key: p[:key], label: p[:label], value_type: "text", category: "subject", position: 1, item_type: type
      )
      item.item_properties.create!(property_definition: definition, value: { "v" => p[:value] })
    end
    item
  end

  let!(:dns) do
    make_item(title: "DNS", type: word, tags: %w[IT ネットワーク],
              meanings: [ { definition: "名前を住所に直す仕組み", example: "DNS が引けないと開けない" },
                          { definition: "Domain Name System", language_code: "en" } ],
              properties: [ { key: "reading", label: "読み", value: "ディーエヌエス" } ])
  end

  # **同じ題のカードを2枚。** 題で繋いでいたら、ここで取り違える
  let!(:router_a) do
    make_item(title: "ルーター", type: word, tags: %w[ネットワーク],
              meanings: [ { definition: "道を選ぶ機械" } ])
  end
  let!(:router_b) do
    make_item(title: "ルーター", type: concept, tags: %w[IT],
              meanings: [ { definition: "経路を決めるという考え方" } ])
  end

  let!(:entries) do
    [ dns, router_a, router_b ].each_with_index do |item, i|
      box.box_entries.create!(entry: item, position: i + 1)
    end
  end

  let!(:view) do
    v = author.views.create!(name: "通り道", view_type: "freeboard", settings: { "grid" => true })
    v.view_items.create!(item: dns,      x: 100, y: 200, width: 240, height: 180, z_index: 1, position: 0)
    v.view_items.create!(item: router_a, x: 400, y: 200, width: 240, height: 180, z_index: 2, position: 1)
    v.view_items.create!(item: router_b, x: 700, y: 200, width: 200, height: 160, z_index: 3, position: 2)
    v.view_edges.create!(source_node_id: dns.id, target_node_id: router_a.id,
                         label: "引く", style: { "stroke" => "#8A6A2F" }, points: [ { "x" => 1, "y" => 2 } ], z_index: 1)
    v.view_edges.create!(source_node_id: router_a.id, target_node_id: router_b.id, z_index: 2)
    v
  end

  def export
    ContentPackages::Exporter.call(boxes: [ box.reload ], views: [ view.reload ])
  end

  # 往復を比べるときは `origin_key` を外す。
  #
  # あれは**元のカードを指す目印**なので、受け取った人から書き出せば
  # その人のカードを指す。違って当然で、構造の一致とは別の話。
  # 目印そのものは「同じカードを2枚にしない」の節で別に確かめる
  def structure(payload)
    payload.merge("items" => payload["items"].map { |i| i.except("origin_key") })
  end

  describe "往復" do
    it "書き出す → 取り込む → もう一度書き出すと、同じものになる" do
      first = export

      result = ContentPackages::Importer.call(user: receiver, payload: first)
      second = ContentPackages::Exporter.call(boxes: result.boxes.map(&:reload), views: result.views.map(&:reload))

      expect(structure(second)).to eq(structure(first))
    end

    it "取り込む相手が違っても中身は変わらない" do
      payload = export
      a = ContentPackages::Importer.call(user: receiver, payload: payload)
      b = ContentPackages::Importer.call(user: create(:user, :confirmed), payload: payload)

      expect(structure(ContentPackages::Exporter.call(boxes: a.boxes.map(&:reload), views: a.views.map(&:reload))))
        .to eq(structure(ContentPackages::Exporter.call(boxes: b.boxes.map(&:reload), views: b.views.map(&:reload))))
    end
  end

  describe "運べているか" do
    subject(:result) { ContentPackages::Importer.call(user: receiver, payload: export) }

    # 受け取った側を直に見る例もあるので、先に取り込んでおく（result は使い回される）
    before { result }

    it "カードと箱ができる" do
      expect(result.items.size).to eq(3)
      expect(result.boxes.first.name).to eq("ネットワークのことば")
      expect(receiver.items.count).to eq(3)
    end

    it "箱の並び順が保たれる" do
      titles = result.boxes.first.box_entries.order(:position).map { |e| e.entry.title }
      expect(titles).to eq(%w[DNS ルーター ルーター])
    end

    it "意味を複数とも運ぶ" do
      item = receiver.items.find_by(title: "DNS")
      expect(item.meanings.order(:position).pluck(:definition))
        .to eq([ "名前を住所に直す仕組み", "Domain Name System" ])
      expect(item.meanings.pluck(:language_code)).to contain_exactly("ja", "en")
    end

    it "タグを運ぶ" do
      expect(receiver.items.find_by(title: "DNS").tags.pluck(:name)).to contain_exactly("IT", "ネットワーク")
    end

    # 定義は利用者ごとの行。**受け取った側にも作られていること**
    it "項目の値と、その見出しの定義を運ぶ" do
      item = receiver.items.find_by(title: "DNS")
      prop = item.item_properties.first

      expect(prop.property_definition.user_id).to eq(receiver.id)
      expect(prop.property_definition.label).to eq("読み")
      expect(prop.value).to eq({ "v" => "ディーエヌエス" })
    end

    it "キャンバスの位置・大きさ・重なりを運ぶ" do
      placement = result.views.first.view_items.order(:position).first
      expect([ placement.x, placement.y, placement.width, placement.height, placement.z_index ])
        .to eq([ 100.0, 200.0, 240.0, 180.0, 1 ])
      expect(result.views.first.settings).to eq({ "grid" => true })
    end

    # ここが一番壊れやすい。線はカードの id を文字列で持っている
    it "線が、受け取った側のカードを指している" do
      edges = result.views.first.view_edges.order(:z_index)
      ids = receiver.items.pluck(:id)

      expect(edges.size).to eq(2)
      edges.each do |edge|
        expect(ids).to include(edge.source_node_id, edge.target_node_id)
      end
      expect(edges.first.label).to eq("引く")
      expect(edges.first.style).to eq({ "stroke" => "#8A6A2F" })
    end

    # 同じ題が2枚あっても取り違えない
    it "同じ題のカードでも、線が正しい方を指す" do
      edge = result.views.first.view_edges.order(:z_index).first
      dns_copy = receiver.items.find_by(title: "DNS")
      router_copy = receiver.items.find_by(title: "ルーター", item_type: word)

      expect(edge.source_node_id).to eq(dns_copy.id)
      expect(edge.target_node_id).to eq(router_copy.id)
    end
  end

  # 「神々の系図」だけを配る場面。
  #
  # **キャンバスを受け取った結果、中身の無い枠が並ぶことがあってはならない。**
  # 箱を選ばなくても、キャンバスに置かれているカードは荷物に入る
  describe "キャンバスだけを配る" do
    subject(:result) { ContentPackages::Importer.call(user: receiver, payload: payload) }

    let(:payload) { ContentPackages::Exporter.call(views: [ view.reload ]) }

    it "置かれているカードが一緒に来る" do
      expect(payload["items"].size).to eq(3)
      expect(payload["boxes"]).to be_empty

      expect(result.items.size).to eq(3)
      expect(result.boxes).to be_empty
      expect(receiver.items.pluck(:title)).to contain_exactly("DNS", "ルーター", "ルーター")
    end

    it "配置も線も復元される" do
      canvas = result.views.first

      expect(canvas.view_items.count).to eq(3)
      expect(canvas.view_edges.count).to eq(2)
      canvas.view_edges.each do |edge|
        expect(receiver.items.pluck(:id)).to include(edge.source_node_id, edge.target_node_id)
      end
    end

    it "往復しても同じ" do
      first = payload
      second = ContentPackages::Exporter.call(views: result.views.map(&:reload))

      expect(structure(second)).to eq(structure(first))
    end
  end

  # 箱に入っていないカードがキャンバスにあっても止めない。**引き込む**
  describe "箱とキャンバスで、中身が食い違うとき" do
    let!(:stray) do
      make_item(title: "はぐれ", type: word, tags: %w[IT], meanings: [ { definition: "箱に入っていない" } ])
    end

    before { view.view_items.create!(item: stray, x: 900, y: 200, position: 3) }

    it "キャンバスにしか無いカードも荷物に入る" do
      payload = ContentPackages::Exporter.call(boxes: [ box.reload ], views: [ view.reload ])

      expect(payload["items"].map { |i| i["title"] }).to include("はぐれ")
      # 箱の中身は増えない（キャンバスにあるだけなので）
      expect(payload["boxes"].first["entries"].size).to eq(3)
    end

    it "受け取ってもキャンバスに空の枠ができない" do
      payload = ContentPackages::Exporter.call(boxes: [ box.reload ], views: [ view.reload ])
      result = ContentPackages::Importer.call(user: receiver, payload: payload)

      placed = result.views.first.view_items.map { |vi| vi.item.title }
      expect(placed).to contain_exactly("DNS", "ルーター", "ルーター", "はぐれ")
      expect(result.views.first.view_items.count { |vi| vi.item.nil? }).to eq(0)
    end
  end

  # キャンバスから外したのに線の行だけ残ることは起こりうる。
  # 運んだ先で行き先の無い線にしない
  describe "置かれていないカードを指す線" do
    it "運ばない" do
      ghost = make_item(title: "幽霊", type: word, tags: [], meanings: [ { definition: "…" } ])
      box.box_entries.create!(entry: ghost, position: 4)
      view.view_edges.create!(source_node_id: dns.id, target_node_id: ghost.id, z_index: 9)

      payload = ContentPackages::Exporter.call(boxes: [ box.reload ], views: [ view.reload ])

      expect(payload["views"].first["edges"].size).to eq(2)
    end
  end

  describe "宮殿に結びついたキャンバス" do
    it "いまは、はっきり断る" do
      space = author.spaces.create!(name: "宮殿", space_type: "road")
      view.update!(space_id: space.id)

      expect { export }.to raise_error(ContentPackages::Payload::ExportError, /宮殿に結びついています/)
    end
  end

  describe "何も選ばれていないとき" do
    it "書き出さない" do
      expect { ContentPackages::Exporter.call }
        .to raise_error(ContentPackages::Payload::ExportError, /選ばれていません/)
    end
  end

  # 2つの公式コンテンツを続けて受け取る場面。
  #
  #   荷物A: DNS / ルーター  ＋ キャンバスA
  #   荷物B: DNS / TCP/IP    ＋ キャンバスB
  #
  # **DNS は1枚だけ。** 箱もキャンバスも別々にでき、
  # 両方のキャンバスが同じ DNS を指す
  describe "同じカードを含む荷物を、続けて受け取る" do
    let!(:tcp) do
      make_item(title: "TCP/IP", type: word, tags: %w[ネットワーク],
                meanings: [ { definition: "通信の約束ごと" } ])
    end

    let!(:box_b) { author.boxes.create!(name: "IT一般") }
    let!(:view_b) do
      v = author.views.create!(name: "積み重ね", view_type: "freeboard")
      v.view_items.create!(item: dns, x: 0,   y: 0, position: 0)
      v.view_items.create!(item: tcp, x: 300, y: 0, position: 1)
      v.view_edges.create!(source_node_id: tcp.id, target_node_id: dns.id, z_index: 1)
      v
    end

    before do
      box_b.box_entries.create!(entry: dns, position: 1)
      box_b.box_entries.create!(entry: tcp, position: 2)
    end

    let(:package_a) { ContentPackages::Exporter.call(boxes: [ box.reload ], views: [ view.reload ]) }
    let(:package_b) { ContentPackages::Exporter.call(boxes: [ box_b.reload ], views: [ view_b.reload ]) }

    # 由来を記録する側がやることを、ここでは手で組み立てる
    def owned_from(*results)
      results.flat_map { |r| r.origin_keys.map { |local, origin| [ origin, r.items_by_local_key[local] ] } }.to_h
    end

    it "同じカードは2枚にならない" do
      a = ContentPackages::Importer.call(user: receiver, payload: package_a)
      b = ContentPackages::Importer.call(user: receiver, payload: package_b, owned: owned_from(a))

      expect(receiver.items.where(title: "DNS").count).to eq(1)
      expect(receiver.items.count).to eq(4) # DNS / ルーター×2 / TCP/IP
      expect(b.reused_items.map(&:title)).to eq([ "DNS" ])
      expect(b.created_items.map(&:title)).to eq([ "TCP/IP" ])
    end

    it "箱とキャンバスは荷物ごとに別々にできる" do
      a = ContentPackages::Importer.call(user: receiver, payload: package_a)
      b = ContentPackages::Importer.call(user: receiver, payload: package_b, owned: owned_from(a))

      expect(receiver.boxes.pluck(:name)).to contain_exactly("ネットワークのことば", "IT一般")
      expect(receiver.views.pluck(:name)).to contain_exactly("通り道", "積み重ね")
      expect(b.boxes.first.box_entries.count).to eq(2)
    end

    # ここが肝。**両方のキャンバスが、同じ1枚の DNS を指している**
    it "2つのキャンバスが同じカードを指す" do
      a = ContentPackages::Importer.call(user: receiver, payload: package_a)
      b = ContentPackages::Importer.call(user: receiver, payload: package_b, owned: owned_from(a))

      dns_copy = receiver.items.find_by(title: "DNS")

      expect(a.views.first.view_items.map(&:item_id)).to include(dns_copy.id)
      expect(b.views.first.view_items.map(&:item_id)).to include(dns_copy.id)
      expect(b.views.first.view_edges.first.target_node_id).to eq(dns_copy.id)
    end

    # 題を変えても、目印で同じカードだと分かる
    it "受け取ったあと題を変えても、使い回せる" do
      a = ContentPackages::Importer.call(user: receiver, payload: package_a)
      receiver.items.find_by(title: "DNS").update!(title: "わたしのDNS")

      b = ContentPackages::Importer.call(user: receiver, payload: package_b, owned: owned_from(a))

      expect(receiver.items.where(title: "TCP/IP").count).to eq(1)
      # 使い回したのは、題を変えたあの1枚（読み直して確かめる）
      expect(b.reused_items.map { |i| i.reload.title }).to eq([ "わたしのDNS" ])
      expect(receiver.items.count).to eq(4)
    end

    # 自分で作った同名のカードには手を触れない
    it "自分で作った同名のカードとは混ぜない" do
      mine = receiver.items.create!(title: "DNS", item_type: word, generation_status: "completed")

      result = ContentPackages::Importer.call(user: receiver, payload: package_a)

      expect(receiver.items.where(title: "DNS").count).to eq(2)
      expect(result.created_items.map(&:id)).not_to include(mine.id)
      expect(result.reused_items).to be_empty
    end

    it "目印が同じなら、同じカードを指す" do
      expect(package_a["items"].find { |i| i["title"] == "DNS" }["origin_key"])
        .to eq(package_b["items"].find { |i| i["title"] == "DNS" }["origin_key"])
    end
  end

  describe "絵" do
    it "同じ実体を付け替える（複製しない）" do
      expect { ContentPackages::Importer.call(user: receiver, payload: export) }
        .not_to change(ActiveStorage::Blob, :count)
    end

    it "作り直さない（生成の仕事を積まない）" do
      expect { ContentPackages::Importer.call(user: receiver, payload: export) }
        .not_to have_enqueued_job(GenerateImageJob)
    end

    it "受け取った側でも絵が見える" do
      result = ContentPackages::Importer.call(user: receiver, payload: export)
      media = result.items.first.primary_media

      expect(media.file).to be_attached
      expect(media.file.blob.key).to eq(dns.primary_media.file.blob.key)
    end
  end

  describe "欠けていたら止める" do
    it "絵の無いカードは書き出さない" do
      author.items.create!(title: "絵なし", item_type: word, generation_status: "completed").tap do |i|
        i.meanings.create!(definition: "…", language_code: "ja", position: 0)
        box.box_entries.create!(entry: i, position: 99)
      end

      expect { export }.to raise_error(ContentPackages::Payload::ExportError, /絵がありません/)
    end

    it "意味の無いカードは書き出さない" do
      author.items.create!(title: "意味なし", item_type: word, generation_status: "completed").tap do |i|
        m = i.medias.create!(media_type: "image", position: 0)
        m.file.attach(io: StringIO.new(png), filename: "x.png", content_type: "image/png")
        box.box_entries.create!(entry: i, position: 98)
      end

      expect { export }.to raise_error(ContentPackages::Payload::ExportError, /意味がありません/)
    end

    it "読めない形式は取り込まない" do
      expect { ContentPackages::Importer.call(user: receiver, payload: export.merge("schema" => 99)) }
        .to raise_error(ContentPackages::Payload::ImportError, /読めない形式/)
    end

    it "荷物の外を指す線は取り込まない" do
      broken = export
      broken["views"].first["edges"].first["target"] = "item_999"

      expect { ContentPackages::Importer.call(user: receiver, payload: broken) }
        .to raise_error(ContentPackages::Payload::ImportError, /知らないカード/)
    end

    it "絵の実体が無ければ取り込まない" do
      broken = export
      broken["items"].first["image_key"] = "no-such-blob-key"

      expect { ContentPackages::Importer.call(user: receiver, payload: broken) }
        .to raise_error(ContentPackages::Payload::ImportError, /絵が見つかりません/)
    end

    # 途中で失敗したら、半分だけ入った宮殿を残さない
    it "途中で失敗したら、何も残さない" do
      broken = export
      broken["items"].last["image_key"] = "no-such-blob-key"

      expect {
        begin
          ContentPackages::Importer.call(user: receiver, payload: broken)
        rescue ContentPackages::Payload::ImportError
          nil
        end
      }.not_to change { [ receiver.items.count, receiver.boxes.count, receiver.views.count ] }
    end
  end

  # 「この1枚は出さない」。**箱の中に1枚だけ出したくないカードが混じるとき。**
  #
  # そのために箱を分けるのは、原本の作りを配布の都合で歪める。
  # 落とすのは書き出しの入口ひとつなので、集めるところ・箱の中身・
  # 配置・線のすべてが同じ判断で揃う
  describe "出さないと決めたカード" do
    before { ContentExclusion.set!(item: router_a, excluded: true, note: "作り直し中") }

    it "荷物に入らない" do
      expect(export["items"].map { |i| i["title"] }).to eq(%w[DNS ルーター])
      expect(export["items"].map { |i| i["origin_key"] }).not_to include(router_a.id)
    end

    # **席次の無いカードを箱が指したままにしない。** 残ると取り込む側で壊れる
    it "箱の中身からも消える" do
      keys = export["boxes"].first["entries"].map { |e| e["local_key"] }

      expect(keys.size).to eq(2)
      expect(keys).to all(be_in(export["items"].map { |i| i["local_key"] }))
    end

    it "キャンバスの配置からも消える" do
      keys = export["views"].first["placements"].map { |p| p["local_key"] }

      expect(keys.size).to eq(2)
      expect(keys).to all(be_in(export["items"].map { |i| i["local_key"] }))
    end

    # 外したカードに繋がっていた線は、行き先が無くなる
    it "その節に繋がっていた線も落ちる" do
      expect(export["views"].first["edges"]).to be_empty
    end

    it "取り込んでも壊れない" do
      result = ContentPackages::Importer.call(user: receiver, payload: export)

      expect(result.items.size).to eq(2)
      expect(receiver.items.pluck(:title)).to contain_exactly("DNS", "ルーター")
    end

    it "外すと、また入る" do
      ContentExclusion.set!(item: router_a, excluded: false)

      expect(export["items"].size).to eq(3)
    end

    it "押し直しても行が増えない" do
      3.times { ContentExclusion.set!(item: router_a, excluded: true) }

      expect(ContentExclusion.where(item_id: router_a.id).count).to eq(1)
    end

    # **空の荷物は作らせない。** 出してから気づくことになる
    it "全部外したら、そうと言って止まる" do
      [ dns, router_b ].each { |item| ContentExclusion.set!(item: item, excluded: true) }

      expect { export }.to raise_error(ContentPackages::Payload::ExportError, /カードが1枚も/)
    end

    # カードを消したら、外した記録も一緒に消える（迷子の行を残さない）
    it "カードを消すと、記録も消える" do
      expect { router_a.destroy! }.to change(ContentExclusion, :count).by(-1)
    end
  end
end
