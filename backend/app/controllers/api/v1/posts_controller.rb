module Api
  module V1
    # 公開済みの読みもの（お知らせ・更新情報・コラム）を読む側。
    # 下書きは返さない。
    class PostsController < BaseController
      include ItemSerialization

      DEFAULT_LIMIT = 50
      MAX_LIMIT = 100

      def index
        # 画像を出す行があるので、blob をまとめて読む（行ごとに引かない）
        posts = Post.published.in_category(params[:category]).for_listing.limit(limit)
                    .with_attached_cover_image.with_attached_cover_thumb
        render json: { posts: posts.map { |post| serialize(post) } }
      end

      def show
        post = Post.published.find_by!(slug: params[:id])
        # 読まれた回数を1つ増やす。increment! は行を読み直さずに済み、
        # 同時に開かれても数え落とさない
        Post.where(id: post.id).update_all("views_count = views_count + 1")
        render json: serialize(post, full: true)
      end

      private

      def serialize(post, full: false)
        base = {
          slug: post.slug,
          category: post.category,
          category_label: post.category_label,
          title: post.title,
          excerpt: post.excerpt,
          tags: post.tags,
          reading_minutes: post.reading_minutes,
          pinned: post.pinned,
          published_at: post.published_at,
          # 一覧はサムネ、記事の中では原寸。無ければ nil（画面は枠ごと出さない）
          image_url: cover_url(full ? post.cover_display_blob : post.cover_list_blob)
        }
        full ? base.merge(body: post.body) : base
      end

      def cover_url(blob)
        blob && media_url(blob)
      end

      def limit
        requested = params[:limit].to_i
        return DEFAULT_LIMIT if requested <= 0

        [ requested, MAX_LIMIT ].min
      end
    end
  end
end
