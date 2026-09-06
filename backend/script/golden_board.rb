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

  # 意味の正解。**盤にどのカードがあるかで変わる。**
  #
  # 兄弟どうしの線は、共通の親が盤にあれば引かなくてよい——
  # 親を通して繋がるので、引くと同じことを二度言うことになる。
  # だが親が盤にいなければ、兄弟の線が無いとカードが浮く。
  # 「正しい図」は盤の顔ぶれで変わるので、正解もそれに合わせる。
  #
  # names に nil を渡すと、17枚そろった元の盤の正解を返す
  def self.expected_relations(names = nil)
    drawn = drawn_relations + orphaned_siblings(names) + extra_truth
    drawn = drawn.select { |r| names.include?(r[:from]) && names.include?(r[:to]) } if names
    # **描かない線は、正解にも入れない。** 共通の親が図にいる兄弟は
    # 本番で省くので、期待し続けると再現率が上がりきらない
    drawn - Views::Layout::Relation.redundant_siblings(drawn)
  end

  # 親が盤にいないきょうだい。
  #
  # **輪（全組み合わせ）にはしない。** 5人いれば10本になり、図として読めない。
  # 1人を軸にした星形を正解とする。別の組み方でも図としては正しいので、
  # そのときは false_relations に出る——数だけで断じないこと
  def self.orphaned_siblings(names)
    return [] if names.nil? || (names.include?("クロノス") && names.include?("レア"))

    %w[デメテル ヘスティア].map do |sibling|
      { from: "ゼウス", to: sibling, type: "sibling", label: "兄弟", strength: 0.8 }
    end
  end

  # definition（配置回帰用の入力）には入れていないが、事実として確かな関係。
  # 入力を変えると Layout Score の比べる先が動くので、正解の側だけに足す
  def self.extra_truth
    [ { from: "ヘパイストス", to: "アフロディーテ", type: "spouse", label: "妻", strength: 0.7 },
      # 資料に「アポロンの双子の妹」と書いてある。共通の親を通しても繋がるが、
      # **書いてあることを引かないのは間違い**なので、正解に入れる
      { from: "アルテミス", to: "アポロン", type: "sibling", label: "双子", strength: 0.9 } ]
  end

  # 配置回帰に入れる線。**確からしさの足りない関係は線にしない**（本番と同じ道）
  def self.drawn_relations
    _, all = definition
    all.select { |r| Views::Layout::Confidence.enough?(r[:type], r[:strength]) }
  end

  def self.run
    boxes, all = definition
    relations = drawn_relations
    puts "dropped_unconfident        #{all.size - relations.size}"
    result = Views::Layout::Planner.new(
      boxes: boxes, relations: relations, structure: "hierarchy", roots: [ "クロノス" ]
    ).call
    puts "== Layout Score =="
    report(result, relations)
    puts
    puts "== Semantic Score =="
    semantic
  end

  # 意味の当たり具合。**配置の点数とは別に出す。**
  #
  # 既定では正解をそのまま入れて測る（台そのものの検算になる）。
  # 実際の盤を測るときは、その盤の id を渡す:
  #
  #   GOLDEN_BOARD_VIEW_ID=<view の id> bundle exec rails runner script/golden_board.rb
  #
  # 盤とはカードの見出し語で突き合わせる。**正解はここにしか無い**
  # （プロダクト側にギリシャ神話の知識は入れない）
  def self.semantic
    detected, names = detected_relations
    # 盤に無いカードの関係は、そもそも引きようがない。数に入れない
    expected = expected_relations(names)

    result = Views::Layout::SemanticScore.call(expected: expected, detected: detected)
    puts "expected_relations         #{result.expected}"
    puts "detected_relations         #{result.detected}"
    puts "matched_relations          #{result.matched_count}"
    puts "missing_relations          #{result.missing_count}"
    puts "false_relations            #{result.extra_count}"
    puts "wrong_type                 #{result.wrong_type.size}"
    puts "wrong_direction            #{result.wrong_direction.size}"
    puts "semantic_recall            #{result.recall}"
    puts "semantic_precision         #{result.precision}"
    puts "semantic_f1                #{result.f1}"
    puts "pair_recall                #{result.pair_recall}"
    puts "isolated_cards             #{isolated_cards(detected, names)}" if names
    detail("missing", result.missing)
    detail("false", result.extra)
    detail("wrong_type", result.wrong_type.map { |want, got| "#{want} → #{got.type}" })
    detail("wrong_direction", result.wrong_direction.map { |want, _| want })
  end

  def self.detail(label, entries)
    return if entries.empty?

    puts "  #{label}:"
    entries.each { |entry| puts "    - #{entry}" }
  end

  # 測る相手。盤の id が渡されていればその盤の線、無ければ正解そのもの
  def self.detected_relations
    id = ENV["GOLDEN_BOARD_VIEW_ID"].presence
    return [ expected_relations(nil), nil ] if id.nil?

    view = View.find(id)
    titles = Item.where(id: view.view_items.select(:item_id)).pluck(:id, :title).to_h
    relations = view.view_edges.filter_map do |edge|
      from = titles[edge.source_node_id]
      to = titles[edge.target_node_id]
      next unless from && to

      { from: from, to: to, type: edge.style.to_h["relation"].to_s,
        label: edge.label, strength: edge.style.to_h["strength"] }
    end
    [ relations, titles.values.to_set ]
  end

  # 線が1本も無いカード
  def self.isolated_cards(relations, names)
    connected = relations.flat_map { |r| [ r[:from], r[:to] ] }.to_set
    names.count { |name| !connected.include?(name) }
  end

  def self.report(result, relations)
    placed = result.boxes.to_h { |b| [ b.id, b ] }
    lines = Views::Layout::Geometry.call(boxes: placed, relations: relations)
    counts = result.score.counts

    puts "quality_score              #{result.score.points}"
    puts "isolated_with_strong_rel   #{isolated_with_strong(result.boxes, relations)}"
    puts "edge_crossings             #{counts[:edge_crossings]}"
    puts "total_edge_length          #{counts[:total_edge_length]}"
    # 数え方を変えたので、前と比べられるよう旧来の数え方も出す
    puts "edge_length_sum_old        #{lines.sum { |l| l.polyline.each_cons(2).sum { |a, b| (a[:x] - b[:x]).abs + (a[:y] - b[:y]).abs } }.round}"
    puts "hierarchy_violations       #{hierarchy_violations(placed, relations)}"
    puts "visible_corners            #{counts[:bends]}"
    # 数え方を変えたので、前と比べられるよう旧来の数え方も出す
    puts "bends_per_edge_old         #{lines.sum { |l| [ l.polyline.size - 2, 0 ].max }}"
    puts "junctions_used             #{Views::Layout::Bus.new(boxes: placed, relations: relations).groups.size}"
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
