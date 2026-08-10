require "rails_helper"

# 生成された絵に覆いを掛ける「セーフガード」。
# 入り切りは利用者ごとの設定で、切っている人の見え方は今までと変わらない。
RSpec.describe "画像のセーフガード", type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers_for(user) }
  let(:item) { create(:item, user: user) }

  describe "生成が終わったとき" do
    let(:shared_media) do
      create(:shared_media, :with_file,
        user: user,
        normalized_prompt: NormalizePromptService.call(PromptBuilderService.effective_prompt(item)),
        metadata: { "provider" => "openai" })
    end

    it "設定が入なら承認待ちにする" do
      user.create_setting!(image_safeguard: true)
      shared_media

      GenerateImageJob.perform_now(item.id)

      expect(item.reload.primary_media.needs_approval).to be(true)
    end

    it "設定が切なら覆わない（従来どおり）" do
      user.create_setting!(image_safeguard: false)
      shared_media

      GenerateImageJob.perform_now(item.id)

      expect(item.reload.primary_media.needs_approval).to be(false)
    end

    # 作り直しは同じ media の行を使い回す。入れ直さないと、一度承認した枠に
    # 新しい絵が覆い無しで入ってしまう
    it "承認済みのカードを作り直すと、また承認待ちに戻る" do
      user.create_setting!(image_safeguard: true)
      shared_media
      GenerateImageJob.perform_now(item.id)
      item.reload.primary_media.update!(needs_approval: false)

      # 作り直しは retry が status を pending に落としてから積む。それを再現する
      item.update_generation_status!("pending")
      GenerateImageJob.perform_now(item.id)

      expect(item.reload.primary_media.needs_approval).to be(true)
    end
  end

  describe "POST /api/v1/items/:id/approve_image" do
    before do
      user.create_setting!(image_safeguard: true)
      create(:shared_media, :with_file,
        user: user,
        normalized_prompt: NormalizePromptService.call(PromptBuilderService.effective_prompt(item)),
        metadata: { "provider" => "openai" })
      GenerateImageJob.perform_now(item.id)
    end

    it "覆いを外す" do
      post "/api/v1/items/#{item.id}/approve_image", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig("media", "needs_approval")).to be(false)
      expect(item.reload.primary_media.needs_approval).to be(false)
    end

    it "他人のカードは触れない" do
      other = create(:item, user: create(:user, :confirmed))

      post "/api/v1/items/#{other.id}/approve_image", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "画像がまだ無いカード" do
    it "承認しようとしても弾く" do
      post "/api/v1/items/#{item.id}/approve_image", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
