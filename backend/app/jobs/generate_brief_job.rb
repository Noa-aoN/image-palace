# frozen_string_literal: true

# 画像を作る前に、単語を説明文と画像への指示へ噛み砕く。
#
# 終わったら必ず GenerateImageJob へ引き継ぐ。
# ここで失敗しても画像生成は従来どおり単語から行われる（後退しない）ため、
# リトライは付けず、失敗は brief_status に残して先へ進める。
#
# research_level を渡すと「調べてから作る」経路になる。
#   ① 意味・説明を作る → ② それをもとに画像への指示を書き直す → ③ 画像
# 通常の経路は単語だけから指示を作るので、同じ単語なら全ユーザーで指示が一致し、
# 画像も共有キャッシュで使い回せる。調べてから作るとカード固有の指示になるため
# その使い回しは効かなくなる（＝生成コストが上がる）。だから既定にはしない。
#
# ①②の失敗はどちらも致命ではない。単語からの指示が既に入っているので、そこへ落ちる。
class GenerateBriefJob < ApplicationJob
  queue_as :default

  def perform(item_id, force_generate: false, use_meaning: false, research_level: nil)
    item = Item.find_by(id: item_id)
    return if item.nil?

    resolve_brief!(item)
    research!(item, research_level) if research_level.present?
  ensure
    # item が消えていた場合を除き、必ず画像生成へ進む
    GenerateImageJob.perform_later(item_id, force_generate: force_generate, use_meaning: use_meaning) if item
  end

  private

  # 意味・説明を作り、それをもとに画像への指示を書き直す。
  # 手で直した指示は上書きしない（作成直後には無いが、再実行され得るため揃えておく）。
  def research!(item, level)
    GenerateMeaningService.call(item: item, level: level)
    return if item.reload.brief_edited?

    result = Images::SceneRewriteService.call(item: item, user: item.user)
    # 作成時は選ぶ人がいない。説明に合う意味が先頭に来るようサービス側で指示してある
    item.update!(scene_prompt: result.options.first.scene_prompt, brief_status: "completed")
    Rails.logger.info "[GenerateBriefJob] RESEARCHED item_id=#{item.id} options=#{result.options.size}"
  rescue StandardError => e
    # 単語からの指示が既に入っているので、そこへ落ちれば絵は作れる
    Rails.logger.warn "[GenerateBriefJob] RESEARCH FAILED item_id=#{item.id} #{e.class}: #{e.message}"
  end

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
