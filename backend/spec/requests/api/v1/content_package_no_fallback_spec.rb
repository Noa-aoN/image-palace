# frozen_string_literal: true

require "rails_helper"

# **止めた荷物は、どの道からも配られない。**
#
# 「公開中のうち一番新しい版」を配る作りだと、v2 を止めたときに v1 へ落ちる。
# 押した人は止めたつもりなのに、古い中身が配られ続ける。
#
# 配る入口は増えていく（デルフォイ・体験の宮殿・登録直後の持ち帰り・
# 引き換えコード・ミッション・購入）。**入口ごとに同じ穴が開くのを防ぐ**ため、
# ここで道を1本ずつ数え上げて塞いでおく。
#
# 入口を足したら、ここにも1本足すこと。
RSpec.describe "止めた荷物が配られない", type: :request do
  let(:author) { create(:user, :confirmed) }
  let(:receiver) { create(:user, :confirmed) }
  let(:word) { create(:item_type, name: "word", label: "単語") }

  let(:png) do
    [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
      "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
      "0000000049454e44ae426082" ].pack("H*")
  end

  # 同じ鍵で2つの版を出す。**v1 には「古い」、v2 には「新しい」**を入れておき、
  # 配られた中身がどちらの版かを、題で見分けられるようにする
  def publish!(marker)
    box = author.boxes.create!(name: "ITのことば#{marker}")
    item = author.items.create!(title: "DNS（#{marker}）", item_type: word, generation_status: "completed")
    item.medias.create!(media_type: "image", position: 0)
        .file.attach(io: StringIO.new(png), filename: "#{SecureRandom.hex(4)}.png", content_type: "image/png")
    item.meanings.create!(definition: "名前を住所に直す仕組み", language_code: "ja", position: 0)
    box.box_entries.create!(entry: item, position: 1)

    ContentPackage.publish!(key: "starter_it", kind: "starter", name: "ITのことば",
                            payload: ContentPackages::Exporter.call(boxes: [ box ]))
  end

  let!(:v1) { publish!("古い") }
  let!(:v2) { publish!("新しい") }

  # 止め方は2つある。**どちらでも同じように止まること**
  %w[suspend archive].each do |how|
    context "いちばん新しい版を #{how == 'suspend' ? '止めた' : '終えた'}とき" do
      before do
        described = how == "suspend" ? :suspend! : :archive!
        v2.public_send(described)
      end

      # ── 道 1: 荷物そのものの引き方 ──────────────────
      it "latest_published は何も返さない" do
        expect(ContentPackage.latest_published("starter_it")).to be_nil
      end

      it "distributable にも出てこない" do
        expect(ContentPackage.distributable).to be_empty
        expect(ContentPackage.distributable(kind: "starter")).to be_empty
      end

      # ── 道 2: 届け先ごと（demo / delphi / campaign / mission / purchase）──
      it "どの届け先からも出てこない" do
        ContentDelivery::CHANNELS.each do |channel|
          ContentDelivery.set!(package_key: "starter_it", channel: channel, enabled: true)

          expect(ContentDelivery.packages_for(channel)).to be_empty,
                                                          "#{channel} から配られている"
        end
      end

      # ── 道 3: 体験の宮殿 ────────────────────────
      it "体験の宮殿に置かれない" do
        ContentDelivery.set!(package_key: "starter_it", channel: "demo", enabled: true)

        expect(Demo::Session.packages).to be_empty
      end

      it "体験の宮殿は、中身が無いと言って作られない" do
        ContentDelivery.set!(package_key: "starter_it", channel: "demo", enabled: true)
        FeatureFlag.find_or_initialize_by(key: "demo_entry").update!(stage: "released")

        expect { Demo::Session.call }
          .to raise_error(Demo::Session::Unavailable, /用意されていません/)
        expect(User.demo_accounts.count).to eq(0)
      end

      # ── 道 4: デルフォイの一覧と受け取り ──────────────
      it "デルフォイの一覧に出てこない" do
        ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)

        get "/api/v1/content_packages", headers: auth_headers_for(receiver), as: :json

        expect(response).to have_http_status(:success)
        expect(json_response["packages"]).to be_empty
      end

      # **一覧に出ていなくても、鍵さえ知っていれば取れる、が起きないように**
      it "鍵を直に指しても受け取れない" do
        ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)

        post "/api/v1/content_packages/starter_it/install",
             headers: auth_headers_for(receiver), as: :json

        expect(response).to have_http_status(:not_found)
        expect(receiver.items.count).to eq(0)
      end

      # ── 道 5: 配る仕組みそのもの（登録直後の持ち帰り・引き換え・報酬も通る）──
      it "鍵から配ろうとしても、古い版へ落ちない" do
        expect { ContentPackages::Distributor.call(user: receiver, key: "starter_it", source: "starter_free") }
          .to raise_error(ContentPackages::Distributor::NotDistributable)
        expect(receiver.items.count).to eq(0)
      end

      # 荷物そのものを渡す道もある（体験の宮殿づくり）。
      # **止めた版を渡されても配らない**
      it "止めた版を直に渡しても配らない" do
        expect { ContentPackages::Distributor.call(user: receiver, package: v2, source: "demo_signup") }
          .to raise_error(ContentPackages::Distributor::NotDistributable)
        expect(receiver.items.count).to eq(0)
      end

      # ── 戻せること ────────────────────────────
      it "戻すと、また新しい版が配られる（古い版ではなく）" do
        skip "終えたものは戻せない" if how == "archive"

        v2.resume!
        ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)

        post "/api/v1/content_packages/starter_it/install",
             headers: auth_headers_for(receiver), as: :json

        expect(response).to have_http_status(:created)
        expect(receiver.items.pluck(:title)).to eq([ "DNS（新しい）" ])
      end
    end
  end

  # 止めていないときは、ちゃんと新しい版が配られる。
  # **「何も配られない」でテストが通ってしまう**のを防ぐ
  describe "止めていないとき" do
    it "いちばん新しい版が配られる" do
      ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)

      post "/api/v1/content_packages/starter_it/install",
           headers: auth_headers_for(receiver), as: :json

      expect(response).to have_http_status(:created)
      expect(receiver.items.pluck(:title)).to eq([ "DNS（新しい）" ])
    end

    # 下書きは「まだ出していない」。いま出している版を引っ込めない
    it "新しい下書きを起こしても、いま出している版が配られ続ける" do
      ContentPackage.draft!(key: "starter_it", kind: "starter", name: "ITのことば", payload: v2.payload)
      ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)

      post "/api/v1/content_packages/starter_it/install",
           headers: auth_headers_for(receiver), as: :json

      expect(response).to have_http_status(:created)
      expect(ContentInstallation.last.package_version).to eq(2)
    end
  end

  # **もう受け取った人の宮殿は、あとから止めても変わらない。**
  # 配るのをやめることと、配ったものを取り上げることは別
  describe "すでに受け取った人" do
    it "止めても、手元のカードは消えない" do
      ContentDelivery.set!(package_key: "starter_it", channel: "delphi", enabled: true)
      post "/api/v1/content_packages/starter_it/install",
           headers: auth_headers_for(receiver), as: :json

      expect { v2.suspend! }.not_to change { receiver.items.count }
      expect(receiver.reload.items.pluck(:title)).to eq([ "DNS（新しい）" ])
      expect(ContentInstallation.where(user_id: receiver.id).count).to eq(1)
    end
  end
end
