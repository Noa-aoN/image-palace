module Api
  module V1
    # ボードに置く図形（四角・丸・付箋・見出し・かこみ）の作成・更新・削除。
    #
    # 線（view_edges）と同じ形にしてある。読み方も保存の仕方も揃えるため。
    class ViewShapesController < BaseController
      before_action :set_view
      before_action :set_shape, only: [ :update, :destroy ]

      # 1つのボードに置ける数。**盤が図形で埋まると、カードが読めなくなる**
      MAX_SHAPES = 200

      def create
        if @view.view_shapes.count >= MAX_SHAPES
          return render json: { error: "1つのボードに置ける図形は#{MAX_SHAPES}個までです" },
                        status: :unprocessable_entity
        end

        shape = @view.view_shapes.build(shape_params)
        apply_default_size(shape)
        # 指定が無いところは種類ごとの既定で埋める。
        # **見えない図形を置かない**（塗りも枠も無いと、盤にあることが分からない）
        shape.style = ViewShape.default_style_for(shape.kind).merge(sanitized_style(params[:style]))
        shape.save!
        render json: serialize_shape(shape), status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def update
        @shape.assign_attributes(shape_params.except(:kind))
        # 見た目は**足し合わせる**。一部だけ変えたいときに、他が消えないように
        @shape.style = @shape.style.merge(sanitized_style(params[:style])) if params.key?(:style)
        @shape.save!
        head :no_content
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @shape.destroy!
        head :no_content
      end

      # 重なり順の並べ替え。手前から順に受け取る（線と同じ作法）
      def reorder
        ids = Array(params[:ordered_ids]).map(&:to_s)
        ViewShape.transaction do
          ids.each_with_index do |id, index|
            @view.view_shapes.where(id: id).update_all(z_index: ids.size - index, updated_at: Time.current)
          end
        end
        head :no_content
      end

      private

      def set_view
        @view = current_user.views.find(params[:id] || params[:view_id])
      end

      def set_shape
        @shape = @view.view_shapes.find(params[:shape_id])
      end

      def shape_params
        params.permit(:kind, :x, :y, :width, :height, :z_index, :text)
      end

      # 大きさを指定せずに作られたら、種類に合った既定を当てる。
      # **置いてから毎回そろえ直すより速い**
      def apply_default_size(shape)
        defaults = ViewShape.default_size_for(shape.kind)
        shape.width = defaults[:width] unless params.key?(:width)
        shape.height = defaults[:height] unless params.key?(:height)
      end

      # 見た目。**AI や画面の言うことをそのまま入れず、扱える値だけを取り出す。**
      # 色は #rgb / #rrggbb の形だけ通す（式や関数をそのまま描画へ流さないため）
      COLOR_FORMAT = /\A#(?:\h{3}|\h{6})\z/
      ALIGNMENTS = %w[left center right].freeze
      MAX_STROKE_WIDTH = 12
      MAX_FONT_SIZE = 96
      MAX_RADIUS = 200

      def sanitized_style(raw)
        return {} unless raw.is_a?(ActionController::Parameters) || raw.is_a?(Hash)

        source = raw.respond_to?(:to_unsafe_h) ? raw.to_unsafe_h : raw
        {
          "fill" => color(source["fill"]),
          "stroke" => color(source["stroke"]),
          "stroke_width" => number(source["stroke_width"], 0, MAX_STROKE_WIDTH),
          "radius" => number(source["radius"], 0, MAX_RADIUS),
          "opacity" => number(source["opacity"], 0.1, 1.0, integer: false),
          "font_size" => number(source["font_size"], 8, MAX_FONT_SIZE),
          "text_color" => color(source["text_color"]),
          "align" => (ALIGNMENTS.include?(source["align"].to_s) ? source["align"].to_s : nil),
          "bold" => (source["bold"].present? ? ActiveModel::Type::Boolean.new.cast(source["bold"]) : nil),
          "dashed" => (source["dashed"].present? ? ActiveModel::Type::Boolean.new.cast(source["dashed"]) : nil),
          # 付箋の角の折り目。形だけで他の図形と見分けられるようにする
          "folded" => (source["folded"].nil? ? nil : ActiveModel::Type::Boolean.new.cast(source["folded"]))
        }.compact
      end

      def color(value)
        value.to_s.match?(COLOR_FORMAT) ? value.to_s : nil
      end

      def number(value, min, max, integer: true)
        return nil if value.blank?

        parsed = value.to_f.clamp(min, max)
        integer ? parsed.round : parsed.round(2)
      end

      def serialize_shape(shape)
        {
          id: shape.id, kind: shape.kind,
          x: shape.x, y: shape.y, width: shape.width, height: shape.height,
          z_index: shape.z_index, text: shape.text, style: shape.style
        }
      end
    end
  end
end
