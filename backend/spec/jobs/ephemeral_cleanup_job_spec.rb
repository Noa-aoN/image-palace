# frozen_string_literal: true

require "rails_helper"

# 一時的なものの片付け。
#
# **一時データが正式データへ混ざらない。** これを強い不変条件として扱う。
# 本番で実際に混ざった（工房室の下見の複製が公式宮殿に入り、
# 原本として選べる状態になっていた）ので、ここは疑って見張る。
#
# 見るのは4つ。
#
#   1. 消えるのは寿命の切れた一時データだけ
#   2. 正式な受け取り・普通の利用者・公式の原本には触れない
#   3. 共有している絵は消えない
#   4. 体験の宮殿と下見は、種別を分けて数える
RSpec.describe EphemeralCleanupJob, type: :job do
  let(:author) { create(:user, :confirmed) }
  let(:official) { create(:user, :confirmed, email: "studio@example.com") }
  let(:word) { create(:item_type, name: "word", label: "単語") }

  let(:png) do
    [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
      "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
      "0000000049454e44ae426082" ].pack("H*")
  end

  around do |example|
    original = ENV["OFFICIAL_CONTENT_USER_ID"]
    ENV["OFFICIAL_CONTENT_USER_ID"] = official.id
    example.run
    ENV["OFFICIAL_CONTENT_USER_ID"] = original
  end

  # 公式宮殿と、そこから出した荷物
  let!(:package) do
    box = official.boxes.create!(name: "ITのことば")
    %w[DNS ルーター].each_with_index do |title, i|
      item = official.items.create!(title: title, item_type: word, generation_status: "completed")
      item.medias.create!(media_type: "image", position: 0)
          .file.attach(io: StringIO.new(png), filename: "#{SecureRandom.hex(4)}.png",
                       content_type: "image/png")
      item.meanings.create!(definition: "#{title} の説明", language_code: "ja", position: 0)
      box.box_entries.create!(entry: item, position: i + 1)
    end

    ContentPackage.publish!(key: "starter_it", kind: "starter", name: "ITのことば",
                            payload: ContentPackages::Exporter.call(boxes: [ box ]))
  end

  def make_demo(expired: false)
    ContentDelivery.set!(package_key: "starter_it", channel: "demo", enabled: true)
    FeatureFlag.find_or_initialize_by(key: "demo_entry").update!(stage: "released")
    user = Demo::Session.call.user
    age!(user, :created_at) if expired
    user
  end

  def make_preview(user:, expired: false)
    Studio::Preview.start!(user: user, package: package)
    installation = ContentInstallation.find_by(user_id: user.id, source: "preview")
    age!(installation, :installed_at) if expired
    installation
  end

  # rubocop:disable Rails/SkipsModelValidations
  def age!(record, column)
    record.update_column(column, Demo::Session::LIFETIME.ago - 1.minute)
  end
  # rubocop:enable Rails/SkipsModelValidations

  describe "消えるもの" do
    it "寿命の切れた体験の宮殿は消える" do
      expired = make_demo(expired: true)

      expect(described_class.new.perform[:demo]).to eq(1)
      expect(User.find_by(id: expired.id)).to be_nil
    end

    it "宮殿の中身も一緒に消える" do
      expired = make_demo(expired: true)

      expect { described_class.new.perform }
        .to change { Item.where(user_id: expired.id).count }.to(0)
      expect(Box.where(user_id: expired.id)).to be_empty
      expect(View.where(user_id: expired.id)).to be_empty
      expect(ContentInstallation.where(user_id: expired.id)).to be_empty
    end

    it "寿命の切れた下見は消える" do
      make_preview(user: official, expired: true)

      expect(described_class.new.perform[:preview]).to eq(1)
      expect(ContentInstallation.where(source: "preview")).to be_empty
    end

    it "下見で入ったカードも一緒に消える" do
      make_preview(user: official, expired: true)

      expect { described_class.new.perform }.to change { official.items.count }.from(4).to(2)
    end

    # **種別を分けて数える。** どちらが増えているのか分からないと手が打てない
    it "体験の宮殿と下見は、分けて数える" do
      make_demo(expired: true)
      make_preview(user: official, expired: true)

      expect(described_class.new.perform).to eq({ demo: 1, preview: 1 })
    end
  end

  describe "消えないもの" do
    it "まだ生きている体験の宮殿は消えない" do
      living = make_demo

      expect(described_class.new.perform[:demo]).to eq(0)
      expect(User.find_by(id: living.id)).to be_present
    end

    it "まだ生きている下見は消えない" do
      make_preview(user: official)

      expect(described_class.new.perform[:preview]).to eq(0)
      expect(ContentInstallation.where(source: "preview").count).to eq(1)
    end

    it "普通の利用者には触れない" do
      described_class.new.perform

      expect(User.find_by(id: author.id)).to be_present
      expect(User.find_by(id: official.id)).to be_present
    end

    # **正式な受け取りは、どれだけ古くても消さない。**
    # 配るのをやめることと、配ったものを取り上げることは別
    it "正式な受け取りは、古くても消えない" do
      ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)
      receiver = create(:user, :confirmed)
      ContentPackages::Distributor.call(user: receiver, key: "starter_it", source: "delphi")
      ContentInstallation.where(source: "delphi").update_all(installed_at: 10.years.ago) # rubocop:disable Rails/SkipsModelValidations

      described_class.new.perform

      expect(receiver.reload.items.count).to eq(2)
      expect(ContentInstallation.where(user_id: receiver.id).count).to eq(1)
    end

    it "公式の原本は消えない" do
      make_demo(expired: true)
      make_preview(user: official, expired: true)

      described_class.new.perform

      expect(official.reload.items.pluck(:title)).to contain_exactly("DNS", "ルーター")
      expect(official.boxes.count).to eq(1)
    end

    it "出した荷物は消えない" do
      make_demo(expired: true)

      expect { described_class.new.perform }.not_to change { package.reload.payload }
      expect(ContentPackage.latest_published("starter_it")).to eq(package)
    end

    # **次に来た人がまた同じ絵を使う。** 消してはいけない
    it "共有している絵は消えない" do
      make_demo(expired: true)

      expect { perform_enqueued_jobs { described_class.new.perform } }
        .not_to change { official.items.map { |i| i.primary_media.file.attached? } }
      expect(ActiveStorage::Blob.count).to be_positive
    end
  end

  # **1回を短く保つ。** まとめて消すと、1回の掃除が長く走り続ける
  describe "1回の量" do
    it "上限までしか消さない" do
      3.times { make_demo(expired: true) }

      expect(Demo::Session.sweep!(limit: 2)).to eq(2)
      expect(User.demo_accounts.count).to eq(1)
    end

    it "残りは次の回で消える" do
      3.times { make_demo(expired: true) }

      Demo::Session.sweep!(limit: 2)
      Demo::Session.sweep!(limit: 2)

      expect(User.demo_accounts.count).to eq(0)
    end
  end
end
