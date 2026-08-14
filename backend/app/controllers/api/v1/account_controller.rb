module Api
  module V1
    # GDPR / 個人情報保護法対応: 自分のデータのエクスポートとアカウント削除
    class AccountController < BaseController
      include ItemSerialization

      # アカウント削除後は認証ヘッダ更新（削除済みユーザーの reload）を行わない
      skip_after_action :update_auth_header, only: :destroy, raise: false

      # 自分の全データを JSON で返す（ダウンロード用）
      def export
        data = {
          exported_at: Time.current.iso8601,
          user: export_user,
          items: export_items,
          boxes: export_boxes,
          spaces: export_spaces,
          views: export_views,
          tags: current_user.tags.order(:created_at).map { |t| { id: t.id, name: t.name } }
        }

        response.headers["Content-Disposition"] =
          %(attachment; filename="image-palace-export-#{Date.current.iso8601}.json")
        render json: data
      end

      # アカウントと関連データ（item / media / デッキ / コレクション等）を完全削除する。
      # media の画像ファイルは ActiveStorage の purge により R2 からも削除される。
      def destroy
        current_user.destroy!
        head :no_content
      end

      private

      def export_user
        {
          id: current_user.id,
          email: current_user.email,
          name: current_user.name,
          provider: current_user.provider,
          created_at: current_user.created_at
        }
      end

      def export_items
        current_user.items
                    .includes(:item_type, :meanings, :tags,
                              { item_properties: :property_definition }, MEDIA_INCLUDES)
                    .order(:created_at)
                    .map do |item|
          {
            id: item.id,
            title: item.title,
            item_type: item.item_type&.name,
            generation_status: item.generation_status,
            meaning: item.primary_meaning&.definition,
            # 意味は1つとは限らない。**種類（意味／解説／原義…）ごとに持てる**ので、
            # 先頭だけ出すと、書いたものの大半が落ちる
            meanings: item.meanings.sort_by { |m| [ m.position || 0, m.id ] }.map do |meaning|
              { kind: meaning.kind, detail_level: meaning.detail_level,
                language_code: meaning.language_code, definition: meaning.definition }.compact
            end,
            tags: item.tags.map(&:name),
            # 自分で書いた項目。**持ち出したいのは、まずこれ**
            properties: export_properties(item),
            image_url: serialize_media(item.primary_media)&.dig(:url),
            created_at: item.created_at
          }
        end
      end

      # カードの項目。値は入っている形のまま出す（読み込み直せることを優先する）。
      # 段取り用の内部の目印（絵の実体の id）は、持ち出す人には意味が無いので落とす
      def export_properties(item)
        item.item_properties.filter_map do |property|
          definition = property.property_definition
          next if definition.nil?

          value = property.typed_value
          next if value.nil? || (value.respond_to?(:empty?) && value.empty?)

          {
            key: definition.key,
            label: definition.label,
            value_type: definition.value_type,
            value: value.is_a?(Hash) ? value.except("shared_media_id") : value
          }
        end
      end

      # まとめたもの・置いたものは、**中身まで出す**。
      # 名前だけでは、持ち出しても組み直せない（どのカードを入れたかが失われる）
      def export_boxes
        current_user.boxes.includes(:box_items).order(:created_at).map do |box|
          name_record(box).merge(item_ids: box.box_items.map(&:item_id))
        end
      end

      def export_spaces
        current_user.spaces.includes(:space_points).order(:created_at).map do |space|
          points = space.space_points.map do |point|
            { item_id: point.item_id, name: point.name.presence,
              surface: point.surface, position: point.position }.compact
          end
          name_record(space).merge(points: points)
        end
      end

      def export_views
        current_user.views.includes(:view_items).order(:created_at).map do |view|
          name_record(view).merge(item_ids: view.view_items.map(&:item_id))
        end
      end

      def name_record(record)
        { id: record.id, name: record.name, created_at: record.created_at }
      end
    end
  end
end
