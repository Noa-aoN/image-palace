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
    ContentPackage::Exporter.call(box: box.reload, views: [ view.reload ])
  end

  describe "往復" do
    it "書き出す → 取り込む → もう一度書き出すと、同じものになる" do
      first = export

      result = ContentPackage::Importer.call(user: receiver, payload: first)
      second = ContentPackage::Exporter.call(box: result.box.reload, views: result.views.map(&:reload))

      expect(second).to eq(first)
    end

    it "取り込む相手が違っても中身は変わらない" do
      payload = export
      a = ContentPackage::Importer.call(user: receiver, payload: payload)
      b = ContentPackage::Importer.call(user: create(:user, :confirmed), payload: payload)

      expect(ContentPackage::Exporter.call(box: a.box.reload, views: a.views.map(&:reload)))
        .to eq(ContentPackage::Exporter.call(box: b.box.reload, views: b.views.map(&:reload)))
    end
  end

  describe "運べているか" do
    subject(:result) { ContentPackage::Importer.call(user: receiver, payload: export) }

    # 受け取った側を直に見る例もあるので、先に取り込んでおく（result は使い回される）
    before { result }

    it "カードと箱ができる" do
      expect(result.items.size).to eq(3)
      expect(result.box.name).to eq("ネットワークのことば")
      expect(receiver.items.count).to eq(3)
    end

    it "箱の並び順が保たれる" do
      titles = result.box.box_entries.order(:position).map { |e| e.entry.title }
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

  describe "絵" do
    it "同じ実体を付け替える（複製しない）" do
      expect { ContentPackage::Importer.call(user: receiver, payload: export) }
        .not_to change(ActiveStorage::Blob, :count)
    end

    it "作り直さない（生成の仕事を積まない）" do
      expect { ContentPackage::Importer.call(user: receiver, payload: export) }
        .not_to have_enqueued_job(GenerateImageJob)
    end

    it "受け取った側でも絵が見える" do
      result = ContentPackage::Importer.call(user: receiver, payload: export)
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

      expect { export }.to raise_error(ContentPackage::Payload::ExportError, /絵がありません/)
    end

    it "意味の無いカードは書き出さない" do
      author.items.create!(title: "意味なし", item_type: word, generation_status: "completed").tap do |i|
        m = i.medias.create!(media_type: "image", position: 0)
        m.file.attach(io: StringIO.new(png), filename: "x.png", content_type: "image/png")
        box.box_entries.create!(entry: i, position: 98)
      end

      expect { export }.to raise_error(ContentPackage::Payload::ExportError, /意味がありません/)
    end

    # キャンバスに載っているのに箱へ入っていないカードは、荷物の外を指すことになる
    it "箱に入っていないカードがキャンバスにあると止める" do
      stray = make_item(title: "はぐれ", type: word, tags: [], meanings: [ { definition: "…" } ])
      view.view_items.create!(item: stray, x: 0, y: 0, position: 9)

      expect { export }.to raise_error(ContentPackage::Payload::ExportError, /箱へ入っていない/)
    end

    it "読めない形式は取り込まない" do
      expect { ContentPackage::Importer.call(user: receiver, payload: export.merge("schema" => 99)) }
        .to raise_error(ContentPackage::Payload::ImportError, /読めない形式/)
    end

    it "荷物の外を指す線は取り込まない" do
      broken = export
      broken["views"].first["edges"].first["target"] = "item_999"

      expect { ContentPackage::Importer.call(user: receiver, payload: broken) }
        .to raise_error(ContentPackage::Payload::ImportError, /知らないカード/)
    end

    it "絵の実体が無ければ取り込まない" do
      broken = export
      broken["items"].first["image_key"] = "no-such-blob-key"

      expect { ContentPackage::Importer.call(user: receiver, payload: broken) }
        .to raise_error(ContentPackage::Payload::ImportError, /絵が見つかりません/)
    end

    # 途中で失敗したら、半分だけ入った宮殿を残さない
    it "途中で失敗したら、何も残さない" do
      broken = export
      broken["items"].last["image_key"] = "no-such-blob-key"

      expect {
        begin
          ContentPackage::Importer.call(user: receiver, payload: broken)
        rescue ContentPackage::Payload::ImportError
          nil
        end
      }.not_to change { [ receiver.items.count, receiver.boxes.count, receiver.views.count ] }
    end
  end
end
