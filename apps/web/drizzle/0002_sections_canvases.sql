CREATE TABLE "canvases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"position" double precision NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canvases_kind_check" CHECK ("canvases"."kind" in ('whiteboard', 'diagram'))
);
--> statement-breakpoint
ALTER TABLE "canvases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "todo_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"name" text NOT NULL,
	"position" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todo_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_sections" ADD CONSTRAINT "todo_sections_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canvases_owner_id_index" ON "canvases" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "todo_sections_owner_id_index" ON "todo_sections" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_section_id_todo_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."todo_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todos_section_id_index" ON "todos" USING btree ("section_id");--> statement-breakpoint
CREATE POLICY "canvases_owner_all" ON "canvases" AS PERMISSIVE FOR ALL TO "authenticated" USING ("canvases"."owner_id" = (select auth.uid())) WITH CHECK ("canvases"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "todo_sections_owner_all" ON "todo_sections" AS PERMISSIVE FOR ALL TO "authenticated" USING ("todo_sections"."owner_id" = (select auth.uid())) WITH CHECK ("todo_sections"."owner_id" = (select auth.uid()));