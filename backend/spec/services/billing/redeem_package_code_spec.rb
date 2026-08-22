# frozen_string_literal: true

require "rails_helper"

# 引き換えコードで、公式コンテンツを配る。
#
# これまでコードで渡せたのはクレジットだけで、
# 「この講座の受講生に、この単語集を配る」ができなかった。
#
# **配る仕組みはデルフォイと同じものを通す。** 入口が違うだけで、
# やることは同じ（同じカードを2枚にしない・由来を残す・二重に受け取らせない）。
RSpec.describe Billing::RedeemCampaignCode, type: :service do
  let(:author) { create(:user, :confirmed) }
  let(:receiver) { create(:user, :confirmed) }
  let(:word) { create(:item_type, name: "word", label: "単語") }

  let(:png) do
    [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
      "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
      "0000000049454e44ae426082" ].pack("H*")
  end

  let!(:package) do
    box = author.boxes.create!(name: "ITのことば")
    %w[DNS ルーター].each_with_index do |title, i|
      item = author.items.create!(title: title, item_type: word, generation_status: "completed")
      item.medias.create!(media_type: "image", position: 0)
          .file.attach(io: StringIO.new(png), filename: "#{SecureRandom.hex(4)}.png",
                       content_type: "image/png")
      item.meanings.create!(definition: "#{title} の説明", language_code: "ja", position: 0)
      box.box_entries.create!(entry: item, position: i + 1)
    end

    ContentPackage.publish!(key: "starter_it", kind: "starter", name: "ITのことば",
                            payload: ContentPackages::Exporter.call(boxes: [ box ]))
  end

  def enable_campaign!
    ContentDelivery.set!(package_key: "starter_it", channel: "campaign", enabled: true)
  end

  def make_code(**attrs)
    CampaignCode.create!({ code: "ITPACK1", label: "IT講座の受講生へ",
                           reward_type: "package", package_key: "starter_it" }.merge(attrs))
  end

  describe "コードの決まり" do
    it "届け先に入っていれば作れる" do
      enable_campaign!

      expect(make_code).to be_persisted
    end

    # **工房室で出し先を決める仕組みがあるのに、コードだけが抜け道になると、
    # 「どこへ出しているか」を1か所で見られなくなる**
    it "届け先に入っていなければ作れない" do
      code = CampaignCode.new(code: "NOPE1", label: "だめ",
                              reward_type: "package", package_key: "starter_it")

      expect(code).not_to be_valid
      expect(code.errors[:package_key].join).to include("引き換えコードで渡す")
    end

    it "荷物を選んでいなければ作れない" do
      code = CampaignCode.new(code: "NOPE2", label: "だめ", reward_type: "package")

      expect(code).not_to be_valid
      expect(code.errors[:package_key].join).to include("選んでください")
    end

    it "出していない荷物は選べない" do
      enable_campaign!
      package.suspend!

      code = CampaignCode.new(code: "NOPE3", label: "だめ",
                              reward_type: "package", package_key: "starter_it")

      expect(code).not_to be_valid
      expect(code.errors[:package_key].join).to include("配れる版がありません")
    end

    # **型を変えたときに、鍵だけ残って黙って配るのを防ぐ**
    it "クレジットのコードに荷物の鍵は持たせられない" do
      code = CampaignCode.new(code: "NOPE4", label: "だめ", reward_type: "credits",
                              amount: 3, package_key: "starter_it")

      expect(code).not_to be_valid
      expect(code.errors[:package_key].join).to include("荷物を配るコードにしか")
    end
  end

  describe "受け取る" do
    before { enable_campaign! }

    it "カードが宮殿に入る" do
      make_code
      result = described_class.call(user: receiver, code: "ITPACK1")

      expect(result.package).to eq("ITのことば")
      expect(result.items).to eq(2)
      expect(receiver.reload.items.pluck(:title)).to contain_exactly("DNS", "ルーター")
    end

    it "クレジットは増えない" do
      make_code

      expect { described_class.call(user: receiver, code: "ITPACK1") }
        .not_to change { receiver.reload.available_credits }
    end

    # **無料枠は使わない。** コードは配る側が数を決めている
    it "無料枠を使わない" do
      make_code
      described_class.call(user: receiver, code: "ITPACK1")

      expect(ContentInstallation.free_used?(receiver)).to be(false)
    end

    it "由来が残る" do
      make_code
      described_class.call(user: receiver, code: "ITPACK1")

      installation = ContentInstallation.find_by(user_id: receiver.id)
      expect(installation.source).to eq("campaign")
      expect(installation.package_key).to eq("starter_it")
    end

    it "同じ人は2回受け取れない" do
      make_code
      described_class.call(user: receiver, code: "ITPACK1")

      expect { described_class.call(user: receiver, code: "ITPACK1") }
        .to raise_error(described_class::AlreadyRedeemed)
    end

    # **もう持っているなら、コードは使わせない。**
    # 使ったことにすると、持っているのに受け取れないまま1回分が消える
    it "デルフォイで受け取り済みなら、コードは減らない" do
      ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)
      ContentPackages::Distributor.call(user: receiver, key: "starter_it", source: "delphi")
      code = make_code

      expect { described_class.call(user: receiver, code: "ITPACK1") }
        .to raise_error(described_class::AlreadyRedeemed, /すでに受け取っています/)
      expect(code.reload.redemptions.count).to eq(0)
    end

    it "人数の上限は効く" do
      make_code(max_redemptions: 1)
      described_class.call(user: receiver, code: "ITPACK1")

      expect { described_class.call(user: create(:user, :confirmed), code: "ITPACK1") }
        .to raise_error(described_class::Unavailable)
    end

    it "止めた荷物のコードは使えない" do
      make_code
      package.suspend!

      expect { described_class.call(user: receiver, code: "ITPACK1") }
        .to raise_error(described_class::Unavailable)
      expect(receiver.reload.items.count).to eq(0)
    end
  end

  describe "届け先として" do
    it "「引き換えコードで渡す」は、もう準備中ではない" do
      expect(ContentDelivery::PENDING_CHANNELS).not_to include("campaign")
    end
  end
end
