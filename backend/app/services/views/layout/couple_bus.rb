# frozen_string_literal: true

module Views
  module Layout
    # 夫婦から子への線を、**1本の幹**にまとめる。
    #
    # ## なぜ要るのか
    #
    # 家系図の作法では、両親を左右に並べ、二人を結ぶ線の中ほどから
    # 子へ降ろす。**どの子が「二人の子」なのかが、線の形だけで読める**からだ。
    #
    # そうしないと、父から子へ・母から子へと2本ずつ線が出る。子が3人なら6本になり、
    # そのどれもが兄弟の並びを横切る。線が混むだけでなく、
    # 「父の子」と「二人の子」の区別も付かない。
    #
    # ## どう引くか
    #
    #     ┌─父─┐        ┌─母─┐
    #     └─┬──┘        └──┬─┘
    #       └────┬───────┘     ← 幹（二人の中ほど）
    #       ┌────┴────┐         ← 渡し（子の段の上）
    #       ↓         ↓
    #     ┌子1┐     ┌子2┐
    #
    # 線そのものは「父→子」「母→子」のまま**2本ある**（どちらの親から見た関係かは
    # 意味として残す）。だが幹より下は同じ道を通るので、目には1本に見える。
    # 見出し（「息子」「母」）は道に沿って前後へずらされるので、両方とも読める。
    #
    # ## いつ使わないか
    #
    # 子が親より上にある・親どうしが離れすぎている、といったときは使わない。
    # **無理に幹を通すと、かえって遠回りな線になる**。そのときは普通に引く。
    class CoupleBus
      # 親の下辺から、幹が始まるまでの隔たり
      TRUNK_DROP = Router::STUB
      # 親どうしがこれ以上離れていたら、幹にまとめない（横棒が長くなりすぎる）
      MAX_PARTNER_GAP = Metrics::CARD_WIDTH * 6

      Couple = Struct.new(:a, :b, :children, :trunk_x, :bus_y, keyword_init: true)

      # @param boxes [Hash<String, Box>]
      # @param relations [Array<Hash>] { from:, to:, type: }
      def initialize(boxes:, relations:)
        @by_id = boxes
        @relations = relations
      end

      # 幹にまとめられる組。**まとめられないものは返さない**
      def couples
        @couples ||= detect.filter_map { |couple| with_geometry(couple) }
      end

      # この線は、どの組の幹を通るか（通らないなら nil）
      def couple_for(relation)
        return nil unless hierarchical?(relation)

        couples.find do |couple|
          [ couple.a.id, couple.b.id ].include?(relation[:from]) && couple.children.key?(relation[:to])
        end
      end

      # 幹を通る道すじ。親の縁から出て、幹へ寄り、渡しから子へ降りる
      def route(couple, relation, source_port: 0)
        parent = @by_id[relation[:from]]
        child = couple.children[relation[:to]]
        return nil if parent.nil? || child.nil?

        from_x = parent.center_x + source_port
        drop = parent.bottom + TRUNK_DROP
        points = [
          { "x" => from_x.round, "y" => drop.round },
          { "x" => couple.trunk_x.round, "y" => drop.round },
          { "x" => couple.trunk_x.round, "y" => couple.bus_y.round },
          { "x" => child.center_x.round, "y" => couple.bus_y.round }
        ]
        Router::Route.new(points: trim(points), source_port: source_port.round, target_port: 0)
      end

      private

      # 同列で結ばれた2枚が、共通の子を持つ組
      def detect
        children = hierarchical_children
        @relations.select { |relation| relation[:type].to_s == "peer" }.filter_map do |relation|
          a = @by_id[relation[:from]]
          b = @by_id[relation[:to]]
          next if a.nil? || b.nil?

          shared = children[a.id].to_a & children[b.id].to_a
          next if shared.empty?

          { a:, b:, shared: }
        end
      end

      def hierarchical_children
        @hierarchical_children ||= @relations.reject { |relation| relation[:type].to_s == "peer" }
                                             .group_by { |relation| relation[:from] }
                                             .transform_values { |list| list.map { |relation| relation[:to] }.uniq }
      end

      def hierarchical?(relation) = relation[:type].to_s != "peer"

      # 幹と渡しの場所を決める。**決められない組は落とす**
      def with_geometry(couple)
        a = couple[:a]
        b = couple[:b]
        # 同じ段に並んでいないなら、二人の間に幹を通しても読めない
        return nil unless (a.center_y - b.center_y).abs < a.height
        return nil if (a.center_x - b.center_x).abs > MAX_PARTNER_GAP

        children = couple[:shared].filter_map { |id| @by_id[id] }
        return nil if children.empty?

        drop = [ a.bottom, b.bottom ].max + TRUNK_DROP
        top = children.map(&:top).min
        # 子が親より上にある。幹を降ろせない
        return nil unless top > drop

        Couple.new(
          a:, b:, children: children.to_h { |box| [ box.id, box ] },
          trunk_x: (a.center_x + b.center_x) / 2,
          bus_y: (drop + top) / 2
        )
      end

      # 同じ場所に重なった点と、まっすぐ続くだけの点を落とす
      def trim(points)
        kept = [ points.first ]
        points[1..].each do |point|
          previous = kept.last
          next if previous["x"] == point["x"] && previous["y"] == point["y"]

          if kept.size >= 2 && straight?(kept[-2], previous, point)
            kept[-1] = point
          else
            kept << point
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
