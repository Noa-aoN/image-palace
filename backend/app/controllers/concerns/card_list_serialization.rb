# frozen_string_literal: true

# カード一覧の札の作り方。
#
# 札は、利用者の設定（何をどの順で出すか・どれを名前にするか）から組み立てる。
# その組み立てが ItemsController の中にあったため、
# **同じ札を出したい他の画面から使えなかった。**
# デッキをカードの並びとして見せるときも、一覧と違う見え方になる。
#
# 設定を1リクエストに1回だけ読むための覚え書き（@card_list_layout など）もここに持つ。
# カードの枚数に比例して問い合わせを増やさないため。
module CardListSerialization
  extend ActiveSupport::Concern

  private

  # 一覧に出す分だけ。詳細と同じ中身を返さない。
  #
  # 一覧が読むのはここにある12項目だけで、残り（項目の定義一式・意味の全件・
  # 画像への指示・ファクトチェックの根拠）は1枚も表示していない。
  # それでも積んでいたので、24枚で33KB を運んでいた。Wikipedia の項目が
  # 増えてからは、抜粋の長さがそのまま一覧の重さになっていた。
  #
  # カードを開いた先は `getItem()` で取り直すので、ここで削っても詳細は欠けない
  def serialize_list_item(item)
    {
      id: item.id,
      title: item.title,
      headline: headline_for(item),
      list_fields: card_list_fields_for(item),
      aspect_ratio: item.aspect_ratio,
      generation_status: item.generation_status,
      generation_error: item.generation_error,
      generation_retryable: item.generation_status != "failed" ||
        ::Images::RetryPolicy.retryable?(item),
      item_type: serialize_item_type(item.item_type),
      meaning: item.primary_meaning&.definition,
      # 一覧では警告色を出すかどうかだけに使う。根拠（claims 等）は詳細で読む
      fact_check_status: item.primary_meaning&.fact_check_status,
      fact_check_comment: item.primary_meaning&.fact_check_comment,
      fact_check_acknowledged_at: item.primary_meaning&.fact_check_acknowledged_at,
      tags: item.tags.map { |t| { id: t.id, name: t.name } },
      media: serialize_media(item.primary_media),
      # 下見で入ったカードには印を付ける（自分のものと混ざらないように）
      from_preview: preview_item?(item),
      created_at: item.created_at
    }
  end

  # 名前として出す項目。**並びの先頭にある、名前になりうる項目**（Setting が決める）。
  # 何も選んでいなければ nil で、そのときは見出し語をそのまま使う
  def headline_key
    return @headline_key if defined?(@headline_key)

    @headline_key = current_user.setting&.headline_key
  end

  # 一覧に出す名前。
  #
  # **選ばれた項目が空でも見出し語へ戻さない。** 戻すと、設定した人には
  # 「効いていない」と映る（実際に効いているのに、値が無いだけ）。
  # 値が無いことは、値が無いと分かる形で見せる（画面が「-」を出す）。
  def headline_for(item)
    return item.title if headline_key.blank?

    # 名前は1つ。複数入る項目（別名など）を選んでいても、つないで長くしない
    property_value_for(item, headline_key, multiple: :first)
  end

  # 一覧の各カードに出す項目。**順序と表示の有無は設定が持つ**。
  #
  # 出す指定の項目は、値が無くても行ごと返す（value: nil）。
  # 返さないと、あるカードには出てあるカードには出ない、という
  # 法則の読めない並びになる。**出さない指定の項目は、そもそも返さない。**
  def card_list_fields_for(item)
    card_list_layout.filter_map do |row|
      key = row["key"].to_s
      next unless row["visible"]
      # 名前と絵は、カードの形そのものとして別に描かれる。
      # 名前として使っている項目も、下にもう一度出さない（同じ値が2つ並ぶ）
      next if key == "title" || key == "image" || key == headline_key
      # 種別の印は見出し語の右に出る。下へ積まない
      next if ::Setting::FIXED_POSITION_LAYOUT_KEYS.include?(key)

      if key == "meaning"
        { key: key, label: "意味・説明", value: meaning_summary_for(item) }
      else
        { key: key, label: property_labels[key] || key, value: property_value_for(item, key) }
      end
    end
  end

  # 一覧の並べ方。**カードごとではなく1回だけ返す**（全カードで同じ設定のため）。
  #
  # 画面は blocks の順にそのまま積む。これを渡していなかったころは、
  # 絵と項目の並びがカード側に固定で書かれていて、
  # **設定で「イメージ」を外しても絵が出続け、項目を並べ替えても順が変わらなかった。**
  def card_list_meta
    blocks = card_list_layout.filter_map do |row|
      key = row["key"].to_s
      next unless row["visible"]
      # 名前はカードの見出しとして別に描く。名前に使っている項目も下に重ねない
      next if key == "title" || key == headline_key
      # 種別の印は見出し語の右に出る。積む並びには入れない
      next if ::Setting::FIXED_POSITION_LAYOUT_KEYS.include?(key)

      key
    end

    { blocks: blocks, image: blocks.include?("image"), type_mark: type_mark_visible? }
  end

  # 種別の印を出すか。
  #
  # **設定に行が無い人には出す。** 印は後から足したもので、
  # 既に並びを保存している人の設定にはその行が無い。
  # 「無い＝出さない」にすると、触ってもいないのに印だけ消える
  def type_mark_visible?
    row = card_list_layout.find { |r| r["key"].to_s == "item_type" }
    row.nil? || row["visible"] == true
  end

  # 設定の行がまだ無い人にも既定の並びを使う。
  # 空で返すと、一度も設定を触っていない人のカードから絵が消える
  def card_list_layout
    @card_list_layout ||=
      (current_user.setting&.card_list_layout_entries || ::Setting::DEFAULT_CARD_LIST_LAYOUT)
  end

  # 項目の呼び名。**カード側からは引かない。**
  # 値の無いカードには項目の行そのものが無く、そこから呼び名を取ると
  # 「値が無いときだけ識別名が出る」というちぐはぐな見え方になる。
  # 1回だけまとめて引く（件数に比例して増やさない）
  def property_labels
    @property_labels ||= PropertyDefinition.where(user: current_user).pluck(:key, :label).to_h
  end

  # 項目の値を文字にする。
  #
  # 複数入る項目の扱いは置き場所で変える。
  #   名前（headline）… 先頭だけ。つなぐと名前として長すぎる
  #   名前の下の項目  … 読点でつなぐ（既存の見せ方）
  def property_value_for(item, key, multiple: :join)
    entry = item.item_properties.find { |p| p.property_definition&.key == key }
    value = entry&.typed_value
    # チェックは true/false をそのまま文字にすると「true」と出る。
    # **触っていない状態と「切」を分けたまま**、読める形に直す
    return (value ? "入" : "切") if entry&.boolean? && !value.nil?
    # 中身が2つある項目（自由テキスト・自由イメージ）は、そのまま文字にすると
    # **`{"heading"=>…}` が一覧に出る**。読める形に組み直す
    return compound_summary(entry, value) if value.is_a?(Hash)

    value = multiple == :first ? value.first : value.join("、") if value.is_a?(Array)
    text = value.to_s.presence
    # Wikipedia は JSON の文字列で入っている。**そのまま出すと鍵と URL が一覧に並ぶ**
    entry&.property_definition&.value_type == "wikipedia" ? wikipedia_summary(text) : text
  end

  # Wikipedia の値から、一覧に出す1行を取り出す。題名が無ければ冒頭で代える
  def wikipedia_summary(raw)
    return raw if raw.blank?

    parsed = JSON.parse(raw)
    return raw unless parsed.is_a?(Hash)

    parsed["wikipedia_title"].presence || parsed["wikipedia_extract"].to_s.presence
  rescue JSON::ParserError
    raw
  end

  # 見出しと中身を持つ項目を、一覧の1行にする。
  # 自由イメージは絵そのものを文字にできないので、付けた見出し（無ければ指示）で表す
  def compound_summary(entry, value)
    heading = value["heading"].to_s.strip.presence
    body = (entry&.free_image? ? value["prompt"] : value["body"]).to_s.strip.presence
    return body if heading.nil?
    return heading if body.nil? || entry&.free_image?

    "#{heading}：#{body}"
  end

  # 意味・説明は一覧を圧迫するので、先頭のものだけを短く出す（画面側で3行に丸める）
  def meaning_summary_for(item)
    item.meanings.min_by(&:position)&.definition.presence
  end

  def serialize_item_type(item_type)
    return nil unless item_type

    { id: item_type.id, name: item_type.name, label: item_type.label }
  end
end
