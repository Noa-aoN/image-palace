# frozen_string_literal: true

# アイテムのタイトル・スタイル・カスタム指示から、画像生成に渡す「有効プロンプト」を組み立てる。
# 有効プロンプトは画像生成だけでなくキャッシュキー（normalized_prompt）の元にもなるため、
# スタイル/カスタムが異なれば別画像としてキャッシュされる。
class PromptBuilderService
  # スタイルプリセット → 画像生成プロンプトに付与する英語の修飾句
  STYLE_MODIFIERS = {
    "illustration" => "in a clean, flat vector illustration style",
    "photo" => "as a realistic, high-quality photograph",
    "watercolor" => "in a soft watercolor painting style",
    "anime" => "in a Japanese anime art style",
    "3d" => "as a polished 3D rendered image",
    "pixel" => "in retro pixel art style",
    "sketch" => "as a hand-drawn pencil sketch"
  }.freeze

  STYLES = STYLE_MODIFIERS.keys.freeze
  CUSTOM_PROMPT_MAX_LENGTH = 300

  # 単語をそのまま渡すと結果がブレやすく「一目で想起できる1枚」になりにくいため、
  # 記憶に残る単一主題の画像へ誘導する共通テンプレートで概念を包む。
  # 末尾にピリオドを置かないのは、後続の `, <style>` / `, <custom>` を自然に連結するため。
  # タイトルは英語・日本語ともそのまま埋め込む（gpt-image-1 は多言語対応のため翻訳しない）。
  # この文面はキャッシュキー（normalized_prompt）の一部になるため、変更すると既存キャッシュは自動で無効化される。
  BASE_TEMPLATE =
    'A vivid, memorable image that represents the concept of "%<concept>s" as one ' \
    "striking central subject. Clean simple background, strong clear silhouette, " \
    "easy to recall at a glance, no text, letters, or numbers"

  def self.effective_prompt(item)
    parts = [ format(BASE_TEMPLATE, concept: item.title.to_s.strip) ]

    modifier = STYLE_MODIFIERS[item.style.presence]
    parts << modifier if modifier

    custom = item.custom_prompt.to_s.strip
    parts << custom if custom.present?

    parts.join(", ")
  end
end
