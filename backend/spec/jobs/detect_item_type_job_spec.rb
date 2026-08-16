require "rails_helper"

RSpec.describe DetectItemTypeJob do
  let(:user) { create(:user, :confirmed) }
  let!(:term) { ItemType.find_or_create_by!(name: "term") { |t| t.label = "単語" } }
  let!(:person) { ItemType.find_or_create_by!(name: "person") { |t| t.label = "人物" } }

  def detects(name)
    type = ItemType.find_by(name: name)
    allow(Cards::DetectItemTypeService).to receive(:call)
      .and_return(Cards::DetectItemTypeService::Result.new(item_type: type, model: "test"))
  end

  it "既定のままのカードは、判定した種別に変える" do
    item = create(:item, user: user, item_type: term)
    detects("person")

    described_class.perform_now(item.id)

    expect(item.reload.item_type).to eq(person)
  end

  # 作ったあとに直した人の選択を、あとから走るジョブが黙って戻さないこと
  it "自分で選んだ種別は上書きしない" do
    item = create(:item, user: user, item_type: person)
    expect(Cards::DetectItemTypeService).not_to receive(:call)

    described_class.perform_now(item.id)

    expect(item.reload.item_type).to eq(person)
  end

  # 判定の最中に人が直しているかもしれない。書く直前にもう一度確かめる
  it "判定中に人が直していたら、その選択を残す" do
    item = create(:item, user: user, item_type: term)
    allow(Cards::DetectItemTypeService).to receive(:call) do
      item.update_columns(item_type_id: person.id)
      Cards::DetectItemTypeService::Result.new(item_type: ItemType.find_by(name: "term"), model: "test")
    end

    described_class.perform_now(item.id)

    expect(item.reload.item_type).to eq(person)
  end

  # 種別は補助情報。落ちてもカードそのものは残る
  it "判定に失敗しても、カードは既定のまま残る" do
    item = create(:item, user: user, item_type: term)
    allow(Cards::DetectItemTypeService).to receive(:call)
      .and_raise(Cards::DetectItemTypeService::DetectError, "boom")

    expect { described_class.perform_now(item.id) }.not_to raise_error
    expect(item.reload.item_type).to eq(term)
  end

  it "カードが消えていても落ちない" do
    expect { described_class.perform_now(SecureRandom.uuid) }.not_to raise_error
  end
end
