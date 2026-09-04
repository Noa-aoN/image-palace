# frozen_string_literal: true

module Api
  module V1
    # 盤に置いたものの重なり順を、**ひとまとめに**決める。
    #
    # ## なぜ図形と線を分けなかったか
    #
    # はじめは種類ごとに分けて並べていた。図形どうし・線どうしでしか
    # 順を変えられないので、**「線の上に付箋を置く」ができなかった**。
    #
    # 描く道具として見れば、線も図形も同じ「盤に置いたもの」で、
    # 前後の関係があるのが自然。図形と線は保存先の表が違うだけなので、
    # **1つの並びから、それぞれの表へ番号を配る**。
    #
    # かこみ（frame）だけは、この並びの外にいる。必ずいちばん後ろに敷く
    # （前に出ると囲った中身が隠れる）。
    class ViewObjectsController < BaseController
      before_action :set_view

      # 手前から順に受け取る。[{ "kind" => "shape"|"edge", "id" => "..." }, ...]
      def reorder
        entries = normalized_entries
        return head :no_content if entries.empty?

        # 1つの並びから配るので、図形と線の番号が混ざる。
        # 後ろほど小さい番号（画面では zIndex がそのまま重なり順になる）
        ActiveRecord::Base.transaction do
          entries.each_with_index do |entry, index|
            z = entries.size - index
            scope = entry[:kind] == "shape" ? @view.view_shapes : @view.view_edges
            scope.where(id: entry[:id]).update_all(z_index: z, updated_at: Time.current)
          end
        end
        head :no_content
      end

      private

      def set_view
        @view = current_user.views.find(params[:id])
      end

      # 知らない種類は捨てる。**黙って別の表を書き換えない**
      def normalized_entries
        Array(params[:ordered]).filter_map do |entry|
          kind = entry[:kind].to_s
          id = entry[:id].to_s
          next unless %w[shape edge].include?(kind) && id.present?

          { kind: kind, id: id }
        end
      end
    end
  end
end
