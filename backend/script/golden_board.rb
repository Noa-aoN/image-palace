# frozen_string_literal: true

# ギリシャ神話ボードを、AI整理の回帰用の代表ケースとして測る。
#
# **数字が良くなっても、図が悪くなっていないか**を見るための台。
# 同じ入力から同じ図が出るので、変更の前後で並べて比べられる。
#
#   docker compose exec -T web bundle exec rails runner script/golden_board.rb
#
# 出力は1行1指標。前後の差分を取りやすいように、値だけを並べる。
module GoldenBoard
  B = Views::Layout::Box

  def self.box(id, index)
    B.new(id: id, title: id, x: (index % 5) * 220, y: (index / 5) * 260,
          width: 144, height: 176, footprint_width: 144)
  end

  # 実際の盤と同じ構成（オリュンポスの神々＋場所＋別名）
  def self.definition
    names = %w[
      ゼウス ヘラ ポセイドン ハデス デメテル ヘスティア
      アテナ アポロン アルテミス アレス ヘパイストス ヘルメス アフロディーテ
      クロノス レア パルテノン神殿 ミネルヴァ
    ]
    relations = [
      # 世代
      { from: "クロノス", to: "レア", type: "spouse", label: "妻", strength: 0.9 },
      *%w[ゼウス ヘラ ポセイドン ハデス デメテル ヘスティア].flat_map do |child|
        [ { from: "クロノス", to: child, type: "parent", label: "子", strength: 0.9 },
          { from: "レア", to: child, type: "parent", label: "子", strength: 0.9 } ]
      end,
      # ゼウスの代
      { from: "ゼウス", to: "ヘラ", type: "spouse", label: "妻", strength: 0.95 },
      { from: "ゼウス", to: "ポセイドン", type: "sibling", label: "兄弟", strength: 0.8 },
      { from: "ゼウス", to: "ハデス", type: "sibling", label: "兄弟", strength: 0.8 },
      # 子
      *%w[アテナ アポロン アルテミス ヘルメス].map do |child|
        { from: "ゼウス", to: child, type: "parent", label: "子", strength: 0.9 }
      end,
      *%w[アレス ヘパイストス].flat_map do |child|
        [ { from: "ゼウス", to: child, type: "parent", label: "子", strength: 0.85 },
          { from: "ヘラ", to: child, type: "parent", label: "子", strength: 0.9 } ]
      end,
      # 場所・別名（家系とは別の関係）
      { from: "アテナ", to: "パルテノン神殿", type: "belongs_to", label: "祀られる", strength: 0.8 },
      { from: "アテナ", to: "ミネルヴァ", type: "equivalent", label: "同一視", strength: 0.85 },
      # 確かでない関係（線にすべきか怪しいもの）
      { from: "アフロディーテ", to: "アレス", type: "related", label: "関係", strength: 0.35 }
    ]
    [ names.each_with_index.map { |n, i| box(n, i) }, relations ]
  end

  def self.run
    boxes, all = definition
    # **確からしさの足りない関係は線にしない。** 本番と同じ道を通す
    relations = all.select { |r| Views::Layout::Confidence.enough?(r[:type], r[:strength]) }
    puts "dropped_unconfident        #{all.size - relations.size}"
    result = Views::Layout::Planner.new(
      boxes: boxes, relations: relations, structure: "hierarchy", roots: [ "クロノス" ]
    ).call
    report(result, relations)
  end

  def self.report(result, relations)
    placed = result.boxes.to_h { |b| [ b.id, b ] }
    lines = Views::Layout::Geometry.call(boxes: placed, relations: relations)
    counts = result.score.counts

    puts "quality_score              #{result.score.points}"
    puts "isolated_with_strong_rel   #{isolated_with_strong(result.boxes, relations)}"
    puts "edge_crossings             #{counts[:edge_crossings]}"
    puts "total_edge_length          #{total_length(lines).round}"
    puts "hierarchy_violations       #{hierarchy_violations(placed, relations)}"
    puts "unnecessary_bends          #{counts[:bends]}"
    puts "junctions_used             #{Views::Layout::CoupleBus.new(boxes: placed, relations: relations).couples.size}"
    puts "node_overlap               #{counts[:overlaps]}"
    puts "label_collision            #{counts[:label_clashes]}"
    puts "edges_drawn                #{relations.size}"
    puts
    puts "内訳:"
    result.score.breakdown.each do |group|
      weak = group[:weak].map { |w| [ w[:label], w[:note] ].compact.join("=") }.join("・")
      puts "  #{group[:label].ljust(6)} #{group[:points]}/#{group[:max]}  #{weak}"
    end
  end

  # 強い関係を持つのに、線が1本も無いカード
  def self.isolated_with_strong(boxes, relations, threshold = 0.6)
    connected = relations.select { |r| r[:strength].to_f >= threshold }
                         .flat_map { |r| [ r[:from], r[:to] ] }.to_set
    named = relations.flat_map { |r| [ r[:from], r[:to] ] }.to_set
    boxes.count { |box| named.include?(box.id) && !connected.include?(box.id) }
  end

  def self.total_length(lines)
    lines.sum do |line|
      line.polyline.each_cons(2).sum { |a, b| (a[:x] - b[:x]).abs + (a[:y] - b[:y]).abs }
    end
  end

  # 子が親より上にある、または同じ高さにある組
  def self.hierarchy_violations(placed, relations)
    same_level = %w[peer spouse sibling equivalent contrast]
    relations.count do |relation|
      next false if same_level.include?(relation[:type].to_s)

      from = placed[relation[:from]]
      to = placed[relation[:to]]
      from && to && to.center_y <= from.center_y
    end
  end
end

GoldenBoard.run
