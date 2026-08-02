# frozen_string_literal: true

# 一覧を少しずつ返すための共通処理。
#
# 一覧系のエンドポイントは全件返す作りだったため、件数が増えるほど
# 転送量も描画も重くなっていた。ライブラリの棚のように「まず数件だけ見せて、
# 続きは求められたら渡す」使い方ができるよう、件数の上限と続きの位置を扱う。
#
# 続きの位置は offset ではなく作成時刻のカーソルにする。
# offset は深い位置ほど DB 側が読み飛ばす分だけ遅くなるため。
#
# limit の指定が無いときは全件返す（従来どおり）。既存の呼び出しを壊さないため。
module ListPagination
  extend ActiveSupport::Concern

  MAX_LIST_LIMIT = 100

  private

  # 上限。指定が無ければ nil（＝全件）
  def list_limit
    requested = params[:limit].to_i
    return nil if requested <= 0

    [ requested, MAX_LIST_LIMIT ].min
  end

  # 続きの位置。作成時刻より前のものを返す
  def list_cursor
    return nil if params[:cursor].blank?

    Time.iso8601(params[:cursor])
  rescue ArgumentError
    nil
  end

  # scope へ上限とカーソルを適用し、[ 返す行, 続きの位置 ] を返す。
  # 続きがあるかは 1 件多く取って判断する（別途 COUNT を投げないため）。
  def paginate_list(scope, created_at_column: :created_at)
    scope = scope.where(scope.table_name => { created_at_column => ...list_cursor }) if list_cursor
    return [ scope.to_a, nil ] unless list_limit

    rows = scope.limit(list_limit + 1).to_a
    has_more = rows.size > list_limit
    rows = rows.first(list_limit)
    [ rows, has_more ? rows.last&.public_send(created_at_column)&.iso8601(6) : nil ]
  end
end
