# frozen_string_literal: true

require "rails_helper"

# 公式コンテンツを配る、ただ1つの口。
#
# デモも、デルフォイの「受け取る」も、登録直後の持ち帰りも、
# 将来のミッション報酬・引き換えコード・購入も、ここを通る。
# **入口ごとに別の配り方を書かない**ので、守りもここ1か所で足りる。
RSpec.describe ContentPackages::Distributor do
  let(:author) { create(:user, :confirmed) }
  let(:user) { create(:user, :confirmed) }
  let(:word) { create(:item_type, name: "word", label: "単語") }

  let(:png) do
    [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
      "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
      "0000000049454e44ae426082" ].pack("H*")
  end

  # 同じカードを2つの荷物に入れる。**使い回しを確かめるため**
  let!(:shared_item) { make_item("DNS") }

  def make_item(title)
    item = author.items.create!(title: title, item_type: word, generation_status: "completed")
    item.medias.create!(media_type: "image", position: 0)
        .file.attach(io: StringIO.new(png), filename: "#{SecureRandom.hex(4)}.png", content_type: "image/png")
    item.meanings.create!(definition: "#{title} の説明", language_code: "ja", position: 0)
    item
  end

  def publish(key:, titles:, name: key)
    box = author.boxes.create!(name: name)
    titles.each_with_index do |title, i|
      item = title == "DNS" ? shared_item : make_item(title)
      box.box_entries.create!(entry: item, position: i + 1)
    end
    ContentPackage.publish!(key: key, kind: "starter", name: name,
                            payload: ContentPackages::Exporter.call(boxes: [ box ]))
  end

  let!(:package_a) { publish(key: "starter_net", titles: %w[DNS ルーター], name: "ネットワーク") }
  let!(:package_b) { publish(key: "starter_it", titles: %w[DNS TCP], name: "ITのことば") }

  describe "受け取る" do
    it "その人の宮殿に入る" do
      result = described_class.call(user: user, key: "starter_net", source: "delphi")

      expect(user.items.pluck(:title)).to contain_exactly("DNS", "ルーター")
      expect(user.boxes.pluck(:name)).to eq([ "ネットワーク" ])
      expect(result.created_count).to eq(2)
    end

    it "受け取った記録が残る" do
      described_class.call(user: user, key: "starter_net", source: "delphi")
      installation = ContentInstallation.find_by(user: user, package_key: "starter_net")

      expect(installation.package_version).to eq(1)
      expect(installation.source).to eq("delphi")
      expect(installation.installed_at).to be_present
    end

    it "いちばん新しい公開版が届く" do
      publish(key: "starter_net", titles: %w[DNS], name: "ネットワーク")

      result = described_class.call(user: user, key: "starter_net")

      expect(result.package.version).to eq(2)
      expect(ContentInstallation.find_by(user: user).package_version).to eq(2)
    end

    it "配っていないものは受け取れない" do
      expect { described_class.call(user: user, key: "no_such_key") }
        .to raise_error(described_class::NotDistributable)
    end
  end

  describe "同じ箱は2回持たない" do
    before { described_class.call(user: user, key: "starter_net", source: "delphi") }

    it "2回目は断る" do
      expect { described_class.call(user: user, key: "starter_net", source: "mission") }
        .to raise_error(described_class::AlreadyInstalled)
    end

    it "断ったとき、カードは増えない" do
      expect {
        begin
          described_class.call(user: user, key: "starter_net", source: "mission")
        rescue described_class::AlreadyInstalled
          nil
        end
      }.not_to change(user.items, :count)
    end
  end

  describe "無料の枠" do
    it "無料で取れるのは決めた数まで" do
      described_class.call(user: user, key: "starter_net", source: "delphi")

      expect { described_class.call(user: user, key: "starter_it", source: "starter_free") }
        .to raise_error(described_class::FreeLimitReached)
    end

    # ここが「経路が違えばもう1つ」の意味。**別の箱**を取れる
    it "ミッションなど、無料以外の経路ならもう1つ取れる" do
      described_class.call(user: user, key: "starter_net", source: "delphi")

      expect { described_class.call(user: user, key: "starter_it", source: "mission") }
        .to change(ContentInstallation, :count).by(1)
      expect(user.boxes.pluck(:name)).to contain_exactly("ネットワーク", "ITのことば")
    end

    it "運営が配るぶんも枠を使わない" do
      described_class.call(user: user, key: "starter_net", source: "delphi")

      expect { described_class.call(user: user, key: "starter_it", source: "admin_grant") }
        .not_to raise_error
    end
  end

  # 2つの荷物が同じカードを含むとき
  describe "同じカードを2枚にしない" do
    before { described_class.call(user: user, key: "starter_net", source: "delphi") }

    it "2つ目の荷物は、既にあるカードを使い回す" do
      result = described_class.call(user: user, key: "starter_it", source: "mission")

      expect(user.items.where(title: "DNS").count).to eq(1)
      expect(user.items.count).to eq(3) # DNS / ルーター / TCP
      expect(result.reused_count).to eq(1)
      expect(result.created_count).to eq(1)
    end

    it "箱は別々にできて、どちらも同じカードを指す" do
      described_class.call(user: user, key: "starter_it", source: "mission")

      dns = user.items.find_by(title: "DNS")
      boxes = user.boxes.order(:created_at)

      expect(boxes.size).to eq(2)
      boxes.each { |b| expect(b.box_entries.map(&:entry_id)).to include(dns.id) }
    end

    it "題を変えたあとでも使い回す" do
      user.items.find_by(title: "DNS").update!(title: "わたしのDNS")

      result = described_class.call(user: user, key: "starter_it", source: "mission")

      expect(result.reused_count).to eq(1)
      expect(user.items.count).to eq(3)
    end

    # 自分で作ったカードには手を触れない
    it "自分で作った同名のカードとは混ぜない" do
      other = create(:user, :confirmed)
      mine = other.items.create!(title: "DNS", item_type: word, generation_status: "completed")

      described_class.call(user: other, key: "starter_net", source: "delphi")

      expect(other.items.where(title: "DNS").count).to eq(2)
      expect(mine.reload).to be_present
    end
  end

  describe "由来の記録" do
    it "生まれたカード・箱・キャンバスに1本ずつ生える" do
      described_class.call(user: user, key: "starter_net", source: "delphi")
      installation = ContentInstallation.find_by(user: user)

      expect(installation.entries.where(record_type: "Item").count).to eq(2)
      expect(installation.entries.where(record_type: "Box").count).to eq(1)
    end

    it "公式由来かどうかを、実体から引ける" do
      described_class.call(user: user, key: "starter_net", source: "delphi")
      dns = user.items.find_by(title: "DNS")
      mine = user.items.create!(title: "自作", item_type: word, generation_status: "completed")

      expect(ContentInstallationEntry.official?(dns)).to be(true)
      expect(ContentInstallationEntry.official?(mine)).to be(false)
    end

    # **1枚のカードが、2つの受け取りから参照される**
    it "使い回したカードにも、2つ目の受け取りから記録が生える" do
      described_class.call(user: user, key: "starter_net", source: "delphi")
      described_class.call(user: user, key: "starter_it", source: "mission")

      dns = user.items.find_by(title: "DNS")
      entries = ContentInstallationEntry.where(record_type: "Item", record_id: dns.id)

      expect(entries.count).to eq(2)
      expect(entries.map { |e| e.content_installation.package_key })
        .to contain_exactly("starter_net", "starter_it")
    end

    it "どの定義から生まれたかを辿れる" do
      described_class.call(user: user, key: "starter_net", source: "delphi")
      entry = ContentInstallationEntry.items.find_by(record_id: user.items.find_by(title: "DNS").id)

      expect(entry.package_local_key).to be_present
      expect(entry.origin_key).to eq(shared_item.id)
    end

    it "受け取りを消しても、その人のカードは残る" do
      described_class.call(user: user, key: "starter_net", source: "delphi")

      expect { ContentInstallation.find_by(user: user).destroy! }
        .not_to change(user.items, :count)
    end
  end

  describe "配るのをやめたもの" do
    it "受け取れない" do
      package_a.archive!

      expect { described_class.call(user: user, key: "starter_net") }
        .to raise_error(described_class::NotDistributable)
    end

    it "既に受け取った人のものはそのまま" do
      described_class.call(user: user, key: "starter_net", source: "delphi")
      package_a.archive!

      expect(user.items.count).to eq(2)
      expect(ContentInstallation.find_by(user: user)).to be_present
    end
  end
end
