FactoryBot.define do
  factory :shared_media do
    user
    sequence(:normalized_prompt) { |n| NormalizePromptService.call("test-prompt-#{n}-#{SecureRandom.hex(4)}") }
    metadata { { "provider" => "openai" } }

    trait :with_file do
      after(:build) do |sm|
        sm.file.attach(
          io: StringIO.new("fake image payload"),
          filename: "#{SecureRandom.uuid}.png",
          content_type: "image/png"
        )
      end
    end
  end
end
