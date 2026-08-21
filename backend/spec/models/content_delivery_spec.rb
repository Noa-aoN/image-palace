# frozen_string_literal: true

require "rails_helper"

# 荷物の届け先。**どこで配るか。**
#
# 分ける前は `kind`（demo / starter / advance）が
# 「何であるか」と「どこへ出るか」を兼ねていた。決めた時点で出し先が固まり、
# 「デルフォイには出さないが、引き換えコードでだけ渡す」ができなかった。
RSpec.describe ContentDelivery do
  let(:author) { create(:user, :confirmed) }
  let(:word) { create(:item_type, name: "word", label: "単語") }

  let(:png) do
    [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
      "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
      "0000000049454e44ae426082" ].pack("H*")
  end

  def publish(key:, name: key)
    box = author.boxes.create!(name: name)
    item = author.items.create!(title: "#{name}のカード", item_type: word, generation_status: "completed")
    item.medias.create!(media_type: "image", position: 0)
        .file.attach(io: StringIO.new(png), filename: "a.png", content_type: "image/png")
    item.meanings.create!(definition: "説明", language_code: "ja", position: 0)
    box.box_entries.create!(entry: item, position: 1)

    ContentPackage.publish!(key: key, kind: "starter", name: name,
                            payload: ContentPackages::Exporter.call(boxes: [ box ]))
  end

  describe "届け先を決める" do
    let!(:package) { publish(key: "starter_it", name: "ITのことば") }

    it "はじめは、どこへも出ていない" do
      expect(described_class.state_for("starter_it").map { |d| d[:enabled] }).to all(be(false))
    end

    it "出し先を入れられる" do
      described_class.set!(package_key: "starter_it", channel: "delphi", enabled: true)

      expect(described_class.keys_for("delphi")).to eq([ "starter_it" ])
    end

    # ここが分けた値打ち。**片方だけ出す、ができる**
    it "デルフォイには出さず、引き換えコードでだけ渡せる" do
      described_class.set!(package_key: "starter_it", channel: "campaign", enabled: true)

      expect(described_class.keys_for("campaign")).to eq([ "starter_it" ])
      expect(described_class.keys_for("delphi")).to be_empty
    end

    it "止められる" do
      described_class.set!(package_key: "starter_it", channel: "delphi", enabled: true)
      described_class.set!(package_key: "starter_it", channel: "delphi", enabled: false)

      expect(described_class.keys_for("delphi")).to be_empty
    end

    it "同じ荷物・同じ届け先は1行だけ" do
      3.times { described_class.set!(package_key: "starter_it", channel: "delphi", enabled: true) }

      expect(described_class.where(package_key: "starter_it", channel: "delphi").count).to eq(1)
    end

    it "知らない届け先は入れられない" do
      expect { described_class.set!(package_key: "starter_it", channel: "carrier_pigeon", enabled: true) }
        .to raise_error(ActiveRecord::RecordInvalid)
    end
  end

  # **版ではなく鍵に付ける。** 出し直すたびに設定し直しになるのを避ける
  describe "版を上げても引き継がれる" do
    it "v2 を出しても、届け先はそのまま" do
      publish(key: "starter_it", name: "ITのことば")
      described_class.set!(package_key: "starter_it", channel: "delphi", enabled: true)

      publish(key: "starter_it", name: "ITのことば") # v2

      expect(described_class.keys_for("delphi")).to eq([ "starter_it" ])
      expect(described_class.packages_for("delphi").first.version).to eq(2)
    end
  end

  describe "いま配れるもの" do
    let!(:package) { publish(key: "starter_it", name: "ITのことば") }

    before { described_class.set!(package_key: "starter_it", channel: "delphi", enabled: true) }

    it "公開中のものだけ返す" do
      expect(described_class.packages_for("delphi").map(&:key)).to eq([ "starter_it" ])
    end

    # 届け先は入っていても、荷物を止めていれば配らない
    it "止めている荷物は返さない" do
      package.suspend!

      expect(described_class.packages_for("delphi")).to be_empty
    end

    it "終えた荷物も返さない" do
      package.archive!

      expect(described_class.packages_for("delphi")).to be_empty
    end

    # **止めたのに配られ続ける、を起こさない。**
    #
    # 「公開中のうち一番新しいもの」を配ると、v2 を止めたときに
    # v1 へ落ちる。押した人は止めたつもりなのに、古い中身が配られる
    it "新しい版を止めたら、古い版へ落ちない" do
      publish(key: "starter_it", name: "ITのことば") # v2
      described_class.packages_for("delphi") # v2 が配られている
      ContentPackage.find_by(key: "starter_it", version: 2).suspend!

      expect(described_class.packages_for("delphi")).to be_empty
    end

    it "止めた版を戻すと、また配られる" do
      publish(key: "starter_it", name: "ITのことば") # v2
      newest = ContentPackage.find_by(key: "starter_it", version: 2)
      newest.suspend!
      newest.resume!

      expect(described_class.packages_for("delphi").map(&:version)).to eq([ 2 ])
    end

    # 下書きは「まだ出していない」なので、いま配っているものを引っ込めない
    it "新しい下書きを起こしても、いま出している版は配られ続ける" do
      ContentPackage.draft!(key: "starter_it", kind: "starter", name: "ITのことば",
                            payload: package.payload)

      expect(described_class.packages_for("delphi").map(&:version)).to eq([ 1 ])
    end

    it "下書きは返さない" do
      described_class.set!(package_key: "draft_only", channel: "delphi", enabled: true)

      expect(described_class.packages_for("delphi").map(&:key)).not_to include("draft_only")
    end
  end

  describe "画面へ渡す形" do
    it "まだ入れていない届け先も並べる（設定できる場所が見えるように）" do
      state = described_class.state_for("starter_it")

      expect(state.map { |d| d[:channel] }).to eq(described_class::CHANNELS)
      expect(state.map { |d| d[:label] }).to all(be_present)
    end

    # **設定できるのに届かない、を黙って起こさない**
    it "受け取る側の仕組みが無いものは、そうと分かる" do
      state = described_class.state_for("starter_it").index_by { |d| d[:channel] }

      expect(state["delphi"][:pending]).to be(false)
      expect(state["demo"][:pending]).to be(false)
      expect(state["campaign"][:pending]).to be(true)
      expect(state["mission"][:pending]).to be(true)
      expect(state["purchase"][:pending]).to be(true)
    end

    # 「配る」とだけ言わない。どこで・誰に届くのかが分かる言葉にする
    it "言い方が、どこへ届くかを言っている" do
      labels = described_class::CHANNEL_LABELS

      expect(labels["demo"]).to eq("体験の宮殿に置く")
      expect(labels["delphi"]).to eq("デルフォイで受け取れる")
      expect(labels["campaign"]).to eq("引き換えコードで渡す")
    end
  end
end
