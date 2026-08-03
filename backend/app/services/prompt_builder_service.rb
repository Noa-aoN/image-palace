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

  # 主役（subject）以外は足さない方針は変えていない。gpt-image-1 本来の表現力を殺さないため、
  # 構図・背景・カメラ設定は指定しない。主役が単語そのものか、単語から起こした情景かの違いだけ。
  # 末尾の軽い指示は、生成画像に紛れ込みがちな文字と見切れを避けるためのもの。
  # この文面はキャッシュキー（normalized_prompt）の一部になるため、
  # 変更すると既存キャッシュは自動で無効化される。
  NO_TEXT_HINT = "avoid any text, letters, or numbers"
  # 被写体が端で見切れるのを減らす軽い指示（構図は引き続き自由）。
  # NO_TEXT_HINT 同様キャッシュキーの一部になる。
  FRAMING_HINT = "keep the whole subject within the frame, not cropped at the edges"

  # include_meaning: true のとき、カードの意味・説明（primary_meaning.definition）を
  # 被写体の補足として追記する。再生成時のオプション（既定オフ）から渡される。
  # 追記すると normalized_prompt が変わるため、別画像として正しく扱われる。
  # 情景プロンプト（Images::BriefService が起こしたもの）があればそれを主役に据える。
  # 無ければ単語そのもの＝従来の文字列になるので、既存カードのキャッシュはそのまま効く。
  def self.subject(item)
    scene = item.scene_prompt.to_s.strip
    return scene if scene.present?

    item.title.to_s.strip
  end

  def self.effective_prompt(item, include_meaning: false)
    parts = [ subject(item) ]

    modifier = STYLE_MODIFIERS[item.style.presence]
    parts << modifier if modifier

    custom = item.custom_prompt.to_s.strip
    parts << custom if custom.present?

    if include_meaning
      meaning = item.primary_meaning&.definition.to_s.strip
      parts << meaning if meaning.present?
    end

    parts << FRAMING_HINT
    parts << NO_TEXT_HINT
    parts.join(", ")
  end
end
