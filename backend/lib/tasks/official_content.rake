# frozen_string_literal: true

# 公式宮殿の中身を用意する。
#
# **一度きりの引っ越し**のための道具。日常的に使うものではない。
# 個人の口座にあるカードを、公式の口座へ写す。
#
#   bin/rails official:plan          # 何をするか、実行せずに出す
#   bin/rails official:migrate       # 実際に写す
#   bin/rails official:status        # いまの公式宮殿の様子
#
# ## 配る仕組みとは別
#
# `content:publish` は「公式宮殿の中身を、荷物として出す」もの。
# こちらは「公式宮殿そのものを組み立てる」もので、通る道が違う。
#
# ## 元のカードには触れない
#
# 絵は blob を共有するので、写しても保存領域は増えない。
# 元の口座のカードは1枚も減らないし、変わらない。
namespace :official do
  # 何を、どの箱に入れるか。**ここが公式コンテンツの設計図**。
  #
  # 題は本番に実在するものだけ。無いものを書くと `plan` が教えてくれる。
  PLAN = {
    "ネットワークの通り道" => {
      summary: "通信が届くまでに、どこを通るのか",
      titles: %w[
        ルーター スイッチ ファイアウォール ゲートウェイ
        DNS IPアドレス サブネット パケット
        プロトコル サーバー クライアント 帯域幅
      ]
    },
    "ギリシャ神話の人びと" => {
      summary: "神々の顔ぶれを、絵で覚える",
      titles: [
        "ゼウス", "ヘラ", "ポセイドン", "デメテル", "アテナ", "アポロン",
        "トリトン", "ディオスクーロイ", "パエトーン（古希: Φαέθων, Phaëthōn）", "リュカーオーン"
      ]
    },
    "ことばの標本箱" => {
      summary: "絵にすると、急に分かることば",
      titles: [
        "メタ認知", "アファンタジア", "エピステモロジー", "創造的破壊", "ゴルディアスの結び目",
        "カイロス", "運命愛", "画龍点睛", "エピファニー", "外部不経済",
        "経済地理学", "オフグリッド"
      ]
    },
    "光のことば" => {
      summary: "一日の光の移ろいに、名前がある",
      titles: %w[暁闇 薄明 残照 夜明け]
    },
    "ITのことば" => {
      summary: "言葉だけでは掴みにくい、技術のことば",
      titles: [
        "JSONB", "Redis", "CSP（Content Security Policy）", "TOTP", "IDOR",
        "Webhook", "blob", "ペイロード（Payload）", "シリアライザ", "キーバインド"
      ]
    },
    "歴史のことば" => {
      summary: "出来事は、場面として覚える",
      titles: [
        "ミケーネ文明", "クレタ文明（ミノア文明）", "オットー・フォン・ビスマルク", "クレオパトラ",
        "白村江の戦い", "トンキン湾事件", "フン族", "上洛", "函谷関", "御土居（おどい）"
      ]
    },
    "英単語の標本" => {
      summary: "絵にすると忘れない、英単語",
      titles: %w[dormant Flotsam immersive stampede herd apex stash fatal]
    },
    "齧歯類の分類" => {
      summary: "分類の樹を、そのまま並べる",
      titles: %w[齧歯目 ネズミ亜目 リス亜目 ヤマアラシ亜目 ビーバー亜目 ウロコオリス亜目 ウッドチャック ネズミ]
    }
  }.freeze

  # 意味が無いカードのぶん。**公式コンテンツなので、運営が書く。**
  # AI に書かせてもよいが、こちらのほうが正確で、費用もかからない
  MEANINGS = {
    "ゼウス" => "オリュンポスの主神。天空と雷を司り、神々と人間の王として君臨する。",
    "ヘラ" => "ゼウスの妻であり姉。結婚と家庭を守る女神で、婚姻の誓いをつかさどる。",
    "ポセイドン" => "海と地震を司る神。ゼウスの兄で、三叉の矛（トリアイナ）を持つ。",
    "アテナ" => "知恵と戦略、工芸を司る女神。ゼウスの頭から武装して生まれたとされる。",
    "夜明け" => "夜が明けて空が明るくなる時刻。日の出の前後、闇から光へ移り変わるひととき。"
  }.freeze

  desc "何をするか、実行せずに出す"
  task plan: :environment do
    source = source_user!
    target = official_user!

    puts "写す元: #{source.email}（カード #{source.items.count} 枚）"
    puts "写す先: #{target.email}（カード #{target.items.count} 枚）"
    puts

    total = 0
    missing = []
    PLAN.each do |box_name, spec|
      found = source.items.where(title: spec[:titles]).includes(:meanings, :medias).to_a
      lacking = spec[:titles] - found.map(&:title)
      no_meaning = found.reject { |i| i.meanings.any? || MEANINGS.key?(i.title) }.map(&:title)
      no_image = found.reject { |i| i.primary_media&.file&.attached? }.map(&:title)

      total += found.size
      puts format("%-22s %2d/%2d 枚", box_name, found.size, spec[:titles].size)
      puts "  **見つからない**: #{lacking.join(', ')}" if lacking.any?
      puts "  **意味が無い**  : #{no_meaning.join(', ')}" if no_meaning.any?
      puts "  **絵が無い**    : #{no_image.join(', ')}" if no_image.any?
      missing.concat(lacking)
    end

    puts
    puts "合計 #{total} 枚 / #{PLAN.size} 箱"
    puts "**題が見つからないものが #{missing.size} 件ある。設計図を直すこと**" if missing.any?
  end

  desc "選んだカードを公式の口座へ写す"
  task migrate: :environment do
    source = source_user!
    target = official_user!

    created = 0
    reused = 0
    PLAN.each do |box_name, spec|
      box = target.boxes.find_by(name: box_name) || target.boxes.create!(name: box_name, description: spec[:summary])

      spec[:titles].each_with_index do |title, index|
        origin = source.items.find_by(title: title)
        unless origin
          puts "  見つからない: #{title}"
          next
        end

        copy = target.items.find_by(title: title)
        if copy
          reused += 1
        else
          copy = copy_item!(origin, target)
          created += 1
        end

        unless box.box_entries.exists?(entry: copy)
          box.box_entries.create!(entry: copy, position: index + 1)
        end
      end
      puts format("%-22s %d 枚", box_name, box.box_entries.count)
    end

    puts
    puts "新しく作った: #{created} 枚 / すでにあった: #{reused} 枚"
    puts "公式の口座: カード #{target.items.count} / 箱 #{target.boxes.count}"
  end

  desc "いまの公式宮殿の様子"
  task status: :environment do
    target = official_user!
    puts "#{target.email}（#{target.effective_role}）"
    puts "  カード     : #{target.items.count} 枚"
    puts "  箱         : #{target.boxes.count}"
    puts "  キャンバス : #{target.views.count}"
    puts "  宮殿       : #{target.spaces.count}"
    puts
    target.boxes.order(:created_at).each do |box|
      puts format("  %-22s %2d 枚", box.name, box.box_entries.count)
    end
    puts
    target.views.order(:created_at).each do |view|
      puts format("  キャンバス %-16s カード %2d / 線 %2d", view.name, view.view_items.count, view.view_edges.count)
    end
  end

  # ── 中身 ──────────────────────────────────────────────

  # **絵は blob を共有する。** 写しても保存領域は増えない
  def copy_item!(origin, target)
    copy = target.items.create!(
      title: origin.title,
      item_type: origin.item_type,
      generation_status: "completed"
    )

    media = origin.primary_media
    if media&.file&.attached?
      copy.medias.create!(media_type: "image", position: 0, needs_approval: false)
          .file.attach(media.file.blob)
    end

    origin.meanings.order(:position).each_with_index do |m, i|
      copy.meanings.create!(
        definition: m.definition, example_sentence: m.example_sentence,
        kind: m.kind, detail_level: m.detail_level,
        language_code: m.language_code, position: m.position || i
      )
    end
    # 意味が無いものは、運営が書いたものを入れる
    if copy.meanings.empty? && MEANINGS.key?(origin.title)
      copy.meanings.create!(definition: MEANINGS.fetch(origin.title), language_code: "ja", position: 0)
    end

    origin.tags.each do |tag|
      existing = target.tags.where("LOWER(name) = ?", tag.name.downcase).first
      copy.tags << (existing || target.tags.create!(name: tag.name))
    end

    origin.item_properties.includes(:property_definition).each do |prop|
      definition = prop.property_definition
      next if definition.nil?

      target_definition =
        target.property_definitions.find_by(key: definition.key, item_type_id: definition.item_type_id) ||
        target.property_definitions.create!(
          key: definition.key, label: definition.label, value_type: definition.value_type,
          category: definition.category, position: definition.position, item_type_id: definition.item_type_id
        )
      copy.item_properties.create!(property_definition: target_definition, value: prop.value)
    end

    copy
  end

  def official_user!
    User.official_content_account or
      abort "OFFICIAL_CONTENT_USER_ID が指す口座がありません"
  end

  # 写す元。ENV の運営アドレス経由で権限を持っている人
  def source_user!
    email = ENV["SOURCE_EMAIL"].presence
    return User.find_by(email: email) || abort("SOURCE_EMAIL の口座がありません") if email

    User.all.find(&:bootstrap_admin?) or abort "SOURCE_EMAIL= で写す元を指定してください"
  end
end
