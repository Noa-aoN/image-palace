FactoryBot.define do
  factory :credit_transaction do
    association :user
    kind { "consumption" }
    delta { -1 }
  end
end
