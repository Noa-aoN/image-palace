require "rails_helper"

# カードを作るときに、項目（読み仮名・別名など）も一緒に埋める。
#
# **1回の呼び出しでまとめて埋める。** 項目ごとに呼ぶと、3つ選んだ人は
# 1枚のカードで3回 AI を叩くことになる。
#
# 項目そのものを決めていない人がほとんどだった（本番で13人中1人）。
# 「出す」と決めた時点で、決めたぶんだけ用意する。
RSpec.describe "作成時の項目の自動生成" do
  let(:user) { create(:user, :confirmed) }
  let!(:item_type) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }

  def create_item(params = {})
    Items::CreateService.call(user: user, params: { title: "光合成" }.merge(params))
  end

  before { allow(Moderation::PromptModerator).to receive(:call).and_return(double(allowed?: true)) }

  describe "選んだとき" do
    it "項目の定義が無ければ用意してから積む" do
      expect(user.property_definitions.count).to eq(0)

      expect { create_item(generate_properties: true, generate_property_keys: %w[reading aliases]) }
        .to have_enqueued_job(FillItemPropertiesJob)

      expect(user.property_definitions.pluck(:key)).to contain_exactly("reading", "aliases")
    end

    it "既にある定義は作り直さない" do
      user.property_definitions.create!(item_type: item_type, key: "reading", label: "よみ", value_type: "text")

      create_item(generate_properties: true, generate_property_keys: %w[reading])

      expect(user.property_definitions.where(key: "reading").count).to eq(1)
      # 利用者が付けた呼び名を、こちらの都合で書き換えない
      expect(user.property_definitions.find_by(key: "reading").label).to eq("よみ")
    end

    it "選んだぶんだけを1回のジョブで埋める（項目ごとに積まない）" do
      expect { create_item(generate_properties: true, generate_property_keys: %w[reading aliases pronunciation]) }
        .to have_enqueued_job(FillItemPropertiesJob).exactly(:once)
    end

    it "名指しが無ければ、用意できるものを全部" do
      create_item(generate_properties: true)

      expect(user.property_definitions.pluck(:key))
        .to contain_exactly("reading", "aliases", "pronunciation")
    end

    it "知らない識別名は作らない（勝手に項目を増やさない）" do
      create_item(generate_properties: true, generate_property_keys: %w[reading 好きな食べ物])

      expect(user.property_definitions.pluck(:key)).to eq([ "reading" ])
    end
  end

  describe "選んでいないとき" do
    it "積まない・項目も作らない" do
      expect { create_item(generate_properties: false) }.not_to have_enqueued_job(FillItemPropertiesJob)

      expect(user.property_definitions.count).to eq(0)
    end

    it "指定が無ければ利用者の設定に従う（既定は作らない）" do
      expect { create_item }.not_to have_enqueued_job(FillItemPropertiesJob)
    end

    it "設定を入れておけば、指定しなくても積む" do
      user.create_setting!(auto_generate_properties: true)

      expect { create_item }.to have_enqueued_job(FillItemPropertiesJob)
    end
  end

  describe "手で書いたもの" do
    let(:item) { create(:item, user: user, item_type: item_type, title: "光合成") }

    it "埋まっている項目は触らない" do
      definition = user.property_definitions.create!(
        item_type: item_type, key: "reading", label: "読み仮名", value_type: "text"
      )
      item.item_properties.create!(property_definition: definition, value: { "v" => "こうごうせい" })

      # 名指ししても、空いているものだけを対象にする
      service = Items::FillPropertiesService.new(item: item, keys: %w[reading], only_blank: true)

      expect { service.call }.to raise_error(Items::FillPropertiesService::FillError, /埋める項目がありません/)
      expect(item.item_properties.first.value["v"]).to eq("こうごうせい")
    end
  end
end
