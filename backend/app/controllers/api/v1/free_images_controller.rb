module Api
  module V1
    # 自由な小見出しと、自由な指示で作る絵。
    #
    # カードの見出し語には縛られない。そのカードの中の一場面・対比・図解などを持てる。
    # 絵を1枚作るので、カードの絵と同じだけクレジットを使う。
    class FreeImagesController < BaseController
      before_action -> { deny_for_demo!(:generate_image) }

      MAX_PROMPT = ItemProperty::MAX_FREE_IMAGE_PROMPT

      def create
        item = current_user.items.find(params[:item_id])
        definition = current_user.property_definitions.find(params[:property_definition_id])
        return render_error("この項目は自由イメージではありません") unless definition.value_type == "free_image"

        heading = params[:heading].to_s.strip
        prompt = params[:prompt].to_s.strip
        return render_error("何を描くかを書いてください") if prompt.blank?
        return render_error("指示が長すぎます（#{MAX_PROMPT}文字以内）") if prompt.length > MAX_PROMPT
        return render_error(moderation_message) if blocked?(prompt)

        property = item.item_properties.find_or_initialize_by(property_definition_id: definition.id)
        return render_error("すでに作っています") if generating?(property)

        charge_and_enqueue!(item, property, heading, prompt)
        render json: { ok: true }, status: :accepted
      rescue User::InsufficientCredits
        render_error("クレジットが不足しています", status: :payment_required)
      end

      private

      def generating?(property)
        %w[pending processing].include?(property.typed_value.is_a?(Hash) ? property.typed_value["status"] : nil)
      end

      # **引いてから積む。** 先に積むと、残高が足りないのに作り始めることになる
      def charge_and_enqueue!(item, property, heading, prompt)
        current_user.ensure_current_period_credits!
        cost = ::Billing::CreditCost.call(kind: :free_image)

        current_user.with_lock do
          raise User::InsufficientCredits unless current_user.can_afford?(cost)

          current_user.consume_credits!(cost, item: item)
          property.typed_value = { "heading" => heading, "prompt" => prompt, "status" => "pending" }
          property.save!
        end

        GenerateFreeImageJob.perform_later(property.id, prompt)
      end

      def blocked?(prompt)
        result = Moderation::PromptModerator.call(prompt)
        return false if result.allowed?

        Rails.logger.warn("[Moderation] BLOCKED free_image user_id=#{current_user.id} category=#{result.category}")
        true
      end

      def moderation_message = "入力に利用できない表現が含まれています。別の言い方でお試しください。"

      def render_error(message, status: :unprocessable_entity)
        render json: { error: message }, status: status
      end
    end
  end
end
