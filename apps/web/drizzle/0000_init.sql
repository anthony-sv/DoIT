CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"color" text DEFAULT 'blue' NOT NULL,
	"position" double precision NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boards_color_check" CHECK ("boards"."color" in ('blue', 'purple', 'teal', 'red', 'amber', 'green', 'gray'))
);
--> statement-breakpoint
ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "card_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"card_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"board_id" uuid NOT NULL,
	"column_id" uuid NOT NULL,
	"sprint_id" uuid,
	"number" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"due_on" date,
	"label_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"position" double precision NOT NULL,
	"backlog_position" double precision NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cards_priority_check" CHECK ("cards"."priority" in ('low', 'medium', 'high', 'urgent'))
);
--> statement-breakpoint
ALTER TABLE "cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"card_id" uuid NOT NULL,
	"text" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"position" double precision NOT NULL,
	"wip_limit" integer,
	"is_done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "columns_color_check" CHECK ("columns"."color" in ('blue', 'purple', 'teal', 'red', 'amber', 'green', 'gray')),
	CONSTRAINT "columns_wip_limit_check" CHECK ("columns"."wip_limit" is null or "columns"."wip_limit" > 0)
);
--> statement-breakpoint
ALTER TABLE "columns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "labels_color_check" CHECK ("labels"."color" in ('blue', 'purple', 'teal', 'red', 'amber', 'green', 'gray'))
);
--> statement-breakpoint
ALTER TABLE "labels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"state" text DEFAULT 'planned' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprints_state_check" CHECK ("sprints"."state" in ('planned', 'active', 'closed')),
	CONSTRAINT "sprints_dates_check" CHECK ("sprints"."ends_on" >= "sprints"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "sprints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"text" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"due_on" date,
	"position" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_column_id_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "columns" ADD CONSTRAINT "columns_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "columns" ADD CONSTRAINT "columns_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boards_owner_id_index" ON "boards" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "card_events_card_id_index" ON "card_events" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "cards_board_id_index" ON "cards" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "cards_column_id_index" ON "cards" USING btree ("column_id");--> statement-breakpoint
CREATE INDEX "cards_sprint_id_index" ON "cards" USING btree ("sprint_id");--> statement-breakpoint
CREATE INDEX "checklist_items_card_id_index" ON "checklist_items" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "columns_board_id_index" ON "columns" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "labels_board_id_index" ON "labels" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "sprints_board_id_index" ON "sprints" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "todos_owner_id_index" ON "todos" USING btree ("owner_id");--> statement-breakpoint
CREATE POLICY "boards_owner_all" ON "boards" AS PERMISSIVE FOR ALL TO "authenticated" USING ("boards"."owner_id" = (select auth.uid())) WITH CHECK ("boards"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "card_events_owner_all" ON "card_events" AS PERMISSIVE FOR ALL TO "authenticated" USING ("card_events"."owner_id" = (select auth.uid())) WITH CHECK ("card_events"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "cards_owner_all" ON "cards" AS PERMISSIVE FOR ALL TO "authenticated" USING ("cards"."owner_id" = (select auth.uid())) WITH CHECK ("cards"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "checklist_items_owner_all" ON "checklist_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("checklist_items"."owner_id" = (select auth.uid())) WITH CHECK ("checklist_items"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "columns_owner_all" ON "columns" AS PERMISSIVE FOR ALL TO "authenticated" USING ("columns"."owner_id" = (select auth.uid())) WITH CHECK ("columns"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "labels_owner_all" ON "labels" AS PERMISSIVE FOR ALL TO "authenticated" USING ("labels"."owner_id" = (select auth.uid())) WITH CHECK ("labels"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "sprints_owner_all" ON "sprints" AS PERMISSIVE FOR ALL TO "authenticated" USING ("sprints"."owner_id" = (select auth.uid())) WITH CHECK ("sprints"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "todos_owner_all" ON "todos" AS PERMISSIVE FOR ALL TO "authenticated" USING ("todos"."owner_id" = (select auth.uid())) WITH CHECK ("todos"."owner_id" = (select auth.uid()));