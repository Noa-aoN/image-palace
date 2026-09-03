require "rails_helper"

# 絵が語と噛み合っているか。**見るのは出来上がった絵**で、作るときの指示ではない。
RSpec.describe Images::FitCheckService do
  let(:user) { create(:user, :confirmed) }
  let(:item) { create(:item, user: user, title: "光合成") }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with("OPENAI_API_KEY").and_return("test-key")
  end

  def attach_image!
    media = item.medias.create!(media_type: "image", position: 0)
    media.file.attach(
      io: StringIO.new("\x89PNG\r\n\x1a\n" + "x" * 32),
      filename: "photosynthesis.png",
      content_type: "image/png"
    )
    media
  end

  def stub_chat(content)
    sent = []
    client = instance_double(OpenAI::Client)
    allow(OpenAI::Client).to receive(:new).and_return(client)
    allow(client).to receive(:chat) do |args|
      sent << args.dig(:parameters, :messages)
      { "choices" => [ { "message" => { "content" => content } } ] }
    end
    sent
  end

  it "判定とコメントをカードに残す" do
    attach_image!
    stub_chat({ status: "mismatch", comment: "別の語の絵に見えます。葉と光を描き直してください。" }.to_json)

    described_class.call(item: item)

    expect(item.reload.image_check_status).to eq("mismatch")
    expect(item.image_check_comment).to include("描き直して")
    expect(item.image_checked_at).to be_present
  end

  it "絵そのものを送る（URL では渡さない。手元では外から取りに来られないため）" do
    attach_image!
    sent = stub_chat({ status: "fits", comment: "" }.to_json)

    described_class.call(item: item)

    image_part = sent.first.last[:content].find { |part| part[:type] == "image_url" }
    expect(image_part[:image_url][:url]).to start_with("data:image/png;base64,")
    # 見るのは噛み合いで細部ではない。高い解像度は費用が桁で変わる
    expect(image_part[:image_url][:detail]).to eq("low")
  end

  it "説明があれば一緒に渡す（何の語かを絵だけから当てさせない）" do
    attach_image!
    item.meanings.create!(definition: "植物が光で養分を作る働き", language_code: "ja")
    sent = stub_chat({ status: "fits", comment: "" }.to_json)

    described_class.call(item: item)

    text_part = sent.first.last[:content].find { |part| part[:type] == "text" }
    expect(text_part[:text]).to include("植物が光で養分を作る働き")
  end

  it "絵が無ければ判定しない（見ていないものを「合っている」にしない）" do
    stub_chat({ status: "fits", comment: "" }.to_json)

    expect { described_class.call(item: item) }.to raise_error(described_class::NoImage)
    expect(item.reload.image_check_status).to be_nil
  end

  it "知らない判定は weak に寄せる（読めないものを fits にしない）" do
    attach_image!
    stub_chat({ status: "perfect", comment: "" }.to_json)

    described_class.call(item: item)

    expect(item.reload.image_check_status).to eq("weak")
  end

  it "壊れた返事は例外にする（黙って判定を書き換えない）" do
    attach_image!
    stub_chat("これは JSON ではない")

    expect { described_class.call(item: item) }.to raise_error(described_class::GenerationError)
  end
end
