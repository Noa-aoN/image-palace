# frozen_string_literal: true

module Views
  module Layout
    # 同じ関係の線を、**1本の幹にまとめる**。
    #
    # ## いつまとめるか
    #
    # 次の4つが揃ったときだけ。
    #
    #   1. **同じ種類の関係**（親子と所属を1本にまとめない）
    #   2. **出どころか行き先が同じ**（扇の要が1つ）
    #   3. **2本以上ある**（1本を幹にしても、線が1本のまま）
    #   4. **束ねてよい関係**（同一視・対比は束ねない）
    #
    # 4がいちばん間違えやすい。「AとBは同じもの」「AとBを見比べる」は、
    # **何と何なのかが読めることが意味**なので、束ねると意味が消える。
    #
    # ## 3つの形
    #
    #     夫婦        ┌父┐═┌母┐        扇（出）  ┌親┐        扇（入）┌A┐ ┌B┐ ┌C┐
    #                  └─┬─┘                     └┬─┘                 └┬┘ └┬┘ └┬┘
    #                ┌───┴───┐               ┌───┴───┐              └──┬─┴──┘
    #                ↓       ↓               ↓       ↓                  ↓
    #              ┌子1┐   ┌子2┐          ┌子1┐   ┌子2┐              ┌神殿┐
    #
    # **幹（縦の1本）が要るのは夫婦だけ。** ひとり親や扇（入）は、
    # 要そのものが1つなので、渡し（横の1本）から直接降ろせばよい。
    # 幹を足すと、曲がりが2つ増えるだけで何も読みやすくならない。
    #
    # ## junction は意味を持たない
    #
    # 分かれ目に置く点は**配置の補助**であって、関係の端ではない。
    # 線は「父→子」「母→子」のまま残す。組み替えると、
    # どちらの親から見た関係かが図から消える。
    class Bus
      # カードの縁から、渡しが始まるまでの隔たり
      TRUNK_DROP = Router::STUB
      # 要どうしがこれ以上離れていたら、まとめない（横棒が長くなりすぎる）
      MAX_ANCHOR_GAP = Metrics::CARD_WIDTH * 6

      # 束ねる線の最少の本数。1本を幹にしても、線が1本のまま
      MIN_EDGES = 2

      # @param kind [:couple, :fan_out, :fan_in]
      # @param anchors [Array<Box>] 要（夫婦なら2枚、それ以外は1枚）
      # @param members [Hash<String, Box>] 束ねる相手
      Group = Struct.new(:kind, :type, :anchors, :members, :trunk_x, :bus_y, keyword_init: true) do
        # 幹（縦の1本）が要るのは夫婦だけ
        def trunk? = kind == :couple
        def fan_in? = kind == :fan_in
        def anchor_ids = anchors.map(&:id)
      end

      def initialize(boxes:, relations:)
        @by_id = boxes
        @relations = relations
      end

      def groups
        @groups ||= detect.filter_map { |candidate| with_geometry(candidate) }
      end

      # 互換のための呼び名。既存の呼び出しはこちらを使っている
      alias couples groups

      # この線は、どの幹を通るか（通らないなら nil）
      def group_for(relation)
        groups.find { |group| belongs?(group, relation) }
      end
      alias couple_for group_for

      # 幹を通る道すじ
      def route(group, relation, source_port: 0)
        group.fan_in? ? route_in(group, relation, source_port) : route_out(group, relation, source_port)
      end

      private

      def belongs?(group, relation)
        return false unless group.type == relation[:type].to_s

        if group.fan_in?
          group.members.key?(relation[:from]) && group.anchor_ids.include?(relation[:to])
        else
          group.anchor_ids.include?(relation[:from]) && group.members.key?(relation[:to])
        end
      end

      # ---- どれを束ねるか ----------------------------------------------------

      def detect
        claimed = Set.new
        couples(claimed) + fans(claimed, :fan_out) + fans(claimed, :fan_in)
      end

      # 夫婦。**同列で結ばれた2枚が、同じ種類の子を共に持つ**
      def couples(claimed)
        @relations.select { |relation| Relation.couple?(relation[:type]) }.filter_map do |pair|
          a = @by_id[pair[:from]]
          b = @by_id[pair[:to]]
          next if a.nil? || b.nil?

          by_type(a.id).filter_map { |type, from_a|
            next unless Relation.bundleable?(type)

            shared = from_a & by_type(b.id).fetch(type, [])
            next if shared.size < MIN_EDGES

            shared.each { |child| claimed << [ type, a.id, child ] << [ type, b.id, child ] }
            { kind: :couple, type: type, anchors: [ a, b ], members: shared }
          }.first
        end.compact
      end

      # 扇。**1枚から複数へ（出）／複数から1枚へ（入）**
      def fans(claimed, kind)
        edges_by_anchor(kind).filter_map do |(anchor_id, type), others|
          anchor = @by_id[anchor_id]
          next if anchor.nil? || !Relation.bundleable?(type)

          members = others.reject { |other| claimed.include?(claim_key(kind, type, anchor_id, other)) }
          next if members.size < MIN_EDGES

          members.each { |other| claimed << claim_key(kind, type, anchor_id, other) }
          { kind: kind, type: type, anchors: [ anchor ], members: members }
        end
      end

      def claim_key(kind, type, anchor_id, other)
        kind == :fan_in ? [ type, other, anchor_id ] : [ type, anchor_id, other ]
      end

      # 種類ごとに、要から見た相手を集める
      def edges_by_anchor(kind)
        hierarchical.group_by { |relation|
          [ kind == :fan_in ? relation[:to] : relation[:from], relation[:type].to_s ]
        }.transform_values { |list|
          list.map { |relation| kind == :fan_in ? relation[:from] : relation[:to] }.uniq
        }
      end

      def by_type(anchor_id)
        @by_anchor_type ||= hierarchical.group_by { |relation| relation[:from] }
                                        .transform_values { |list|
                                          list.group_by { |r| r[:type].to_s }
                                              .transform_values { |rs| rs.map { |r| r[:to] }.uniq }
                                        }
        @by_anchor_type.fetch(anchor_id, {})
      end

      def hierarchical = @hierarchical ||= Relation.hierarchical(@relations)

      # ---- どこに幹と渡しを置くか --------------------------------------------

      def with_geometry(candidate)
        anchors = candidate[:anchors]
        members = candidate[:members].filter_map { |id| @by_id[id] }
        return nil if members.size < MIN_EDGES
        return nil unless anchors_aligned?(anchors)

        placed = geometry_for(candidate[:kind], anchors, members)
        return nil if placed.nil?

        Group.new(
          kind: candidate[:kind], type: candidate[:type], anchors: anchors,
          members: members.to_h { |box| [ box.id, box ] }, **placed
        )
      end

      # 夫婦は同じ段に並んでいて、離れすぎていないこと
      def anchors_aligned?(anchors)
        return true if anchors.size < 2

        a, b = anchors
        (a.center_y - b.center_y).abs < a.height && (a.center_x - b.center_x).abs <= MAX_ANCHOR_GAP
      end

      def geometry_for(kind, anchors, members)
        if kind == :fan_in
          top = members.map(&:bottom).max + TRUNK_DROP
          bottom = anchors.first.top
          return nil unless bottom > top

          { trunk_x: anchors.first.center_x, bus_y: (top + bottom) / 2 }
        else
          drop = anchors.map(&:bottom).max + TRUNK_DROP
          top = members.map(&:top).min
          return nil unless top > drop

          { trunk_x: anchors.sum(&:center_x) / anchors.size, bus_y: (drop + top) / 2 }
        end
      end

      # ---- 道すじ ------------------------------------------------------------

      # 要から相手へ降ろす（夫婦・扇（出））
      def route_out(group, relation, source_port)
        anchor = @by_id[relation[:from]]
        member = group.members[relation[:to]]
        return nil if anchor.nil? || member.nil?

        from_x = anchor.center_x + source_port
        points = if group.trunk?
          # **夫婦だけは幹を立てる。** 二人の中ほどから1本降ろす
          drop = anchor.bottom + TRUNK_DROP
          [ point(from_x, drop), point(group.trunk_x, drop),
            point(group.trunk_x, group.bus_y), point(member.center_x, group.bus_y) ]
        else
          # 要が1つなら、幹は要らない。**渡しへ直接降ろす**
          [ point(from_x, group.bus_y), point(member.center_x, group.bus_y) ]
        end
        Router::Route.new(points: trim(points), source_port: source_port.round, target_port: 0)
      end

      # 相手から要へ集める（扇（入））
      def route_in(group, relation, source_port)
        member = group.members[relation[:from]]
        return nil if member.nil?

        from_x = member.center_x + source_port
        points = [ point(from_x, group.bus_y), point(group.trunk_x, group.bus_y) ]
        Router::Route.new(points: trim(points), source_port: source_port.round, target_port: 0)
      end

      def point(x, y) = { "x" => x.round, "y" => y.round }

      # 同じ場所に重なった点と、まっすぐ続くだけの点を落とす
      def trim(points)
        kept = [ points.first ]
        points[1..].each do |current|
          previous = kept.last
          next if previous["x"] == current["x"] && previous["y"] == current["y"]

          if kept.size >= 2 && straight?(kept[-2], previous, current)
            kept[-1] = current
          else
            kept << current
          end
        end
        kept
      end

      def straight?(a, b, c)
        (a["x"] == b["x"] && b["x"] == c["x"]) || (a["y"] == b["y"] && b["y"] == c["y"])
      end
    end
  end
end
