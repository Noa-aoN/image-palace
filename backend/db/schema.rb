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

ActiveRecord::Schema[8.1].define(version: 2026_06_30_000001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pgcrypto"

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

  create_table "collection_entries", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "collection_id", null: false
    t.datetime "created_at", null: false
    t.uuid "entry_id", null: false
    t.string "entry_type", null: false
    t.integer "position"
    t.datetime "updated_at", null: false
    t.index ["collection_id", "entry_type", "entry_id"], name: "index_collection_entries_uniqueness", unique: true
    t.index ["collection_id"], name: "index_collection_entries_on_collection_id"
    t.index ["entry_type", "entry_id"], name: "index_collection_entries_on_entry_type_and_entry_id"
  end

  create_table "collection_items", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "collection_id", null: false
    t.datetime "created_at", null: false
    t.uuid "item_id", null: false
    t.integer "position"
    t.datetime "updated_at", null: false
    t.index ["collection_id", "item_id"], name: "index_collection_items_on_collection_id_and_item_id", unique: true
    t.index ["collection_id"], name: "index_collection_items_on_collection_id"
  end

  create_table "collections", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "cover_item_id"
    t.string "cover_type", default: "first_card", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["cover_item_id"], name: "index_collections_on_cover_item_id"
    t.index ["user_id", "created_at"], name: "index_collections_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_collections_on_user_id"
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
    t.datetime "created_at", null: false
    t.integer "delta", null: false
    t.string "description"
    t.uuid "item_id"
    t.string "kind", null: false
    t.uuid "space_point_id"
    t.string "stripe_event_id"
    t.integer "subscription_credits_after"
    t.uuid "subscription_id"
    t.integer "topup_credits_after"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["stripe_event_id"], name: "index_credit_transactions_on_stripe_event_id", unique: true, where: "(stripe_event_id IS NOT NULL)"
    t.index ["user_id", "created_at"], name: "index_credit_transactions_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_credit_transactions_on_user_id"
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
    t.text "content"
    t.datetime "created_at", null: false
    t.string "generation_status", default: "pending", null: false
    t.uuid "item_type_id", null: false
    t.jsonb "metadata", default: {}, null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["generation_status"], name: "index_items_on_generation_status"
    t.index ["item_type_id"], name: "index_items_on_item_type_id"
    t.index ["user_id", "item_type_id"], name: "index_items_on_user_id_and_item_type_id"
    t.index ["user_id"], name: "index_items_on_user_id"
  end

  create_table "meanings", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "definition", null: false
    t.string "detail_level", default: "simple", null: false
    t.text "example_sentence"
    t.text "fact_check_comment"
    t.string "fact_check_status"
    t.text "fact_check_suggestion"
    t.string "fact_check_title_suggestion"
    t.datetime "fact_checked_at"
    t.uuid "item_id", null: false
    t.string "language_code", default: "ja", null: false
    t.datetime "updated_at", null: false
    t.index ["item_id"], name: "index_meanings_on_item_id"
  end

  create_table "medias", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.uuid "item_id", null: false
    t.string "media_type", null: false
    t.jsonb "metadata", default: {}, null: false
    t.integer "position"
    t.datetime "updated_at", null: false
    t.text "url"
    t.index ["item_id", "position"], name: "index_medias_on_item_id_and_position"
    t.index ["item_id"], name: "index_medias_on_item_id"
  end

  create_table "plans", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.integer "credits_per_period", default: 0, null: false
    t.string "currency", default: "jpy", null: false
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

  create_table "settings", primary_key: "user_id", id: :uuid, default: nil, force: :cascade do |t|
    t.boolean "auto_generate_meanings", default: true, null: false
    t.boolean "auto_generate_tags", default: true, null: false
    t.datetime "created_at", null: false
    t.string "default_image_style", default: "", null: false
    t.string "locale", default: "ja", null: false
    t.string "timezone", default: "Asia/Tokyo", null: false
    t.datetime "updated_at", null: false
  end

  create_table "shared_medias", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.jsonb "metadata", default: {}, null: false
    t.string "normalized_prompt", default: "", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id"
    t.index ["normalized_prompt"], name: "index_shared_medias_on_normalized_prompt"
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

  create_table "space_collections", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "collection_id", null: false
    t.datetime "created_at", null: false
    t.integer "position"
    t.uuid "space_id", null: false
    t.datetime "updated_at", null: false
    t.index ["space_id", "collection_id"], name: "index_space_collections_on_space_id_and_collection_id", unique: true
    t.index ["space_id"], name: "index_space_collections_on_space_id"
  end

  create_table "space_points", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "generation_status", default: "pending", null: false
    t.uuid "item_id"
    t.jsonb "metadata", default: {}, null: false
    t.string "name"
    t.integer "position", default: 0, null: false
    t.uuid "space_id", null: false
    t.datetime "updated_at", null: false
    t.float "x", default: 0.0, null: false
    t.float "y", default: 0.0, null: false
    t.index ["space_id", "position"], name: "index_space_points_on_space_id_and_position"
    t.index ["space_id"], name: "index_space_points_on_space_id"
  end

  create_table "spaces", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "cover_space_point_id"
    t.string "cover_type", default: "first_card", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name", null: false
    t.string "space_type", default: "room", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["cover_space_point_id"], name: "index_spaces_on_cover_space_point_id"
    t.index ["user_id", "created_at"], name: "index_spaces_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_spaces_on_user_id"
  end

  create_table "subscriptions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.boolean "cancel_at_period_end", default: false, null: false
    t.datetime "canceled_at"
    t.datetime "created_at", null: false
    t.datetime "current_period_end"
    t.datetime "current_period_start"
    t.uuid "plan_id", null: false
    t.datetime "started_at", null: false
    t.string "status"
    t.string "stripe_customer_id"
    t.string "stripe_subscription_id"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["plan_id"], name: "index_subscriptions_on_plan_id"
    t.index ["stripe_customer_id"], name: "index_subscriptions_on_stripe_customer_id"
    t.index ["stripe_subscription_id"], name: "index_subscriptions_on_stripe_subscription_id", unique: true, where: "(stripe_subscription_id IS NOT NULL)"
    t.index ["user_id"], name: "index_subscriptions_on_user_id"
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

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.boolean "allow_password_change", default: false, null: false
    t.datetime "confirmation_sent_at"
    t.string "confirmation_token"
    t.datetime "confirmed_at"
    t.datetime "created_at", null: false
    t.datetime "credits_period_start"
    t.string "email", null: false
    t.string "encrypted_password"
    t.string "name"
    t.string "provider", default: "email", null: false
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.string "role", default: "user", null: false
    t.string "stripe_customer_id"
    t.integer "subscription_credits", default: 0, null: false
    t.jsonb "tokens", default: {}
    t.integer "topup_credits", default: 0, null: false
    t.string "uid", default: "", null: false
    t.string "unconfirmed_email"
    t.datetime "updated_at", null: false
    t.index ["confirmation_token"], name: "index_users_on_confirmation_token", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["provider", "uid"], name: "index_users_on_provider_and_uid", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["stripe_customer_id"], name: "index_users_on_stripe_customer_id", unique: true
  end

  create_table "view_items", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.uuid "item_id", null: false
    t.integer "position"
    t.uuid "space_point_id"
    t.datetime "updated_at", null: false
    t.uuid "view_id", null: false
    t.float "x", default: 0.0, null: false
    t.float "y", default: 0.0, null: false
    t.integer "z_index", default: 0, null: false
    t.index ["space_point_id"], name: "index_view_items_on_space_point_id"
    t.index ["view_id", "item_id"], name: "index_view_items_on_view_and_item_freeboard", unique: true, where: "(space_point_id IS NULL)"
    t.index ["view_id", "space_point_id"], name: "index_view_items_on_view_and_space_point", unique: true, where: "(space_point_id IS NOT NULL)"
    t.index ["view_id"], name: "index_view_items_on_view_id"
  end

  create_table "views", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "cover_item_id"
    t.string "cover_type", default: "first_card", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.uuid "space_id"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.string "view_type", default: "freeboard", null: false
    t.index ["cover_item_id"], name: "index_views_on_cover_item_id"
    t.index ["space_id"], name: "index_views_on_space_id"
    t.index ["user_id", "created_at"], name: "index_views_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_views_on_user_id"
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
  add_foreign_key "collection_entries", "collections", on_delete: :cascade
  add_foreign_key "collection_items", "collections", on_delete: :cascade
  add_foreign_key "collection_items", "items", on_delete: :cascade
  add_foreign_key "collections", "items", column: "cover_item_id", on_delete: :nullify
  add_foreign_key "collections", "users", on_delete: :cascade
  add_foreign_key "credit_grants", "users"
  add_foreign_key "credit_transactions", "users", on_delete: :cascade
  add_foreign_key "item_tags", "items", on_delete: :cascade
  add_foreign_key "item_tags", "tags", on_delete: :cascade
  add_foreign_key "items", "item_types", on_delete: :restrict
  add_foreign_key "items", "users", on_delete: :cascade
  add_foreign_key "meanings", "items", on_delete: :cascade
  add_foreign_key "medias", "items", on_delete: :cascade
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
  add_foreign_key "space_collections", "collections", on_delete: :cascade
  add_foreign_key "space_collections", "spaces", on_delete: :cascade
  add_foreign_key "space_points", "items", on_delete: :nullify
  add_foreign_key "space_points", "spaces", on_delete: :cascade
  add_foreign_key "spaces", "space_points", column: "cover_space_point_id", on_delete: :nullify
  add_foreign_key "spaces", "users", on_delete: :cascade
  add_foreign_key "subscriptions", "plans", on_delete: :restrict
  add_foreign_key "subscriptions", "users", on_delete: :cascade
  add_foreign_key "tags", "users", on_delete: :cascade
  add_foreign_key "view_items", "items", on_delete: :cascade
  add_foreign_key "view_items", "space_points", on_delete: :cascade
  add_foreign_key "view_items", "views", on_delete: :cascade
  add_foreign_key "views", "items", column: "cover_item_id", on_delete: :nullify
  add_foreign_key "views", "spaces", on_delete: :nullify
  add_foreign_key "views", "users", on_delete: :cascade
  add_foreign_key "wordlists", "users", on_delete: :cascade
end
