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

ActiveRecord::Schema[8.1].define(version: 2026_03_25_103002) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pgcrypto"

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
    t.uuid "item_type_id", null: false
    t.jsonb "metadata", default: {}, null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["item_type_id"], name: "index_items_on_item_type_id"
    t.index ["user_id", "item_type_id"], name: "index_items_on_user_id_and_item_type_id"
    t.index ["user_id"], name: "index_items_on_user_id"
  end

  create_table "meanings", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "definition", null: false
    t.text "example_sentence"
    t.uuid "item_id", null: false
    t.string "language_code", default: "ja", null: false
    t.datetime "updated_at", null: false
    t.index ["item_id"], name: "index_meanings_on_item_id"
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
    t.datetime "created_at", null: false
    t.string "locale", default: "ja", null: false
    t.string "timezone", default: "Asia/Tokyo", null: false
    t.datetime "updated_at", null: false
  end

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "encrypted_password"
    t.string "name"
    t.string "role", default: "user", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "items", "item_types", on_delete: :restrict
  add_foreign_key "items", "users", on_delete: :cascade
  add_foreign_key "meanings", "items", on_delete: :cascade
  add_foreign_key "relations", "items", column: "from_item_id", on_delete: :cascade
  add_foreign_key "relations", "items", column: "to_item_id", on_delete: :cascade
  add_foreign_key "relations", "users", on_delete: :cascade
  add_foreign_key "settings", "users", on_delete: :cascade
end
