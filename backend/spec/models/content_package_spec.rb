# frozen_string_literal: true

require "rails_helper"

# 公開したものは動かさない。直したいときは新しい版を出す。
#
# ここが崩れると、**配ったあとで中身が入れ替わる**。
# 受け取った人の手元は変わらないので、
# 「その人が何を受け取ったのか」が誰にも分からなくなる。
RSpec.describe ContentPackage do
  let(:author) { create(:user, :confirmed) }
  let(:word) { create(:item_type, name: "word", label: "単語") }

  let(:png) do
    [ "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" \
      "0000000a49444154789c6360000002000100ffff03000006000557bfabd4" \
      "0000000049454e44ae426082" ].pack("H*")
  end

  # 実際に書き出したものを使う。**手で組んだ形だと、本物とずれても気づけない**
  let(:payload) do
    box = author.boxes.create!(name: "ITのことば")
    %w[DNS ルーター].each_with_index do |title, i|
      item = author.items.create!(title: title, item_type: word, generation_status: "completed")
      media = item.medias.create!(media_type: "image", position: 0)
      media.file.attach(io: StringIO.new(png), filename: "#{i}.png", content_type: "image/png")
      item.meanings.create!(definition: "#{title} の説明", language_code: "ja", position: 0)
      box.box_entries.create!(entry: item, position: i + 1)
    end
    ContentPackages::Exporter.call(boxes: [ box ])
  end

  def publish!(key: "starter_it", kind: "starter", name: "ITのことば")
    described_class.publish!(key: key, kind: kind, name: name, payload: payload)
  end

  describe "公開" do
    it "版は1から始まり、出すたびに1つ上がる" do
      expect(publish!.version).to eq(1)
      expect(publish!.version).to eq(2)
      expect(publish!(key: "starter_words", name: "ことば").version).to eq(1)
    end

    it "公開した時刻が入る" do
      expect(publish!.published_at).to be_present
      expect(publish!).to be_published
    end

    it "古い版も残る" do
      publish!
      publish!

      expect(described_class.where(key: "starter_it").pluck(:version)).to contain_exactly(1, 2)
    end

    it "同じ鍵で同じ版は作れない" do
      publish!

      expect { described_class.create!(key: "starter_it", version: 1, kind: "starter", status: "draft", name: "重複", payload: payload) }
        .to raise_error(ActiveRecord::RecordInvalid)
    end
  end

  # ここが本丸
  describe "公開したものは動かさない" do
    let!(:package) { publish! }

    it "中身は変えられない" do
      package.payload = payload.merge("items" => [])

      expect(package.save).to be(false)
      expect(package.errors.full_messages.join).to match(/公開済みの内容は変えられません/)
    end

    it "名前も鍵も版も変えられない" do
      %i[name key version kind].each do |field|
        fresh = described_class.find(package.id)
        fresh.public_send("#{field}=", field == :version ? 99 : "changed_#{field}")

        expect(fresh.save).to be(false), "#{field} が変えられてしまった"
      end
    end

    # 配るのをやめるのは「中身の変更」ではないので、これは通す
    it "配るのをやめることはできる" do
      expect(package.archive!).to be(true)
      expect(package.reload.status).to eq("archived")
    end

    it "作りかけのうちは直せる" do
      draft = described_class.create!(key: "draft_one", version: 1, kind: "starter",
                                      status: "draft", name: "下書き", payload: payload)

      expect(draft.update(name: "直した")).to be(true)
    end
  end

  describe "配れるもの" do
    it "その鍵の、いちばん新しい公開版を返す" do
      publish!
      latest = publish!

      expect(described_class.latest_published("starter_it")).to eq(latest)
    end

    # **止めたら止まる。古い版へは落ちない。**
    #
    # 前は「公開中のうち一番新しいもの」を返していた。
    # そうすると v2 を終えたときに v1 が配られ、
    # 押した人は止めたつもりなのに古い中身が配られ続ける
    it "いちばん新しい版を終えたら、何も返さない" do
      publish!
      publish!.archive!

      expect(described_class.latest_published("starter_it")).to be_nil
    end

    it "いちばん新しい版を止めたときも、何も返さない" do
      publish!
      publish!.suspend!

      expect(described_class.latest_published("starter_it")).to be_nil
    end

    # 下書きは「まだ出していない」。いま出しているものを引っ込めない
    it "新しい下書きがあっても、いま出している版を返す" do
      live = publish!
      described_class.draft!(key: "starter_it", kind: "starter", name: "ITのことば", payload: payload)

      expect(described_class.latest_published("starter_it")).to eq(live)
    end

    it "鍵ごとに1つずつ返す" do
      publish!
      publish!
      publish!(key: "starter_words", name: "ことば")

      expect(described_class.distributable(kind: "starter").map { |p| [ p.key, p.version ] })
        .to contain_exactly([ "starter_it", 2 ], [ "starter_words", 1 ])
    end
  end

  describe "読めない中身" do
    it "公開できない" do
      expect { described_class.publish!(key: "broken", kind: "starter", name: "壊れ", payload: { "schema" => 1 }) }
        .to raise_error(ActiveRecord::RecordInvalid, /読めない形式|カードが1枚も/)
    end
  end

  describe "受け取る前に見せる要約" do
    it "中身を開かずに数が分かる" do
      expect(publish!.summary_counts).to include(items: 2, boxes: 1, views: 0)
    end
  end

  describe "配る" do
    it "受け取った人の宮殿に入る" do
      receiver = create(:user, :confirmed)
      result = publish!.install!(user: receiver)

      expect(receiver.items.pluck(:title)).to contain_exactly("DNS", "ルーター")
      expect(result.boxes.first.name).to eq("ITのことば")
    end
  end

  # 原本を触っても、配ったものは動かない。
  #
  # 公開したあとも運営は原本を育て続ける。**その手が配布物に届いてはいけない。**
  describe "原本を触っても、配ったものは壊れない" do
    let!(:package) { publish! }

    it "原本の題を変えても、荷物の中身は変わらない" do
      author.items.find_by(title: "DNS").update!(title: "まったく別の名前")

      expect(package.reload.payload["items"].map { |i| i["title"] })
        .to contain_exactly("DNS", "ルーター")
    end

    it "原本の箱を消しても、荷物は残って配れる" do
      author.boxes.destroy_all

      receiver = create(:user, :confirmed)
      result = package.reload.install!(user: receiver)

      expect(result.created_items.map(&:title)).to contain_exactly("DNS", "ルーター")
    end

    # ここが肝。**絵は shared_media が持ち続けるから残る。**
    #
    # 添付が2つ以上ある blob は、片方を外しても消えない（Rails がそうしている）。
    # 本番の絵は必ず shared_media 由来で、あちらは消さない決まりなので、
    # 原本のカードを消しても配った先の絵は生きている。
    # **この前提が崩れると、配布物の絵が一斉に消える。**
    #
    # 掃除は後回しの仕事（`purge_later`）なので、
    # **実際に走らせて測る**。積まれただけで判定すると、何も確かめずに通ってしまう
    describe "原本のカードを消したとき" do
      def build_package(key:, blob:)
        box = author.boxes.create!(name: "#{key} の箱")
        item = author.items.create!(title: "絵つき", item_type: word, generation_status: "completed")
        item.medias.create!(media_type: "image", position: 0).file.attach(blob)
        item.meanings.create!(definition: "説明", language_code: "ja", position: 0)
        box.box_entries.create!(entry: item, position: 1)

        pkg = described_class.publish!(key: key, kind: "starter", name: key,
                                       payload: ContentPackages::Exporter.call(boxes: [ box ]))
        [ pkg, item ]
      end

      it "shared_media が持っている絵なら生きている" do
        shared = SharedMedia.create!(normalized_prompt: "pkg-spec-#{SecureRandom.hex(4)}", user_id: author.id)
        shared.file.attach(io: StringIO.new(png), filename: "shared.png", content_type: "image/png")

        pkg, item = build_package(key: "shared_pkg", blob: shared.file.blob)
        perform_enqueued_jobs { item.destroy! }

        result = pkg.install!(user: create(:user, :confirmed))
        expect(result.created_items.first.primary_media.file).to be_attached
      end

      # 上のテストが「掃除が走っていないだけ」で通っていないことの裏取り。
      # 誰も持っていない絵は、**実際に消える**
      it "誰も持っていない絵なら消える（測り方が効いていることの確認）" do
        blob = ActiveStorage::Blob.create_and_upload!(
          io: StringIO.new(png), filename: "lonely.png", content_type: "image/png"
        )
        pkg, item = build_package(key: "lonely_pkg", blob: blob)
        perform_enqueued_jobs { item.destroy! }

        expect { pkg.install!(user: create(:user, :confirmed)) }
          .to raise_error(ContentPackages::Payload::ImportError, /絵が見つかりません/)
      end
    end
  end

  # 原本を持つアカウントは1つだが、**それを触る人はいずれ増える**。
  # そのとき「この版を出したのは誰か」が分からないと、中身の食い違いを追えない
  describe "誰が出したか" do
    let(:editor) { create(:user, :confirmed, role: "operator") }

    # 自前の箱を用意する。**他の例と共有しない**（走る順で中身が変わる）
    let(:audited_box) do
      box = author.boxes.create!(name: "監査の箱")
      item = author.items.create!(title: "監査用", item_type: word, generation_status: "completed")
      item.medias.create!(media_type: "image", position: 0)
          .file.attach(io: StringIO.new(png), filename: "a.png", content_type: "image/png")
      item.meanings.create!(definition: "説明", language_code: "ja", position: 0)
      box.box_entries.create!(entry: item, position: 1)
      box
    end

    def publish_via_service(actor: nil)
      ContentPackages::Publisher.call(
        key: "audited", kind: "starter", name: "監査",
        boxes: [ audited_box ], actor: actor
      )
    end

    it "運営の記録に残る" do
      expect { publish_via_service(actor: editor) }
        .to change { AdminAuditLog.where(action: "content_package.publish").count }.by(1)

      log = AdminAuditLog.where(action: "content_package.publish").last
      expect(log.actor_id).to eq(editor.id)
      expect(log.details["key"]).to eq("audited")
      expect(log.details["version"]).to eq(1)
    end

    # 退会したあとも、誰だったかは分かる（メールを一緒に持っている）
    it "退会しても、誰が出したかは残る" do
      publish_via_service(actor: editor)
      email = editor.email
      editor.destroy!

      log = AdminAuditLog.where(action: "content_package.publish").last
      expect(log.reload.actor_id).to be_nil
      expect(log.actor_email).to eq(email)
    end

    # 記録のために公開を止めない
    it "記録に失敗しても、公開そのものは通る" do
      allow(AdminAuditLog).to receive(:create!).and_raise(StandardError, "書けません")

      expect { publish_via_service(actor: editor) }.to change(described_class, :count).by(1)
    end

    it "誰が押したか分からなくても公開できる（rake から）" do
      expect { publish_via_service(actor: nil) }.to change(described_class, :count).by(1)
    end
  end

  describe "鍵の形" do
    it "扱いにくい字は受け付けない" do
      %w[ST Starter\ IT あ x 名前に空白].each do |bad|
        record = described_class.new(key: bad, version: 1, kind: "starter", name: "x", payload: payload)
        expect(record).to be_invalid, "#{bad.inspect} が通ってしまった"
      end
    end
  end
end
