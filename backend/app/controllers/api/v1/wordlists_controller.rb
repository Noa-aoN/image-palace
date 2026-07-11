module Api
  module V1
    class WordlistsController < BaseController
      before_action :set_wordlist, only: [ :show, :update, :destroy ]

      def index
        render json: current_user.wordlists.recent.map { |w| serialize_wordlist(w) }
      end

      def show
        render json: serialize_wordlist(@wordlist)
      end

      def create
        wordlist = current_user.wordlists.build(name: params.dig(:wordlist, :name), words: cleaned_words)
        if wordlist.save
          render json: serialize_wordlist(wordlist), status: :created
        else
          render json: { errors: wordlist.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # リスト名・単語（並び順を含む）を更新する。words は配列カラムなので順序がそのまま保存される。
      def update
        attrs = {}
        attrs[:name] = params.dig(:wordlist, :name) if params.dig(:wordlist, :name).present?
        attrs[:words] = cleaned_words if params.dig(:wordlist, :words)

        if @wordlist.update(attrs)
          render json: serialize_wordlist(@wordlist)
        else
          render json: { errors: @wordlist.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def destroy
        @wordlist.destroy!
        head :no_content
      end

      private

      def set_wordlist
        @wordlist = current_user.wordlists.find(params[:id])
      end

      # 単語配列の正規化（空除去・重複排除・上限）。
      def cleaned_words
        Array(params.dig(:wordlist, :words))
          .map { |w| w.to_s.strip }
          .reject(&:blank?)
          .uniq
          .first(Wordlist::WORDS_LIMIT)
      end

      def serialize_wordlist(wordlist)
        {
          id: wordlist.id,
          name: wordlist.name,
          words: wordlist.words,
          word_count: wordlist.words.size,
          created_at: wordlist.created_at
        }
      end
    end
  end
end
