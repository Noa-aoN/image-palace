# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_08_27_010000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pg_trgm"
  enable_extension "pgcrypto"

  create_table "achievement_definitions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "category"
    t.jsonb "condition_params", default: {}, null: false
    t.integer "condition_target", default: 1, null: false
    t.string "condition_type", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.boolean "enabled", default: true, null: false
    t.datetime "ends_at"
    t.string "key", null: false
    t.boolean "limited", default: false, null: false
    t.string "name", null: false
    t.text "notify_body"
    t.string "notify_title"
    t.integer "position", default: 0, null: false
    t.boolean "published", default: true, null: false
    t.jsonb "rewards", default: [], null: false
    t.datetime "starts_at"
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_achievement_definitions_on_key", unique: true
  end

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.string "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "admin_audit_logs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "action", null: false
    t.string "actor_email"
    t.uuid "actor_id"
    t.datetime "created_at", null: false
    t.jsonb "details", default: {}, null: false
    t.uuid "target_id"
    t.string "target_type"
    t.index ["actor_id", "created_at"], name: "index_admin_audit_logs_on_actor_id_and_created_at"
    t.index ["created_at"], name: "index_admin_audit_logs_on_created_at"
  end

  create_table "admin_brief_actions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "admin_brief_id", null: false
    t.uuid "admin_insight_id"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.integer "position", default: 0, null: false
    t.string "status", default: "open", null: false
    t.text "title", null: false
    t.datetime "updated_at", null: false
    t.index ["admin_brief_id", "position"], name: "index_admin_brief_actions_on_admin_brief_id_and_position"
    t.index ["admin_brief_id"], name: "index_admin_brief_actions_on_admin_brief_id"
    t.index ["status"], name: "index_admin_brief_actions_on_status"
  end

  create_table "admin_briefs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.jsonb "completeness", default: {}, null: false
    t.integer "completion_tokens", default: 0, null: false
    t.integer "cost_points", default: 0, null: false
    t.datetime "created_at", null: false
    t.jsonb "facts", default: {}, null: false
    t.uuid "generated_by_id"
    t.string "model", null: false
    t.datetime "period_from", null: false
    t.string "period_key", null: false
    t.datetime "period_to", null: false
    t.integer "prompt_tokens", default: 0, null: false
    t.jsonb "summary", default: {}, null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_admin_briefs_on_created_at"
  end

  create_table "admin_insights", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "admin_brief_id", null: false
    t.string "confidence", null: false
    t.datetime "created_at", null: false
    t.datetime "dismissed_at"
    t.jsonb "evidence", default: [], null: false
    t.string "impact", null: false
    t.uuid "linked_initiative_id"
    t.text "observation", null: false
    t.integer "position", default: 0, null: false
    t.datetime "resolved_at"
    t.datetime "reviewed_at"
    t.string "status", default: "open", null: false
    t.text "suggested_action", null: false
    t.datetime "updated_at", null: false
    t.string "urgency", null: false
    t.index ["admin_brief_id", "position"], name: "index_admin_insights_on_admin_brief_id_and_position"
    t.index ["admin_brief_id"], name: "index_admin_insights_on_admin_brief_id"
    t.index ["status"], name: "index_admin_insights_on_status"
  end

  create_table "ai_models", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "credit_points"
    t.integer "daily_limit"
    t.boolean "default_for_kind", default: false, null: false
    t.text "description"
    t.boolean "enabled", default: true, null: false
    t.string "key", null: false
    t.string "kind", null: false
    t.string "label", null: false
    t.string "model_id", null: false
    t.text "notes"
    t.decimal "output_cost_usd", precision: 10, scale: 6
    t.integer "position", default: 0, null: false
    t.string "provider", null: false
    t.jsonb "purposes", default: [], null: false
    t.string "requires_env"
    t.decimal "unit_cost_usd", precision: 10, scale: 6
    t.datetime "updated_at", null: false
    t.boolean "visible", default: true, null: false
    t.index ["key"], name: "index_ai_models_on_key", unique: true
    t.index ["kind", "position"], name: "index_ai_models_on_kind_and_position"
  end

  create_table "ai_usages", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.integer "completion_tokens", default: 0, null: false
    t.integer "cost_points", default: 0, null: false
    t.datetime "created_at", null: false
    t.string "kind", null: false
    t.string "model", null: false
    t.integer "prompt_tokens", default: 0, null: false
    t.uuid "user_id"
    t.index ["user_id", "created_at"], name: "index_ai_usages_on_user_id_and_created_at"
    t.index ["user_id", "kind", "created_at"], name: "index_ai_usages_on_user_id_and_kind_and_created_at"
  end

  create_table "box_entries", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "box_id", null: false
    t.datetime "created_at", null: false
    t.uuid "entry_id", null: false
    t.string "entry_type", null: false
    t.integer "position"
    t.datetime "updated_at", null: false
    t.index ["box_id", "created_at", "id"], name: "index_box_entries_on_box_and_recency", order: { created_at: :desc, id: :desc }
    t.index ["box_id", "entry_type", "entry_id"], name: "index_collection_entries_uniqueness", unique: true
    t.index ["entry_type", "entry_id"], name: "index_box_entries_on_entry_type_and_entry_id"
  end

  create_table "box_items", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "box_id", null: false
    t.datetime "created_at", null: false
    t.uuid "item_id", null: false
    t.integer "position"
    t.datetime "updated_at", null: false
    t.index ["box_id", "item_id"], name: "index_box_items_on_box_id_and_item_id", unique: true
    t.index ["box_id"], name: "index_box_items_on_box_id"
  end

  create_table "boxes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.text "cover_generation_error"
    t.string "cover_generation_status"
    t.uuid "cover_item_id"
    t.string "cover_type", default: "first_card", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["cover_item_id"], name: "index_boxes_on_cover_item_id"
    t.index ["user_id", "created_at"], name: "index_boxes_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_boxes_on_user_id"
  end

  create_table "campaign_codes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.integer "amount", default: 0, null: false
    t.string "code", null: false
    t.datetime "created_at", null: false
    t.uuid "created_by_id"
    t.integer "credit_valid_days"
    t.boolean "enabled", default: true, null: false
    t.datetime "expires_at"
    t.string "item_kind"
    t.string "label", null: false
    t.integer "max_redemptions"
    t.text "notes"
    t.string "package_key"
    t.string "reward_type", default: "credits", null: false
    t.datetime "starts_at"
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_campaign_codes_on_code", unique: true
    t.index ["created_by_id"], name: "index_campaign_codes_on_created_by_id"
  end

  create_table "campaign_redemptions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "campaign_code_id", null: false
    t.datetime "created_at", null: false
    t.integer "points", default: 0, null: false
    t.uuid "user_id", null: false
    t.index ["campaign_code_id", "user_id"], name: "index_campaign_redemptions_on_campaign_code_id_and_user_id", unique: true
    t.index ["campaign_code_id"], name: "index_campaign_redemptions_on_campaign_code_id"
    t.index ["user_id"], name: "index_campaign_redemptions_on_user_id"
  end

  create_table "content_deliveries", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "channel", null: false
    t.datetime "created_at", null: false
    t.boolean "enabled", default: false, null: false
    t.string "package_key", null: false
    t.datetime "updated_at", null: false
    t.index ["channel", "enabled"], name: "index_content_deliveries_on_channel_and_enabled"
    t.index ["package_key", "channel"], name: "index_content_deliveries_on_package_key_and_channel", unique: true
  end

  create_table "content_exclusions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.uuid "item_id", null: false
    t.string "note"
    t.datetime "updated_at", null: false
    t.index ["item_id"], name: "index_content_exclusions_on_item_id", unique: true
  end

  create_table "content_installation_entries", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "content_installation_id", null: false
    t.datetime "created_at", null: false
    t.string "origin_key"
    t.string "package_local_key"
    t.uuid "record_id", null: false
    t.string "record_type", null: false
    t.datetime "updated_at", null: false
    t.index ["content_installation_id", "record_type", "record_id"], name: "index_cie_uniqueness", unique: true
    t.index ["content_installation_id"], name: "index_cie_on_installation"
    t.index ["record_type", "record_id"], name: "index_cie_on_record"
  end

  create_table "content_installations", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "installed_at", null: false
    t.string "package_key", null: false
    t.integer "package_version", null: false
    t.string "source", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["package_key", "package_version"], name: "index_content_installations_on_package_key_and_package_version"
    t.index ["user_id", "package_key"], name: "index_content_installations_unique_receipt", unique: true, where: "((source)::text <> 'preview'::text)"
    t.index ["user_id"], name: "index_content_installations_on_user_id"
    t.index ["user_id"], name: "index_content_installations_single_preview", unique: true, where: "((source)::text = 'preview'::text)"
  end

  create_table "content_packages", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "cover_image_key"
    t.datetime "created_at", null: false
    t.string "key", null: false
    t.string "kind", null: false
    t.string "name", null: false
    t.jsonb "payload", default: {}, null: false
    t.datetime "published_at"
    t.string "status", default: "draft", null: false
    t.text "summary"
    t.datetime "updated_at", null: false
    t.integer "version", null: false
    t.index ["key", "version"], name: "index_content_packages_on_key_and_version", unique: true
    t.index ["kind", "status"], name: "index_content_packages_on_kind_and_status"
  end

  create_table "cost_parameters", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "key", null: false
    t.text "note"
    t.datetime "updated_at", null: false
    t.decimal "value", precision: 14, scale: 6, null: false
    t.index ["key"], name: "index_cost_parameters_on_key", unique: true
  end

  create_table "credit_grants", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.integer "amount_points", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at"
    t.string "kind", null: false
    t.jsonb "metadata", default: {}, null: false
    t.integer "remaining_points", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["user_id", "expires_at"], name: "index_credit_grants_on_user_id_and_expires_at"
  end

  create_table "credit_transactions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.integer "amount_cents"
    t.datetime "created_at", null: false
    t.string "currency"
    t.integer "delta", null: false
    t.string "description"
    t.uuid "item_id"
    t.string "kind", null: false
    t.boolean "livemode"
    t.uuid "space_point_id"
    t.string "stripe_event_id"
    t.integer "subscription_credits_after"
    t.uuid "subscription_id"
    t.integer "topup_credits_after"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["livemode", "created_at"], name: "index_credit_transactions_on_livemode_and_created_at"
    t.index ["stripe_event_id"], name: "index_credit_transactions_on_stripe_event_id", unique: true, where: "(stripe_event_id IS NOT NULL)"
    t.index ["user_id", "created_at"], name: "index_credit_transactions_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_credit_transactions_on_user_id"
  end

  create_table "feature_flags", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "key", null: false
    t.text "notes"
    t.string "stage", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_feature_flags_on_key", unique: true
  end

  create_table "grant_policies", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.integer "amount", default: 0, null: false
    t.jsonb "conditions", default: {}, null: false
    t.datetime "created_at", null: false
    t.boolean "enabled", default: true, null: false
    t.string "item_kind"
    t.string "key", null: false
    t.text "notes"
    t.string "reward_type", default: "credits", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_grant_policies_on_key", unique: true
  end

  create_table "image_usages", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.boolean "cached", default: false, null: false
    t.datetime "created_at", null: false
    t.string "kind", null: false
    t.string "model", null: false
    t.string "provider", null: false
    t.string "quality"
    t.string "size"
    t.uuid "user_id"
    t.index ["created_at"], name: "index_image_usages_on_created_at"
    t.index ["model", "created_at"], name: "index_image_usages_on_model_and_created_at"
    t.index ["user_id"], name: "index_image_usages_on_user_id"
  end

  create_table "item_media_generations", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.uuid "item_id", null: false
    t.string "item_title"
    t.string "model"
    t.text "prompt"
    t.uuid "shared_media_id", null: false
    t.datetime "updated_at", null: false
    t.datetime "used_at", null: false
    t.index ["item_id", "shared_media_id"], name: "index_item_media_generations_on_item_id_and_shared_media_id", unique: true
    t.index ["item_id", "used_at"], name: "index_item_media_generations_on_item_id_and_used_at"
    t.index ["shared_media_id"], name: "index_item_media_generations_on_shared_media_id"
  end

  create_table "item_properties", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.uuid "item_id", null: false
    t.uuid "property_definition_id", null: false
    t.datetime "updated_at", null: false
    t.jsonb "value", default: {}, null: false
    t.index ["item_id", "property_definition_id"], name: "index_item_properties_on_item_and_definition", unique: true
    t.index ["item_id"], name: "index_item_properties_on_item_id"
    t.index ["property_definition_id"], name: "index_item_properties_on_property_definition_id"
  end

  create_table "item_reviews", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.uuid "item_id", null: false
    t.string "mode", null: false
    t.string "result", null: false
    t.datetime "reviewed_at", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["item_id", "reviewed_at"], name: "index_item_reviews_on_item_id_and_reviewed_at"
    t.index ["item_id"], name: "index_item_reviews_on_item_id"
    t.index ["user_id", "reviewed_at"], name: "index_item_reviews_on_user_id_and_reviewed_at"
    t.index ["user_id"], name: "index_item_reviews_on_user_id"
  end

  create_table "item_tags", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.uuid "item_id", null: false
    t.uuid "tag_id", null: false
    t.datetime "updated_at", null: false
    t.index ["item_id", "tag_id"], name: "index_item_tags_on_item_id_and_tag_id", unique: true
    t.index ["item_id"], name: "index_item_tags_on_item_id"
    t.index ["tag_id"], name: "index_item_tags_on_tag_id"
  end

  create_table "item_types", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "label", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_item_types_on_name", unique: true
  end

  create_table "items", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "aspect_ratio", default: "square", null: false
    t.datetime "brief_edited_at"
    t.string "brief_status", default: "none", null: false
    t.text "content"
    t.datetime "created_at", null: false
    t.string "generation_status", default: "pending", null: false
    t.text "image_description"
    t.string "image_model"
    t.uuid "item_type_id", null: false
    t.jsonb "metadata", default: {}, null: false
    t.text "scene_prompt"
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["generation_status"], name: "index_items_on_generation_status"
    t.index ["item_type_id"], name: "index_items_on_item_type_id"
    t.index ["user_id", "created_at"], name: "index_items_on_user_id_and_created_at"
    t.index ["user_id", "generation_status", "created_at"], name: "index_items_on_user_id_status_created_at"
    t.index ["user_id", "item_type_id"], name: "index_items_on_user_id_and_item_type_id"
    t.index ["user_id", "title", "created_at"], name: "index_items_on_user_id_title_created_at"
    t.index ["user_id"], name: "index_items_on_user_id"
  end

  create_table "meanings", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "definition", null: false
    t.string "detail_level", default: "simple", null: false
    t.text "example_sentence"
    t.datetime "fact_check_acknowledged_at"
    t.jsonb "fact_check_claims", default: [], null: false
    t.text "fact_check_comment"
    t.text "fact_check_known"
    t.string "fact_check_status"
    t.text "fact_check_suggestion"
    t.string "fact_check_title_suggestion"
    t.datetime "fact_checked_at"
    t.uuid "item_id", null: false
    t.string "kind", default: "meaning", null: false
    t.string "language_code", default: "ja", null: false
    t.integer "position"
    t.datetime "updated_at", null: false
    t.index ["item_id", "kind"], name: "index_meanings_on_item_id_and_kind"
    t.index ["item_id", "position"], name: "index_meanings_on_item_id_and_position"
    t.index ["item_id"], name: "index_meanings_on_item_id"
  end

  create_table "medias", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.uuid "item_id", null: false
    t.string "media_type", null: false
    t.jsonb "metadata", default: {}, null: false
    t.boolean "needs_approval", default: false, null: false
    t.integer "position"
    t.datetime "updated_at", null: false
    t.text "url"
    t.index ["item_id", "position"], name: "index_medias_on_item_id_and_position"
    t.index ["item_id"], name: "index_medias_on_item_id"
  end

  create_table "mission_definitions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "cadence", default: "onboarding", null: false
    t.jsonb "condition_params", default: {}, null: false
    t.integer "condition_target", default: 1, null: false
    t.string "condition_type", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.boolean "enabled", default: true, null: false
    t.datetime "ends_at"
    t.string "key", null: false
    t.uuid "mission_series_id"
    t.string "name", null: false
    t.text "notify_body"
    t.string "notify_title"
    t.integer "position", default: 0, null: false
    t.boolean "published", default: true, null: false
    t.jsonb "rewards", default: [], null: false
    t.integer "series_step", default: 0, null: false
    t.datetime "starts_at"
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_mission_definitions_on_key", unique: true
    t.index ["mission_series_id"], name: "index_mission_definitions_on_mission_series_id"
  end

  create_table "mission_series", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.boolean "enabled", default: true, null: false
    t.string "key", null: false
    t.string "name", null: false
    t.integer "position", default: 0, null: false
    t.boolean "published", default: true, null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_mission_series_on_key", unique: true
  end

  create_table "monthly_actuals", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "infra_jpy", default: 0, null: false
    t.integer "month", null: false
    t.text "note"
    t.integer "openai_jpy", default: 0, null: false
    t.integer "other_jpy", default: 0, null: false
    t.datetime "updated_at", null: false
    t.integer "year", null: false
    t.index ["year", "month"], name: "index_monthly_actuals_on_year_and_month", unique: true
  end

  create_table "notifications", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.text "body"
    t.datetime "created_at", null: false
    t.string "kind", null: false
    t.jsonb "payload", default: {}, null: false
    t.datetime "read_at"
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.string "url"
    t.uuid "user_id", null: false
    t.index ["user_id", "created_at"], name: "index_notifications_on_user_id_and_created_at"
    t.index ["user_id", "read_at"], name: "index_notifications_on_user_id_and_read_at"
  end

  create_table "plans", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.integer "credits_per_period", default: 0, null: false
    t.string "currency", default: "jpy", null: false
    t.string "image_key"
    t.string "interval"
    t.string "kind", default: "subscription", null: false
    t.jsonb "metadata", default: {}, null: false
    t.string "name", null: false
    t.integer "price_cents"
    t.string "stripe_price_id"
    t.string "stripe_product_id"
    t.string "tier"
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_plans_on_name", unique: true
    t.index ["stripe_price_id"], name: "index_plans_on_stripe_price_id", unique: true, where: "(stripe_price_id IS NOT NULL)"
  end

  create_table "posts", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "author_id"
    t.jsonb "body", default: [], null: false
    t.string "category", default: "news", null: false
    t.boolean "cover_visible", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "delivered_at"
    t.text "excerpt"
    t.boolean "pinned", default: false, null: false
    t.datetime "published_at"
    t.integer "reading_minutes"
    t.string "slug", null: false
    t.jsonb "tags", default: [], null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.integer "views_count", default: 0, null: false
    t.index ["category", "published_at"], name: "index_posts_on_category_and_published_at"
    t.index ["slug"], name: "index_posts_on_slug", unique: true
  end

  create_table "property_definitions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "category", default: "subject", null: false
    t.string "color"
    t.datetime "created_at", null: false
    t.text "description"
    t.uuid "item_type_id", null: false
    t.string "key", null: false
    t.string "label", null: false
    t.jsonb "options", default: [], null: false
    t.integer "position", default: 0, null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.string "value_type", default: "text", null: false
    t.index ["item_type_id"], name: "index_property_definitions_on_item_type_id"
    t.index ["user_id", "item_type_id", "category"], name: "index_property_definitions_on_user_type_category"
    t.index ["user_id", "item_type_id", "key"], name: "index_property_definitions_on_user_type_key", unique: true
    t.index ["user_id", "item_type_id", "position"], name: "index_property_definitions_on_user_type_position"
    t.index ["user_id"], name: "index_property_definitions_on_user_id"
  end

  create_table "provider_incidents", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "code"
    t.datetime "created_at", null: false
    t.datetime "first_occurred_at", null: false
    t.string "kind", null: false
    t.datetime "last_occurred_at", null: false
    t.text "message"
    t.integer "occurrences", default: 1, null: false
    t.string "provider", null: false
    t.datetime "updated_at", null: false
    t.index ["provider", "kind", "last_occurred_at"], name: "idx_on_provider_kind_last_occurred_at_8901aa37f7"
  end

  create_table "relations", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.uuid "from_item_id", null: false
    t.string "relation_type", null: false
    t.uuid "to_item_id", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["from_item_id"], name: "index_relations_on_from_item_id"
    t.index ["to_item_id"], name: "index_relations_on_to_item_id"
    t.index ["user_id", "from_item_id", "to_item_id", "relation_type"], name: "index_relations_on_unique_relation", unique: true
    t.index ["user_id"], name: "index_relations_on_user_id"
    t.check_constraint "from_item_id <> to_item_id", name: "check_no_self_relation"
  end

  create_table "reward_definitions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.boolean "admin_only", default: false, null: false
    t.string "category"
    t.datetime "created_at", null: false
    t.text "description"
    t.boolean "enabled", default: true, null: false
    t.datetime "ends_at"
    t.boolean "equippable", default: false, null: false
    t.boolean "featurable", default: false, null: false
    t.string "image_key"
    t.string "key", null: false
    t.string "kind", null: false
    t.boolean "limited", default: false, null: false
    t.jsonb "metadata", default: {}, null: false
    t.string "name", null: false
    t.text "notify_body"
    t.string "notify_title"
    t.integer "position", default: 0, null: false
    t.boolean "profile_visible", default: true, null: false
    t.boolean "published", default: true, null: false
    t.integer "rarity_level", default: 2, null: false
    t.boolean "room_displayable", default: false, null: false
    t.datetime "starts_at"
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_reward_definitions_on_key", unique: true
    t.index ["kind", "position"], name: "index_reward_definitions_on_kind_and_position"
  end

  create_table "settings", primary_key: "user_id", id: :uuid, default: nil, force: :cascade do |t|
    t.boolean "auto_detect_item_type", default: true, null: false
    t.boolean "auto_generate_meanings", default: true, null: false
    t.boolean "auto_generate_properties", default: false, null: false
    t.boolean "auto_generate_tags", default: true, null: false
    t.integer "card_detail_columns", default: 2, null: false
    t.jsonb "card_list_layout", default: [], null: false
    t.jsonb "card_property_presets", default: [], null: false
    t.datetime "created_at", null: false
    t.string "default_aspect_ratio", default: "square", null: false
    t.string "default_card_preset"
    t.string "default_image_style", default: "", null: false
    t.string "diagram_mode", default: "3d", null: false
    t.string "display_style", default: "palace", null: false
    t.boolean "image_safeguard", default: false, null: false
    t.integer "image_safeguard_level", default: 50, null: false
    t.string "image_safeguard_strength", default: "normal", null: false
    t.jsonb "library_order", default: [], null: false
    t.string "locale", default: "ja", null: false
    t.string "motion_mode", default: "auto", null: false
    t.boolean "nav_hints", default: true, null: false
    t.datetime "onboarded_at"
    t.string "palace_name"
    t.boolean "regenerate_with_meaning", default: false, null: false
    t.boolean "share_generated_images", default: true, null: false
    t.string "shelf_orientation", default: "rows", null: false
    t.string "timezone", default: "Asia/Tokyo", null: false
    t.datetime "updated_at", null: false
    t.string "word_difficulty", default: "normal", null: false
  end

  create_table "shared_briefs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description", null: false
    t.jsonb "metadata", default: {}, null: false
    t.string "normalized_source", null: false
    t.text "scene_prompt", null: false
    t.string "subject_kind", default: "concrete", null: false
    t.datetime "updated_at", null: false
    t.index ["normalized_source"], name: "index_shared_briefs_on_normalized_source", unique: true
  end

  create_table "shared_medias", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.jsonb "metadata", default: {}, null: false
    t.string "normalized_prompt", default: "", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id"
    t.index ["normalized_prompt"], name: "index_shared_medias_on_normalized_prompt", unique: true
    t.index ["user_id"], name: "index_shared_medias_on_user_id"
  end

  create_table "solid_queue_blocked_executions", force: :cascade do |t|
    t.string "concurrency_key", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "error"
    t.bigint "job_id", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", force: :cascade do |t|
    t.string "active_job_id"
    t.text "arguments"
    t.string "class_name", null: false
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "finished_at"
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at"
    t.datetime "updated_at", null: false
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "queue_name", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "hostname"
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.text "metadata"
    t.string "name", null: false
    t.integer "pid", null: false
    t.bigint "supervisor_id"
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.datetime "run_at", null: false
    t.string "task_key", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", force: :cascade do |t|
    t.text "arguments"
    t.string "class_name"
    t.string "command", limit: 2048
    t.datetime "created_at", null: false
    t.text "description"
    t.string "key", null: false
    t.integer "priority", default: 0
    t.string "queue_name"
    t.string "schedule", null: false
    t.boolean "static", default: true, null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.integer "value", default: 1, null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "space_boxes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "box_id", null: false
    t.datetime "created_at", null: false
    t.integer "position"
    t.uuid "space_id", null: false
    t.datetime "updated_at", null: false
    t.index ["space_id", "box_id"], name: "index_space_boxes_on_space_id_and_box_id", unique: true
    t.index ["space_id"], name: "index_space_boxes_on_space_id"
  end

  create_table "space_points", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "generation_status", default: "pending", null: false
    t.uuid "item_id"
    t.jsonb "metadata", default: {}, null: false
    t.string "name"
    t.integer "position", default: 0, null: false
    t.float "rotation_x", default: 0.0, null: false
    t.float "rotation_y", default: 0.0, null: false
    t.float "rotation_z", default: 0.0, null: false
    t.float "scale", default: 1.0, null: false
    t.uuid "space_id", null: false
    t.string "surface", default: "floor", null: false
    t.float "u", default: 0.5, null: false
    t.datetime "updated_at", null: false
    t.float "v", default: 0.5, null: false
    t.float "x", default: 0.0, null: false
    t.float "y", default: 0.0, null: false
    t.index ["space_id", "position"], name: "index_space_points_on_space_id_and_position"
    t.index ["space_id"], name: "index_space_points_on_space_id"
  end

  create_table "spaces", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.text "cover_generation_error"
    t.string "cover_generation_status"
    t.uuid "cover_space_point_id"
    t.string "cover_type", default: "first_card", null: false
    t.datetime "created_at", null: false
    t.float "depth", default: 4.0, null: false
    t.text "description"
    t.float "height", default: 2.6, null: false
    t.string "name", null: false
    t.float "point_scale", default: 1.0, null: false
    t.string "room_style", default: "ivory", null: false
    t.string "space_type", default: "room", null: false
    t.jsonb "style_overrides", default: {}, null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.float "width", default: 4.0, null: false
    t.index ["cover_space_point_id"], name: "index_spaces_on_cover_space_point_id"
    t.index ["user_id", "created_at"], name: "index_spaces_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_spaces_on_user_id"
  end

  create_table "strong_auth_sessions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "authenticated_at", null: false
    t.string "client_id", null: false
    t.datetime "created_at", null: false
    t.string "method"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["authenticated_at"], name: "index_strong_auth_sessions_on_authenticated_at"
    t.index ["user_id", "client_id"], name: "index_strong_auth_sessions_on_user_id_and_client_id", unique: true
    t.index ["user_id"], name: "index_strong_auth_sessions_on_user_id"
  end

  create_table "studio_usages", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.integer "cost_points", null: false
    t.datetime "created_at", null: false
    t.uuid "item_id"
    t.string "kind", null: false
    t.uuid "user_id", null: false
    t.index ["item_id"], name: "index_studio_usages_on_item_id"
    t.index ["user_id", "created_at"], name: "index_studio_usages_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_studio_usages_on_user_id"
  end

  create_table "subscriptions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.boolean "cancel_at_period_end", default: false, null: false
    t.datetime "canceled_at"
    t.datetime "created_at", null: false
    t.datetime "current_period_end"
    t.datetime "current_period_start"
    t.boolean "livemode"
    t.uuid "plan_id", null: false
    t.datetime "started_at", null: false
    t.string "status"
    t.string "stripe_customer_id"
    t.string "stripe_subscription_id"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["livemode", "status"], name: "index_subscriptions_on_livemode_and_status"
    t.index ["plan_id"], name: "index_subscriptions_on_plan_id"
    t.index ["stripe_customer_id"], name: "index_subscriptions_on_stripe_customer_id"
    t.index ["stripe_subscription_id"], name: "index_subscriptions_on_stripe_subscription_id", unique: true, where: "(stripe_subscription_id IS NOT NULL)"
    t.index ["user_id"], name: "index_subscriptions_on_user_id"
  end

  create_table "tag_group_items", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "position"
    t.uuid "tag_group_id", null: false
    t.uuid "tag_id", null: false
    t.datetime "updated_at", null: false
    t.index ["tag_group_id", "tag_id"], name: "index_tag_group_items_on_tag_group_id_and_tag_id", unique: true
    t.index ["tag_group_id"], name: "index_tag_group_items_on_tag_group_id"
    t.index ["tag_id"], name: "index_tag_group_items_on_tag_id"
  end

  create_table "tag_groups", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "default_key"
    t.boolean "is_default", default: false, null: false
    t.string "name", null: false
    t.boolean "pinned", default: false, null: false
    t.integer "position"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["user_id", "default_key"], name: "index_tag_groups_on_user_id_and_default_key", unique: true, where: "(default_key IS NOT NULL)"
    t.index ["user_id", "name"], name: "index_tag_groups_on_user_id_and_name", unique: true
    t.index ["user_id"], name: "index_tag_groups_on_user_id"
  end

  create_table "tags", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.boolean "is_default", default: false, null: false
    t.string "name", null: false
    t.boolean "pinned", default: false, null: false
    t.integer "position"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["user_id", "name"], name: "index_tags_on_user_id_and_name", unique: true
    t.index ["user_id"], name: "index_tags_on_user_id"
  end

  create_table "trial_grant_records", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "identifier_digest", null: false
    t.string "source", null: false
    t.index ["identifier_digest"], name: "index_trial_grant_records_on_identifier_digest", unique: true
  end

  create_table "user_achievements", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "achievement_definition_id", null: false
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.integer "progress", default: 0, null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["achievement_definition_id"], name: "index_user_achievements_on_achievement_definition_id"
    t.index ["user_id", "achievement_definition_id"], name: "index_user_achievements_unique", unique: true
    t.index ["user_id"], name: "index_user_achievements_on_user_id"
  end

  create_table "user_activity_days", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.date "on_date", null: false
    t.uuid "user_id", null: false
    t.index ["on_date"], name: "index_user_activity_days_on_on_date"
    t.index ["user_id", "on_date"], name: "index_user_activity_days_on_user_id_and_on_date", unique: true
  end

  create_table "user_missions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.uuid "mission_definition_id", null: false
    t.string "period_key", default: "-", null: false
    t.integer "progress", default: 0, null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["mission_definition_id"], name: "index_user_missions_on_mission_definition_id"
    t.index ["user_id", "mission_definition_id", "period_key"], name: "index_user_missions_unique", unique: true
    t.index ["user_id"], name: "index_user_missions_on_user_id"
  end

  create_table "user_reward_grants", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "event_key"
    t.datetime "granted_at", null: false
    t.uuid "reward_definition_id", null: false
    t.string "source", default: "achievement", null: false
    t.string "source_ref"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["reward_definition_id"], name: "index_user_reward_grants_on_reward_definition_id"
    t.index ["user_id", "event_key"], name: "index_reward_grants_on_user_and_event_key", unique: true
    t.index ["user_id", "reward_definition_id", "granted_at"], name: "index_reward_grants_on_user_definition_granted"
    t.index ["user_id"], name: "index_user_reward_grants_on_user_id"
  end

  create_table "user_rewards", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.boolean "equipped", default: false, null: false
    t.datetime "featured_at"
    t.datetime "first_acquired_at"
    t.datetime "granted_at", null: false
    t.datetime "last_acquired_at"
    t.integer "quantity", default: 1, null: false
    t.datetime "revoked_at"
    t.uuid "reward_definition_id", null: false
    t.boolean "room_placed", default: false, null: false
    t.string "source", default: "achievement", null: false
    t.string "source_ref"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["reward_definition_id"], name: "index_user_rewards_on_reward_definition_id"
    t.index ["user_id", "equipped"], name: "index_user_rewards_on_user_id_and_equipped"
    t.index ["user_id", "revoked_at"], name: "index_user_rewards_held_on_user_id", where: "(revoked_at IS NULL)"
    t.index ["user_id", "reward_definition_id"], name: "index_user_rewards_on_user_id_and_reward_definition_id", unique: true
    t.index ["user_id"], name: "index_user_rewards_on_user_id"
    t.check_constraint "quantity >= 1", name: "user_rewards_quantity_positive"
  end

  create_table "user_stats", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.integer "achievements_completed", default: 0, null: false
    t.integer "active_days", default: 0, null: false
    t.integer "cards_created", default: 0, null: false
    t.datetime "computed_at"
    t.integer "containers_created", default: 0, null: false
    t.datetime "created_at", null: false
    t.integer "images_generated", default: 0, null: false
    t.integer "longest_streak", default: 0, null: false
    t.integer "reviews_correct", default: 0, null: false
    t.integer "reviews_total", default: 0, null: false
    t.integer "rewards_earned", default: 0, null: false
    t.integer "streak_days", default: 0, null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["user_id"], name: "index_user_stats_on_user_id", unique: true
  end

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.boolean "allow_password_change", default: false, null: false
    t.string "avatar_generation_error"
    t.string "avatar_generation_status"
    t.datetime "confirmation_sent_at"
    t.string "confirmation_token"
    t.datetime "confirmed_at"
    t.datetime "created_at", null: false
    t.datetime "credits_period_start"
    t.string "demo_client_key"
    t.string "email", null: false
    t.string "encrypted_password"
    t.datetime "last_seen_at"
    t.string "name"
    t.string "provider", default: "email", null: false
    t.datetime "reauthenticated_at"
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.string "role", default: "user", null: false
    t.string "stripe_customer_id"
    t.datetime "stripe_reconciled_at"
    t.integer "subscription_credits", default: 0, null: false
    t.jsonb "tokens", default: {}
    t.integer "topup_credits", default: 0, null: false
    t.datetime "totp_confirmed_at"
    t.jsonb "totp_recovery_codes", default: [], null: false
    t.text "totp_secret"
    t.datetime "trial_granted_at"
    t.string "uid", default: "", null: false
    t.string "unconfirmed_email"
    t.datetime "updated_at", null: false
    t.string "webauthn_id"
    t.index ["confirmation_token"], name: "index_users_on_confirmation_token", unique: true
    t.index ["demo_client_key"], name: "index_users_on_demo_client_key", unique: true, where: "(demo_client_key IS NOT NULL)"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["last_seen_at"], name: "index_users_on_last_seen_at"
    t.index ["provider", "uid"], name: "index_users_on_provider_and_uid", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["stripe_customer_id"], name: "index_users_on_stripe_customer_id", unique: true
    t.index ["webauthn_id"], name: "index_users_on_webauthn_id", unique: true
  end

  create_table "view_edges", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "label"
    t.jsonb "points", default: [], null: false
    t.string "source_handle"
    t.string "source_node_id", null: false
    t.jsonb "style", default: {}, null: false
    t.string "target_handle"
    t.string "target_node_id", null: false
    t.datetime "updated_at", null: false
    t.uuid "view_id", null: false
    t.integer "z_index", default: 0, null: false
    t.index ["view_id"], name: "index_view_edges_on_view_id"
  end

  create_table "view_items", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.float "height"
    t.uuid "item_id", null: false
    t.integer "position"
    t.uuid "space_point_id"
    t.datetime "updated_at", null: false
    t.uuid "view_id", null: false
    t.float "width"
    t.float "x", default: 0.0, null: false
    t.float "y", default: 0.0, null: false
    t.integer "z_index", default: 0, null: false
    t.index ["space_point_id"], name: "index_view_items_on_space_point_id"
    t.index ["view_id", "item_id"], name: "index_view_items_on_view_and_item_freeboard", unique: true, where: "(space_point_id IS NULL)"
    t.index ["view_id", "space_point_id"], name: "index_view_items_on_view_and_space_point", unique: true, where: "(space_point_id IS NOT NULL)"
    t.index ["view_id"], name: "index_view_items_on_view_id"
  end

  create_table "view_revisions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "label"
    t.integer "position", null: false
    t.jsonb "state", default: {}, null: false
    t.uuid "view_id", null: false
    t.index ["view_id", "position"], name: "index_view_revisions_on_view_id_and_position", unique: true
  end

  create_table "views", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.text "cover_generation_error"
    t.string "cover_generation_status"
    t.uuid "cover_item_id"
    t.string "cover_type", default: "first_card", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.integer "revision_cursor", default: 0, null: false
    t.jsonb "settings", default: {}, null: false
    t.uuid "space_id"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.string "view_type", default: "freeboard", null: false
    t.index ["cover_item_id"], name: "index_views_on_cover_item_id"
    t.index ["space_id"], name: "index_views_on_space_id"
    t.index ["user_id", "created_at"], name: "index_views_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_views_on_user_id"
  end

  create_table "webauthn_challenges", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "challenge", null: false
    t.datetime "consumed_at"
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "purpose", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id"
    t.index ["challenge", "purpose"], name: "index_webauthn_challenges_on_challenge_and_purpose", unique: true
    t.index ["expires_at"], name: "index_webauthn_challenges_on_expires_at"
    t.index ["user_id"], name: "index_webauthn_challenges_on_user_id"
  end

  create_table "webauthn_credentials", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "external_id", null: false
    t.datetime "last_used_at"
    t.string "nickname"
    t.string "public_key", null: false
    t.bigint "sign_count", default: 0, null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["external_id"], name: "index_webauthn_credentials_on_external_id", unique: true
    t.index ["user_id"], name: "index_webauthn_credentials_on_user_id"
  end

  create_table "wordlists", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.string "words", default: [], null: false, array: true
    t.index ["user_id", "created_at"], name: "index_wordlists_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_wordlists_on_user_id"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "admin_audit_logs", "users", column: "actor_id", on_delete: :nullify
  add_foreign_key "admin_brief_actions", "admin_briefs"
  add_foreign_key "admin_brief_actions", "admin_insights"
  add_foreign_key "admin_briefs", "users", column: "generated_by_id"
  add_foreign_key "admin_insights", "admin_briefs"
  add_foreign_key "ai_usages", "users", on_delete: :cascade
  add_foreign_key "box_entries", "boxes", on_delete: :cascade
  add_foreign_key "box_items", "boxes", on_delete: :cascade
  add_foreign_key "box_items", "items", on_delete: :cascade
  add_foreign_key "boxes", "items", column: "cover_item_id", on_delete: :nullify
  add_foreign_key "boxes", "users", on_delete: :cascade
  add_foreign_key "campaign_codes", "users", column: "created_by_id"
  add_foreign_key "campaign_redemptions", "campaign_codes"
  add_foreign_key "campaign_redemptions", "users"
  add_foreign_key "content_exclusions", "items", on_delete: :cascade
  add_foreign_key "content_installation_entries", "content_installations"
  add_foreign_key "content_installations", "users"
  add_foreign_key "credit_grants", "users"
  add_foreign_key "credit_transactions", "users", on_delete: :cascade
  add_foreign_key "item_media_generations", "items"
  add_foreign_key "item_media_generations", "shared_medias"
  add_foreign_key "item_properties", "items"
  add_foreign_key "item_properties", "property_definitions"
  add_foreign_key "item_reviews", "items"
  add_foreign_key "item_reviews", "users"
  add_foreign_key "item_tags", "items", on_delete: :cascade
  add_foreign_key "item_tags", "tags", on_delete: :cascade
  add_foreign_key "items", "item_types", on_delete: :restrict
  add_foreign_key "items", "users", on_delete: :cascade
  add_foreign_key "meanings", "items", on_delete: :cascade
  add_foreign_key "medias", "items", on_delete: :cascade
  add_foreign_key "mission_definitions", "mission_series"
  add_foreign_key "notifications", "users", on_delete: :cascade
  add_foreign_key "posts", "users", column: "author_id", on_delete: :nullify
  add_foreign_key "property_definitions", "item_types"
  add_foreign_key "property_definitions", "users"
  add_foreign_key "relations", "items", column: "from_item_id", on_delete: :cascade
  add_foreign_key "relations", "items", column: "to_item_id", on_delete: :cascade
  add_foreign_key "relations", "users", on_delete: :cascade
  add_foreign_key "settings", "users", on_delete: :cascade
  add_foreign_key "shared_medias", "users", on_delete: :nullify
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "space_boxes", "boxes", on_delete: :cascade
  add_foreign_key "space_boxes", "spaces", on_delete: :cascade
  add_foreign_key "space_points", "items", on_delete: :nullify
  add_foreign_key "space_points", "spaces", on_delete: :cascade
  add_foreign_key "spaces", "space_points", column: "cover_space_point_id", on_delete: :nullify
  add_foreign_key "spaces", "users", on_delete: :cascade
  add_foreign_key "strong_auth_sessions", "users"
  add_foreign_key "studio_usages", "items", on_delete: :nullify
  add_foreign_key "studio_usages", "users"
  add_foreign_key "subscriptions", "plans", on_delete: :restrict
  add_foreign_key "subscriptions", "users", on_delete: :cascade
  add_foreign_key "tag_group_items", "tag_groups"
  add_foreign_key "tag_group_items", "tags"
  add_foreign_key "tag_groups", "users"
  add_foreign_key "tags", "users", on_delete: :cascade
  add_foreign_key "user_achievements", "achievement_definitions"
  add_foreign_key "user_achievements", "users"
  add_foreign_key "user_activity_days", "users"
  add_foreign_key "user_missions", "mission_definitions"
  add_foreign_key "user_missions", "users"
  add_foreign_key "user_reward_grants", "reward_definitions"
  add_foreign_key "user_reward_grants", "users"
  add_foreign_key "user_rewards", "reward_definitions"
  add_foreign_key "user_rewards", "users"
  add_foreign_key "user_stats", "users"
  add_foreign_key "view_edges", "views"
  add_foreign_key "view_items", "items", on_delete: :cascade
  add_foreign_key "view_items", "space_points", on_delete: :cascade
  add_foreign_key "view_items", "views", on_delete: :cascade
  add_foreign_key "view_revisions", "views", on_delete: :cascade
  add_foreign_key "views", "items", column: "cover_item_id", on_delete: :nullify
  add_foreign_key "views", "spaces", on_delete: :nullify
  add_foreign_key "views", "users", on_delete: :cascade
  add_foreign_key "webauthn_challenges", "users"
  add_foreign_key "webauthn_credentials", "users"
  add_foreign_key "wordlists", "users", on_delete: :cascade
end
