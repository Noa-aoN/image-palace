module Api
  module V1
    module Admin
      # 読みもの（お知らせ・更新情報・コラム）の管理と配信。
      #
      # 本文は平文で受け取り、こちらで塊に組み立てる。
      # 書く側に構造化を強いると続かないため。
      class PostsController < BaseController
        before_action :set_post, only: [ :show, :update, :destroy, :deliver ]

        def index
          posts = Post.in_category(params[:category]).for_listing.limit(200)
          render json: { posts: posts.map { |post| serialize(post) } }
        end

        def show
          render json: serialize(@post)
        end

        def create
          post = Post.new(post_attributes)
          post.author = current_user
          post.save!
          audit!("post.created", target: post, details: { slug: post.slug, category: post.category })
          render json: serialize(post), status: :created
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        end

        def update
          was_published = @post.published?
          @post.update!(post_attributes)
          audit!("post.updated", target: @post, details: {
            slug: @post.slug, published: @post.published?, was_published: was_published
          })
          render json: serialize(@post)
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        end

        def destroy
          audit!("post.deleted", target: @post, details: { slug: @post.slug, title: @post.title })
          @post.destroy!
          head :no_content
        end

        # お知らせとして全員に届ける。
        # 公開されていないものは配れない（下書きへの導線を配ってしまわないように）。
        # 二重配信も防ぐ（人数分の通知が二重に積まれる事故は取り返しがつかない）。
        def deliver
          return render_error("公開してから配信してください") unless @post.published?
          return render_error("すでに配信済みです") if @post.delivered?

          @post.update!(delivered_at: Time.current)
          DeliverPostJob.perform_later(@post.id)
          audit!("post.delivered", target: @post, details: { slug: @post.slug, title: @post.title })
          render json: serialize(@post), status: :accepted
        end

        private

        def set_post
          @post = Post.find(params[:id])
        end

        def post_attributes
          permitted = params.require(:post).permit(
            :slug, :category, :title, :excerpt, :body_text, :reading_minutes, :pinned, :published
          )
          attributes = permitted.to_h.symbolize_keys
          body_text = attributes.delete(:body_text)
          published = attributes.delete(:published)

          attributes[:tags] = Array(params.dig(:post, :tags)).map { |tag| tag.to_s.strip }.reject(&:blank?)
          attributes[:body] = Post.blocks_from_text(body_text) unless body_text.nil?
          unless published.nil?
            attributes[:published_at] = publish_flag(published) ? (@post&.published_at || Time.current) : nil
          end
          attributes
        end

        def publish_flag(value)
          ActiveModel::Type::Boolean.new.cast(value)
        end

        def serialize(post)
          {
            id: post.id,
            slug: post.slug,
            category: post.category,
            category_label: post.category_label,
            title: post.title,
            excerpt: post.excerpt,
            body_text: post.body_as_text,
            tags: post.tags,
            reading_minutes: post.reading_minutes,
            pinned: post.pinned,
            published: post.published?,
            published_at: post.published_at,
            # 下書き / 予約 / 公開。published だけだと「予約」が下書きに見える
            status: post_status(post),
            views_count: post.views_count,
            delivered_at: post.delivered_at,
            author_email: post.author&.email,
            updated_at: post.updated_at
          }
        end

        # 公開予定の日時が未来なら「予約」。published? は未来を false にするので、
        # そのままでは下書きと区別が付かない
        def post_status(post)
          return "draft" if post.published_at.blank?
          return "scheduled" if post.published_at > Time.current

          "published"
        end

        def render_error(message)
          render json: { error: message }, status: :unprocessable_entity
        end
      end
    end
  end
end
