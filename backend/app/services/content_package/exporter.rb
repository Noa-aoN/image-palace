# frozen_string_literal: true

module ContentPackage
  # 箱とキャンバスを、持ち運べる形にする。
  #
  #   ContentPackage::Exporter.call(boxes: [box], views: [view])
  #   ContentPackage::Exporter.call(views: [view])          # キャンバスだけでもよい
  #   ContentPackage::Exporter.call(boxes: [box])           # 箱だけでもよい
  #
  # 公式工房の「公開する」も rake も、最後はここを呼ぶ。
  #
  # ## 足りないものは、こちらで引き込む
  #
  # キャンバスに置かれているカードが、選んだ箱に入っていないことはある。
  # そのときは**そのカードも荷物に入れる**。
  #
  # 受け取った人のキャンバスに、中身の無い枠が並ぶことがあってはならない。
  # 「神々の系図」を受け取ったら、神々のカードも一緒に来る。
  #
  # ## 黙って落とさない
  #
  # 欠けていたら止める。警告にしない。
  # **静かに欠けたものは、配ってから気づくことになる。**
  # 直すのは元のカードなので、配る前に気づけば直せる。
  class Exporter
    # 荷物の中でだけ通じる鍵。**題では繋がない**（同名・改題で壊れるため）
    LOCAL_KEY_PREFIX = "item"

    def self.call(boxes: [], views: [])
      new(boxes: boxes, views: views).call
    end

    def initialize(boxes: [], views: [])
      @boxes = Array(boxes)
      @views = Array(views)
      # カードの id → 荷物の中の鍵
      @local_keys = {}
    end

    def call
      if @boxes.empty? && @views.empty?
        raise Payload::ExportError, "箱もキャンバスも選ばれていません"
      end

      items = collect_items!
      items.each_with_index { |item, i| @local_keys[item.id] = "#{LOCAL_KEY_PREFIX}_#{i + 1}" }

      {
        "schema" => Payload::SCHEMA_VERSION,
        "boxes" => @boxes.map { |box| box_payload(box) },
        "items" => items.map { |item| item_payload(item) },
        "views" => @views.map { |view| view_payload(view) }
      }
    end

    private

    # 荷物に入れるカードを、決まった順で集める。
    #
    # **順番を決めておかないと、往復のたびに並びが変わる。**
    # 箱の中身が先（箱の並び順どおり）、そのあとキャンバスにしか無いカード。
    def collect_items!
      items = []
      seen = Set.new

      @boxes.each do |box|
        box_entries(box).each do |entry|
          item = entry.entry
          raise Payload::ExportError, "箱「#{box.name}」の中身が壊れています" if item.nil?

          items << item if seen.add?(item.id)
        end
      end

      @views.each do |view|
        view_placements(view).each do |placement|
          item = placement.item
          raise Payload::ExportError, "キャンバス「#{view.name}」の中身が壊れています" if item.nil?

          items << item if seen.add?(item.id)
        end
      end

      raise Payload::ExportError, "カードが1枚もありません" if items.empty?

      items
    end

    def box_entries(box)
      @box_entries ||= {}
      @box_entries[box.id] ||= box.box_entries.where(entry_type: "Item").order(:position, :created_at).includes(
        entry: item_includes
      ).to_a
    end

    def view_placements(view)
      @view_placements ||= {}
      @view_placements[view.id] ||= view.view_items.order(:position, :created_at)
                                       .includes(item: item_includes).to_a
    end

    def item_includes
      [ :item_type, :tags, :meanings, { medias: { file_attachment: :blob } },
        { item_properties: { property_definition: :item_type } } ]
    end

    def box_payload(box)
      {
        "name" => box.name,
        "description" => box.description,
        "entries" => box_entries(box).map.with_index do |entry, i|
          { "local_key" => @local_keys.fetch(entry.entry_id), "position" => entry.position || (i + 1) }
        end
      }
    end

    def item_payload(item)
      {
        "local_key" => @local_keys.fetch(item.id),
        # **荷物をまたいで変わらない目印。** 元のカードの id をそのまま使う。
        #
        # `local_key` は荷物の中の席次でしかなく、別の荷物では別の席になる。
        # 同じカードが2つの荷物に入っているとき、それが同じものだと分かるのは
        # こちらだけ。受け取る側は、これで持っているかどうかを確かめる。
        #
        # 手で付ける名前（`concept_dns` のような）にはしない。
        # 付け忘れ・打ち間違い・重複を人が防ぐことになるうえ、
        # 元のカードの id なら**放っておいても一意で、題を直しても変わらない**
        "origin_key" => item.id,
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
      placements = view_placements(view)

      # 宮殿に結びついたキャンバスは、宮殿の点そのものを運ばないと成り立たない。
      # **今は、はっきり断る。** 半端に運ぶと、点の無い配置だけが残る
      if view.space_id.present? || placements.any? { |p| p.space_point_id.present? }
        raise Payload::ExportError,
              "キャンバス「#{view.name}」は宮殿に結びついています（宮殿ごと配る仕組みはまだありません）"
      end

      {
        "name" => view.name,
        "view_type" => view.view_type,
        "settings" => view.settings,
        "placements" => placements.map { |p| placement_payload(p) },
        "edges" => view.view_edges.order(:z_index, :created_at)
                       .filter_map { |e| edge_payload(e, placements.map(&:item_id).to_set) }
      }.compact
    end

    def placement_payload(placement)
      {
        "local_key" => @local_keys.fetch(placement.item_id),
        "x" => placement.x, "y" => placement.y,
        "width" => placement.width, "height" => placement.height,
        "z_index" => placement.z_index, "position" => placement.position
      }.compact
    end

    # 線は節の id（＝カードの id）を文字列で持っている。ここで荷物の鍵へ置き換える。
    #
    # **そのキャンバスに置かれているカード同士の線だけを運ぶ。**
    # 画面から外したのに線の行だけ残る、ということは起こりうる。
    # 運んだ先で行き先の無い線になるより、ここで落とすほうがよい
    def edge_payload(edge, placed_item_ids)
      return nil unless placed_item_ids.include?(edge.source_node_id)
      return nil unless placed_item_ids.include?(edge.target_node_id)

      source = @local_keys[edge.source_node_id]
      target = @local_keys[edge.target_node_id]
      return nil if source.nil? || target.nil?

      {
        "source" => source, "target" => target,
        "source_handle" => edge.source_handle, "target_handle" => edge.target_handle,
        "label" => edge.label, "style" => edge.style, "points" => edge.points,
        "z_index" => edge.z_index
      }.compact
    end
  end
end
