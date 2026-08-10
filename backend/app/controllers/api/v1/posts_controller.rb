module Api
  module V1
    # 公開済みの読みもの（お知らせ・更新情報・コラム）を読む側。
    # 下書きは返さない。
    class PostsController < BaseController
      DEFAULT_LIMIT = 50
      MAX_LIMIT = 100

      def index
        posts = Post.published.in_category(params[:category]).for_listing.limit(limit)
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
          published_at: post.published_at
        }
        full ? base.merge(body: post.body) : base
      end

      def limit
        requested = params[:limit].to_i
        return DEFAULT_LIMIT if requested <= 0

        [ requested, MAX_LIMIT ].min
      end
    end
  end
end
