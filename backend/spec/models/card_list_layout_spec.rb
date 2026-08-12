require "rails_helper"

# 一覧に出す項目の並び。
#
# **ここが真実の場所**だが、旧の2つ（card_headline_key / card_list_fields）で
# 設定している人がいる。移行の要は「読み解くが、書き戻さない」こと。
# 設定画面を開いていない人の行を、こちらの都合で書き換えない。
RSpec.describe "一覧に出す項目の並び", type: :model do
  let(:user) { create(:user, :confirmed) }
  let(:setting) { user.setting || Setting.create!(user: user) }

  describe "何も設定していない人" do
    it "これまでどおり「名前と絵」になる" do
      expect(setting.visible_card_list_keys).to eq(%w[title image])
    end
  end

  describe "旧の設定からの読み解き" do
    it "名前に出す項目が先頭に来る" do
      setting.update!(card_headline_key: "reading")

      expect(setting.visible_card_list_keys).to eq(%w[reading image])
    end

    it "名前の下に出す項目が、絵の後ろに続く" do
      setting.update!(card_headline_key: "reading", card_list_fields: %w[alias])

      expect(setting.visible_card_list_keys).to eq(%w[reading image alias])
    end

    # ここが要。読み解くだけで、行は書き換えない
    it "読み解いても、保存されている値は空のまま" do
      setting.update!(card_list_fields: %w[alias])

      setting.visible_card_list_keys

      expect(setting.reload.card_list_layout).to eq([])
    end
  end

  describe "新しい形で保存したとき" do
    it "旧の設定より優先される" do
      setting.update!(
        card_headline_key: "reading",
        card_list_fields: %w[alias],
        card_list_layout: [ { "key" => "title", "visible" => true },
                            { "key" => "meaning", "visible" => true } ]
      )

      expect(setting.visible_card_list_keys).to eq(%w[title meaning])
    end

    it "出さない指定の項目は、並びには残るが出す対象から外れる" do
      setting.update!(card_list_layout: [ { "key" => "title", "visible" => true },
                                          { "key" => "image", "visible" => false } ])

      expect(setting.card_list_layout_entries.size).to eq(2)
      expect(setting.visible_card_list_keys).to eq(%w[title])
    end

    it "重複は畳む" do
      setting.update!(card_list_layout: [ { "key" => "title", "visible" => true },
                                          { "key" => "title", "visible" => false } ])

      expect(setting.card_list_layout.map { |r| r["key"] }).to eq(%w[title])
    end

    # 上限は「出す指定の数」に掛ける。候補そのものは持っていてよい
    describe "出す指定の上限" do
      it "6件目を出す指定にしようとすると断る（黙って落とさない）" do
        rows = (1..6).map { |i| { "key" => "p#{i}", "visible" => true } }
        setting.card_list_layout = rows

        expect(setting).not_to be_valid
        expect(setting.errors.full_messages.join).to include("5件までです")
      end

      it "隠した項目は何件あってもよい" do
        rows = (1..5).map { |i| { "key" => "p#{i}", "visible" => true } } +
               (6..12).map { |i| { "key" => "p#{i}", "visible" => false } }

        expect(setting.update(card_list_layout: rows)).to be(true)
        expect(setting.reload.card_list_layout.size).to eq(12)
        expect(setting.visible_card_list_keys.size).to eq(5)
      end

      # 上限を入れる前に保存された行が残っていても、画面が壊れないようにする
      it "既に上限を超えている古い行は、読むときに後ろから隠す（保存はしない）" do
        rows = (1..7).map { |i| { "key" => "p#{i}", "visible" => true } }
        setting.update_column(:card_list_layout, rows) # rubocop:disable Rails/SkipsModelValidations

        expect(setting.reload.visible_card_list_keys).to eq(%w[p1 p2 p3 p4 p5])
        expect(setting.card_list_layout.size).to eq(7)
      end
    end

    it "key の無い行は捨てる" do
      setting.update!(card_list_layout: [ { "key" => "", "visible" => true },
                                          { "key" => "title", "visible" => true } ])

      expect(setting.card_list_layout.map { |r| r["key"] }).to eq(%w[title])
    end
  end
end
