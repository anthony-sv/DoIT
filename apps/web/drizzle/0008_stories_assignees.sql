CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"board_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "story_id" uuid;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "assignee_id" uuid;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "estimate" double precision;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "card_id" uuid;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stories_board_id_index" ON "stories" USING btree ("board_id");--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_story_id_index" ON "cards" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "cards_assignee_id_index" ON "cards" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "todos_card_id_index" ON "todos" USING btree ("card_id");--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_estimate_check" CHECK ("cards"."estimate" is null or ("cards"."estimate" >= 0 and "cards"."estimate" <= 999));--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_color_check" CHECK ("cards"."color" in ('blue', 'purple', 'teal', 'red', 'amber', 'green', 'gray'));--> statement-breakpoint
CREATE POLICY "stories_member_all" ON "stories" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.has_board_access("stories"."board_id")) WITH CHECK (public.has_board_access("stories"."board_id"));