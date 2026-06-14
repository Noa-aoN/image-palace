require "rails_helper"

RSpec.describe GenerateTagsJob, type: :job do
  let(:user) { create(:user, :confirmed) }
  let(:item) { create(:item, user: user, title: "光合成") }

  it "サービスを呼んでタグを生成する" do
    allow(GenerateTagsService).to receive(:call)

    described_class.perform_now(item.id)

    expect(GenerateTagsService).to have_received(:call).with(item: item)
  end

  it "生成に失敗してもジョブは例外を伝播させない（補助情報のため）" do
    allow(GenerateTagsService).to receive(:call).and_raise(GenerateTagsService::GenerationError, "失敗")

    expect { described_class.perform_now(item.id) }.not_to raise_error
  end

  it "存在しないアイテムでは何もしない" do
    expect(GenerateTagsService).not_to receive(:call)

    described_class.perform_now(SecureRandom.uuid)
  end
end
