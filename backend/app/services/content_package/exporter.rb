# frozen_string_literal: true

module ContentPackage
  # 箱ひとつと、それに添えるキャンバスを、持ち運べる形にする。
  #
  #   ContentPackage::Exporter.call(box: box, views: [view])
  #
  # 公式工房の「公開する」も rake も、最後はここを呼ぶ。
  #
  # ## 黙って落とさない
  #
  # 欠けていたら止める。警告にしない。
  # **静かに欠けたものは、配ってから気づくことになる。**
  # 直すのは元のカードなので、配る前に気づけば直せる。
  class Exporter
    include Payload

    # 荷物の中でだけ通じる鍵。**題では繋がない**（同名・改題で壊れるため）
    LOCAL_KEY_PREFIX = "item"

    def self.call(box:, views: [])
      new(box: box, views: views).call
    end

    def initialize(box:, views: [])
      @box = box
      @views = Array(views)
      # カードの id → 荷物の中の鍵
      @local_keys = {}
    end

    def call
      entries = ordered_entries
      raise Payload::ExportError, "箱「#{@box.name}」にカードが1枚もありません" if entries.empty?

      entries.each_with_index { |entry, i| @local_keys[entry.entry_id] = "#{LOCAL_KEY_PREFIX}_#{i + 1}" }

      {
        "schema" => Payload::SCHEMA_VERSION,
        "box" => box_payload(entries),
        "items" => entries.map { |entry| item_payload(entry.entry) },
        "views" => @views.map { |view| view_payload(view) }
      }
    end

    private

    # 箱に入っているカードを、並び順のまま。
    # **カード以外（箱の中の箱など）は運ばない。** 公式コンテンツは平らな1段にする
    def ordered_entries
      @box.box_entries.where(entry_type: "Item").order(:position, :created_at).includes(
        entry: [ :item_type, :tags, :meanings, { medias: { file_attachment: :blob } },
                 { item_properties: { property_definition: :item_type } } ]
      ).to_a
    end

    def box_payload(entries)
      {
        "name" => @box.name,
        "description" => @box.description,
        "entries" => entries.map.with_index do |entry, i|
          { "local_key" => @local_keys.fetch(entry.entry_id), "position" => entry.position || (i + 1) }
        end
      }
    end

    def item_payload(item)
      raise Payload::ExportError, "カードが見つかりません（箱の中身が壊れています）" if item.nil?

      {
        "local_key" => @local_keys.fetch(item.id),
        "title" => item.title,
        "item_type" => item_type_name(item),
        "image_key" => image_key(item),
        "tags" => item.tags.map(&:name).sort,
        "meanings" => meanings_payload(item),
        "properties" => properties_payload(item)
      }
    end

    def item_type_name(item)
      name = item.item_type&.name
      raise Payload::ExportError, "「#{item.title}」に種別がありません" if name.blank?

      name
    end

    # 絵は blob の鍵で運ぶ。**実体があることまで確かめる**
    # （鍵だけあって中身が無いと、配った先で全部空になる）
    def image_key(item)
      media = item.primary_media
      raise Payload::ExportError, "「#{item.title}」に絵がありません" if media.nil? || !media.file.attached?

      blob = media.file.blob
      raise Payload::ExportError, "「#{item.title}」の絵の実体がありません" if blob.nil?

      blob.key
    end

    # 意味は1枚に複数ぶら下がる。**1つだけにすると落ちる**ので配列で運ぶ
    def meanings_payload(item)
      meanings = item.meanings.sort_by { |m| [ m.position || Float::INFINITY, m.created_at ] }
      if meanings.empty?
        raise Payload::ExportError, "「#{item.title}」に意味がありません（公式コンテンツには必須）"
      end

      meanings.map.with_index do |m, i|
        {
          "definition" => m.definition,
          "example_sentence" => m.example_sentence,
          "kind" => m.kind,
          "detail_level" => m.detail_level,
          "language_code" => m.language_code,
          "position" => m.position || i
        }.compact
      end
    end

    # 項目の値。**公式らしさはここに出る**（読み仮名・生没年・所在地など）。
    # 定義は利用者ごとに持っているので、定義そのものも一緒に運ぶ
    def properties_payload(item)
      item.item_properties.filter_map do |prop|
        definition = prop.property_definition
        next if definition.nil?

        {
          "key" => definition.key,
          "label" => definition.label,
          "value_type" => definition.value_type,
          "category" => definition.category,
          "position" => definition.position,
          "item_type" => definition.item_type&.name,
          "value" => prop.value
        }.compact
      end
    end

    def view_payload(view)
      placements = view.view_items.order(:position, :created_at).to_a

      # スペースに結びついたキャンバスは、宮殿ごと運ばないと意味を成さない。
      # v1 では扱わない（黙って半端に運ぶより、はっきり断る）
      if view.space_id.present? || placements.any? { |p| p.space_point_id.present? }
        raise Payload::ExportError, "キャンバス「#{view.name}」は宮殿に結びついています（まだ書き出せません）"
      end

      {
        "name" => view.name,
        "view_type" => view.view_type,
        "settings" => view.settings,
        "placements" => placements.map { |p| placement_payload(view, p) },
        "edges" => view.view_edges.order(:z_index, :created_at).map { |e| edge_payload(view, e) }
      }.compact
    end

    def placement_payload(view, placement)
      key = @local_keys[placement.item_id]
      if key.nil?
        raise Payload::ExportError,
              "キャンバス「#{view.name}」に、箱へ入っていないカードが置かれています（先に箱へ入れてください）"
      end

      {
        "local_key" => key,
        "x" => placement.x, "y" => placement.y,
        "width" => placement.width, "height" => placement.height,
        "z_index" => placement.z_index, "position" => placement.position
      }.compact
    end

    # 線は節の id（＝カードの id）を文字列で持っている。ここで荷物の鍵へ置き換える
    def edge_payload(view, edge)
      source = @local_keys[edge.source_node_id]
      target = @local_keys[edge.target_node_id]
      if source.nil? || target.nil?
        raise Payload::ExportError,
              "キャンバス「#{view.name}」の線が、箱の外のカードを指しています"
      end

      {
        "source" => source, "target" => target,
        "source_handle" => edge.source_handle, "target_handle" => edge.target_handle,
        "label" => edge.label, "style" => edge.style, "points" => edge.points,
        "z_index" => edge.z_index
      }.compact
    end
  end
end
