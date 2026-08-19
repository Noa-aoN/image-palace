# frozen_string_literal: true

module ContentPackages
  # 持ち運べる形を、その人の宮殿へ入れる。
  #
  #   ContentPackages::Importer.call(user: user, payload: payload)
  #   ContentPackages::Importer.call(user: user, payload: payload, owned: { origin_key => item })
  #
  # デモの宮殿づくりも、Starter の受け取りも、デルフォイの「受け取る」も、
  # 最後はここを呼ぶ。**入れる相手が違うだけで、やることは同じ。**
  #
  # ## 絵は作り直さない
  #
  # `image_key` から blob を引いて、**同じ実体を付け替える**。
  # 何人に配っても保存領域は増えず、生成 API も1回も呼ばない。
  #
  # ## 同じカードは、2枚にしない
  #
  # 2つ目の荷物が、1つ目にも入っていたカードを必要とすることがある。
  # （「ネットワーク」と「IT一般」の両方に DNS が入っている、など）
  #
  # そのときは**すでに持っているカードを使い回す**。箱もキャンバスも、
  # そのカードを指すだけ。1枚の DNS を2つのキャンバスが参照する形になる。
  #
  # 判定は `origin_key`（元のカードの id）で行う。**題では見ない。**
  # 題は重複するし、利用者が変えるし、表記も揺れる。
  # 使い回す相手は**公式の荷物から来たカードだけ**で、
  # 利用者が自分で作った同名のカードには手を触れない
  # （`owned` に何を渡すかは、由来を記録している側が決める）。
  #
  # ## 全部入るか、1つも入らないか
  #
  # 途中で失敗したら、そこまで作ったものごと戻す。
  # **半分だけ入った宮殿**を残さない。
  class Importer
    # 作ったものを返す。`items_by_local_key` は**由来を記録する側**が使う
    # （どの定義から生まれた実体か、荷物の鍵で辿れるようにするため）
    Result = Struct.new(:boxes, :views, :items, :created_items, :reused_items,
                        :items_by_local_key, :origin_keys, keyword_init: true) do
      # 由来として残す実体を、種類を問わず1列に並べる
      def records
        Array(boxes) + Array(views) + Array(items)
      end
    end

    def self.call(user:, payload:, owned: {})
      new(user: user, payload: payload, owned: owned).call
    end

    # @param owned [Hash] origin_key → その人が既に持っているカード。
    #   公式の荷物から来たものだけを渡すこと
    def initialize(user:, payload:, owned: {})
      @user = user
      @payload = payload.deep_stringify_keys
      @owned = owned.transform_keys(&:to_s)
      # 荷物の鍵 → カード（作ったものと、使い回したものの両方）
      @items = {}
      @origin_keys = {}
      @created = []
      @reused = []
    end

    def call
      Payload.validate!(@payload)

      ActiveRecord::Base.transaction do
        create_items!
        boxes = Array(@payload["boxes"]).map { |box| create_box!(box) }
        views = Array(@payload["views"]).map { |view| create_view!(view) }
        Result.new(boxes: boxes, views: views, items: @items.values,
                   created_items: @created, reused_items: @reused,
                   items_by_local_key: @items.dup, origin_keys: @origin_keys.dup)
      end
    end

    private

    def create_items!
      @payload["items"].each do |attrs|
        @origin_keys[attrs["local_key"]] = attrs["origin_key"]

        existing = @owned[attrs["origin_key"].to_s]
        if existing
          @items[attrs["local_key"]] = existing
          @reused << existing
          next
        end

        item = @user.items.create!(
          title: attrs["title"],
          item_type: item_type!(attrs),
          # 配る絵は既に出来上がっているので、生成の行列には並ばせない
          generation_status: "completed"
        )
        attach_image!(item, attrs["image_key"])
        create_meanings!(item, attrs["meanings"])
        assign_tags!(item, attrs["tags"])
        create_properties!(item, attrs["properties"])

        @items[attrs["local_key"]] = item
        @created << item
      end
    end

    def item_type!(attrs)
      name = attrs["item_type"]
      ItemType.find_by(name: name) ||
        raise(Payload::ImportError, "種別 #{name.inspect} がこの環境にありません（「#{attrs['title']}」）")
    end

    # **同じ blob を付け替える。** 複製しない
    def attach_image!(item, key)
      blob = ActiveStorage::Blob.find_by(key: key)
      raise Payload::ImportError, "「#{item.title}」の絵が見つかりません（key=#{key}）" if blob.nil?

      media = item.medias.create!(media_type: "image", position: 0, needs_approval: false)
      media.file.attach(blob)
    end

    def create_meanings!(item, meanings)
      Array(meanings).each_with_index do |m, i|
        item.meanings.create!(
          definition: m["definition"],
          example_sentence: m["example_sentence"],
          kind: m["kind"],
          detail_level: m["detail_level"],
          language_code: m["language_code"],
          position: m["position"] || i
        )
      end
    end

    # タグは利用者ごとの行。**同じ名前のものがあれば、それを使う**
    def assign_tags!(item, names)
      Array(names).reject(&:blank?).each do |name|
        tag = @user.tags.where("LOWER(name) = ?", name.to_s.downcase).first ||
              @user.tags.create!(name: name)
        item.tags << tag unless item.tags.include?(tag)
      end
    end

    # 項目の定義も利用者ごと。**無ければ作る**。
    # ここを飛ばすと、値だけあって見出しの無いカードができる
    def create_properties!(item, properties)
      Array(properties).each do |prop|
        definition = property_definition!(prop, item)
        item.item_properties.create!(property_definition: definition, value: prop["value"])
      end
    end

    def property_definition!(prop, item)
      item_type = prop["item_type"].present? ? ItemType.find_by(name: prop["item_type"]) : item.item_type
      item_type ||= item.item_type

      existing = @user.property_definitions.find_by(key: prop["key"], item_type_id: item_type.id)
      return existing if existing

      @user.property_definitions.create!(
        key: prop["key"],
        label: prop["label"],
        value_type: prop["value_type"],
        category: prop["category"],
        position: prop["position"],
        item_type: item_type
      )
    end

    def create_box!(attrs)
      box = @user.boxes.create!(name: attrs["name"], description: attrs["description"])
      Array(attrs["entries"]).each_with_index do |entry, i|
        box.box_entries.create!(
          entry: item!(entry["local_key"]),
          position: entry["position"] || (i + 1)
        )
      end
      box
    end

    def create_view!(attrs)
      view = @user.views.create!(
        name: attrs["name"],
        view_type: attrs["view_type"],
        settings: attrs["settings"] || {}
      )

      Array(attrs["placements"]).each_with_index do |placement, i|
        view.view_items.create!(
          item: item!(placement["local_key"]),
          x: placement["x"], y: placement["y"],
          width: placement["width"], height: placement["height"],
          z_index: placement["z_index"], position: placement["position"] || i
        )
      end

      # 線は節の id（＝新しいカードの id）へ引き直す。
      # **ここを飛ばすと、どこにも繋がらない線ができる**
      Array(attrs["edges"]).each do |edge|
        view.view_edges.create!(
          source_node_id: item!(edge["source"]).id,
          target_node_id: item!(edge["target"]).id,
          source_handle: edge["source_handle"], target_handle: edge["target_handle"],
          label: edge["label"], style: edge["style"] || {}, points: edge["points"] || [],
          z_index: edge["z_index"]
        )
      end

      view
    end

    def item!(local_key)
      @items[local_key] || raise(Payload::ImportError, "荷物の中に #{local_key.inspect} がありません")
    end
  end
end
