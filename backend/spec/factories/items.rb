FactoryBot.define do
  factory :item do
    user
    item_type { ItemType.find_or_create_by!(name: "term") { |it| it.label = "単語" } }
    sequence(:title) { |n| "card-#{n}" }
    generation_status { "pending" }

    trait(:processing) { generation_status { "processing" } }
    trait(:completed)  { generation_status { "completed" } }

    trait :failed do
      generation_status { "failed" }
      metadata do
        {
          "generation_error" => "入力が曖昧なため画像を生成できませんでした。別の単語や具体的な表現でお試しください。",
          "generation_error_code" => "Faraday::BadRequestError"
        }
      end
    end
  end
end
