-- Generated in two steps (0005 tables and drops, 0006 policies) so drizzle-kit
-- didn't ask whether the new policies rename the old ones. RLS stays on.
CREATE TABLE "board_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card_events" ADD COLUMN "created_by" uuid DEFAULT auth.uid();--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "created_by" uuid DEFAULT auth.uid();--> statement-breakpoint
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "board_members_board_id_user_id_index" ON "board_members" USING btree ("board_id","user_id");--> statement-breakpoint
CREATE INDEX "board_members_user_id_index" ON "board_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
DROP POLICY "boards_owner_all" ON "boards" CASCADE;--> statement-breakpoint
DROP POLICY "card_events_owner_all" ON "card_events" CASCADE;--> statement-breakpoint
DROP POLICY "cards_owner_all" ON "cards" CASCADE;--> statement-breakpoint
DROP POLICY "checklist_items_owner_all" ON "checklist_items" CASCADE;--> statement-breakpoint
DROP POLICY "columns_owner_all" ON "columns" CASCADE;--> statement-breakpoint
DROP POLICY "labels_owner_all" ON "labels" CASCADE;--> statement-breakpoint
DROP POLICY "sprints_owner_all" ON "sprints" CASCADE;