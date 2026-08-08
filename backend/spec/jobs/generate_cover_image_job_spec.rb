require "rails_helper"

RSpec.describe GenerateCoverImageJob do
  let(:user) { create(:user, :confirmed) }
  let(:view) { user.views.create!(name: "テスト", view_type: "deck", cover_generation_status: "pending") }

  def stub_generation
    allow(GenerateImageService).to receive(:call).and_return(
      GenerateImageService::Result.new(
        image_data: "\x89PNG\r\n\x1A\nfake-png-bytes",
        content_type: "image/png",
        metadata: { "provider" => "openai" }
      )
    )
  end

  it "カバー画像を添付し、カスタム表示に切り替える" do
    stub_generation

    described_class.perform_now(view, "森の入口")

    view.reload
    expect(view.cover_image).to be_attached
    expect(view.cover_type).to eq("custom")
    expect(view.cover_generation_status).to eq("completed")
  end

  it "スタイル・見切れ回避・文字回避を付けて生成する" do
    stub_generation

    described_class.perform_now(view, "森の入口", "watercolor")

    expect(GenerateImageService).to have_received(:call) do |prompt:, **|
      expect(prompt).to start_with("森の入口")
      expect(prompt).to include("watercolor")
      expect(prompt).to include(PromptBuilderService::NO_TEXT_HINT)
    end
  end

  it "対象が消えていたら何もしない" do
    expect { described_class.perform_now(nil, "森の入口") }.not_to raise_error
  end

  it "プロンプトが空なら生成しない" do
    allow(GenerateImageService).to receive(:call)

    described_class.perform_now(view, "  ")

    expect(GenerateImageService).not_to have_received(:call)
  end

  it "回復しないエラーは失敗として残す" do
    allow(GenerateImageService).to receive(:call).and_raise(Faraday::BadRequestError.new("bad"))

    described_class.perform_now(view, "森の入口")

    view.reload
    expect(view.cover_generation_status).to eq("failed")
    expect(view.cover_generation_error).to be_present
  end

  it "スペース・ボックスでも同じように動く" do
    stub_generation
    box = user.boxes.create!(name: "テスト")

    described_class.perform_now(box, "古い木箱")

    expect(box.reload.cover_image).to be_attached
    expect(box.cover_type).to eq("custom")
  end
end
