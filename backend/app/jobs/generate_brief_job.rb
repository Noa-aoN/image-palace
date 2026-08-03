# frozen_string_literal: true

# 画像を作る前に、単語を説明文と情景プロンプトへ噛み砕く。
#
# 終わったら必ず GenerateImageJob へ引き継ぐ。
# ここで失敗しても画像生成は従来どおり単語から行われる（後退しない）ため、
# リトライは付けず、失敗は brief_status に残して先へ進める。
class GenerateBriefJob < ApplicationJob
  queue_as :default

  def perform(item_id, force_generate: false, use_meaning: false)
    item = Item.find_by(id: item_id)
    return if item.nil?

    resolve_brief!(item)
  ensure
    # item が消えていた場合を除き、必ず画像生成へ進む
    GenerateImageJob.perform_later(item_id, force_generate: force_generate, use_meaning: use_meaning) if item
  end

  private

  def resolve_brief!(item)
    # ユーザーが手で直したものは上書きしない
    return if item.brief_edited?

    item.update!(brief_status: "processing")
    brief = Images::BriefResolver.call(title: item.title, user: item.user)

    if brief.nil?
      # 機能が無効。従来どおり単語をそのまま使う
      item.update!(brief_status: "none")
      return
    end

    item.update!(
      image_description: brief.description,
      scene_prompt: brief.scene_prompt,
      brief_status: "completed"
    )
    Rails.logger.info "[GenerateBriefJob] READY item_id=#{item.id} kind=#{brief.subject_kind}"
  rescue StandardError => e
    Rails.logger.warn "[GenerateBriefJob] FAILED item_id=#{item.id} #{e.class}: #{e.message}"
    item.update_columns(brief_status: "failed")
  end
end
