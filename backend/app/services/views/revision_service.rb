# frozen_string_literal: true

module Views
  # キャンバスの状態を控え、行き来できるようにする。
  #
  # AI 調整の結果が思ったものと違ったとき、手で元に戻すのは現実的でない
  # （配置も線もまとめて変わるため）。調整の前後を控えて「戻る／進む」を成り立たせる。
  #
  # 控えるのは配置（座標・順序・大きさ）と線だけ。
  # カードそのものは消していないので、状態を戻せば見た目も元に戻る。
  # カードが後から本当に消された場合は、その分だけ復元しない（欠けたまま戻す）。
  class RevisionService
    # 残す控えの数。これより古いものは捨てる（際限なく貯めない）
    MAX_REVISIONS = 20

    def self.snapshot!(view, label:)
      new(view).snapshot!(label)
    end

    def self.undo!(view)
      new(view).undo!
    end

    def self.redo!(view)
      new(view).redo!
    end

    def self.status(view)
      new(view).status
    end

    def initialize(view)
      @view = view
    end

    # いまの状態を控えに積む。
    # 戻ったあとで新しく調整した場合は、先に進んでいた分を捨ててから積む
    # （枝分かれを持たない。行き来だけを扱う）。
    def snapshot!(label)
      ViewRevision.transaction do
        seed_current_state_if_empty!
        drop_forward_revisions!
        position = @view.revision_cursor + 1
        ViewRevision.create!(view: @view, position: position, state: capture, label: label, created_at: Time.current)
        @view.update!(revision_cursor: position)
        prune!
      end
      status
    end

    def undo!
      target = revision_at(@view.revision_cursor - 1)
      return status unless target

      restore!(target)
      @view.update!(revision_cursor: target.position)
      status
    end

    def redo!
      target = revision_at(@view.revision_cursor + 1)
      return status unless target

      restore!(target)
      @view.update!(revision_cursor: target.position)
      status
    end

    def status
      positions = @view.view_revisions.pluck(:position)
      {
        cursor: @view.revision_cursor,
        can_undo: positions.any? { |position| position < @view.revision_cursor },
        can_redo: positions.any? { |position| position > @view.revision_cursor }
      }
    end

    private

    def revision_at(position)
      return nil if position < 1

      @view.view_revisions.find_by(position: position)
    end

    # 最初の調整のときだけ、調整前の状態を1件目として置く。
    # これが無いと「1回目の調整を戻す」ができない。
    def seed_current_state_if_empty!
      return if @view.revision_cursor.positive?

      ViewRevision.create!(view: @view, position: 1, state: capture, label: "調整前", created_at: Time.current)
      @view.update!(revision_cursor: 1)
    end

    def drop_forward_revisions!
      @view.view_revisions.where("position > ?", @view.revision_cursor).delete_all
    end

    def prune!
      excess = @view.view_revisions.count - MAX_REVISIONS
      return if excess <= 0

      oldest = @view.view_revisions.ordered.limit(excess).pluck(:position)
      @view.view_revisions.where(position: oldest).delete_all
    end

    def capture
      {
        "items" => @view.view_items.map do |view_item|
          {
            "item_id" => view_item.item_id,
            "x" => view_item.x, "y" => view_item.y, "z_index" => view_item.z_index,
            "width" => view_item.width, "height" => view_item.height,
            "position" => view_item.position
          }
        end,
        "edges" => @view.view_edges.map do |edge|
          {
            "source" => edge.source_node_id, "target" => edge.target_node_id,
            "label" => edge.label, "style" => edge.style, "z_index" => edge.z_index,
            # **手で置いた折れ点と、どの辺から出すかも控える。**
            # 控えていなかった頃は、戻すと線の道すじが失われ、
            # 手で曲げた線が全部まっすぐな自動経路に戻っていた
            "points" => edge.points, "source_handle" => edge.source_handle,
            "target_handle" => edge.target_handle
          }
        end,
        # **図形も控える。**
        # 控えていなかった頃は、図形を置いてから「戻る」を押しても図形が残り、
        # 何が戻ったのか読めなかった（カードと線だけが戻る）
        "shapes" => @view.view_shapes.map do |shape|
          {
            "kind" => shape.kind, "x" => shape.x, "y" => shape.y,
            "width" => shape.width, "height" => shape.height,
            "z_index" => shape.z_index, "text" => shape.text, "style" => shape.style
          }
        end
      }
    end

    # 控えた状態へ戻す。
    # 控えたあとに本当に消えたカードは戻せないので、まだ手元にあるものだけを復元する。
    def restore!(revision)
      state = revision.state || {}
      items = Array(state["items"])
      owned = @view.user.items.where(id: items.map { |item| item["item_id"] }).pluck(:id).to_set

      ViewItem.transaction do
        @view.view_items.destroy_all
        items.each do |item|
          next unless owned.include?(item["item_id"])

          @view.view_items.create!(
            item_id: item["item_id"],
            x: item["x"].to_f, y: item["y"].to_f, z_index: item["z_index"].to_i,
            width: item["width"], height: item["height"], position: item["position"]
          )
        end

        @view.view_edges.destroy_all
        Array(state["edges"]).each do |edge|
          next unless owned.include?(edge["source"]) && owned.include?(edge["target"])

          # 古い控えには道すじが入っていない。**その場合は自動経路に戻す**
          # （欠けているものを埋めようとせず、無い状態をそのまま復元する）
          @view.view_edges.create!(
            source_node_id: edge["source"], target_node_id: edge["target"],
            label: edge["label"], style: edge["style"] || {}, z_index: edge["z_index"].to_i,
            points: edge["points"] || [],
            source_handle: edge["source_handle"], target_handle: edge["target_handle"]
          )
        end

        restore_shapes!(state)
      end
    end

    # 図形を戻す。
    #
    # **鍵が無い控えは、図形を触らない。** 図形を控えるようになる前の版へ
    # 戻したときに図形を全部消してしまうと、控えていないものを消すことになる。
    # 「控えていない」と「1つも無かった」は別のこと
    def restore_shapes!(state)
      return unless state.key?("shapes")

      @view.view_shapes.destroy_all
      Array(state["shapes"]).each do |shape|
        next unless ViewShape::KINDS.include?(shape["kind"])

        @view.view_shapes.create!(
          kind: shape["kind"], x: shape["x"].to_f, y: shape["y"].to_f,
          width: shape["width"].to_f, height: shape["height"].to_f,
          z_index: shape["z_index"].to_i, text: shape["text"], style: shape["style"] || {}
        )
      end
    end
  end
end
