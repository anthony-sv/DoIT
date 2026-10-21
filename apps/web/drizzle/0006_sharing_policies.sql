ALTER TABLE "board_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "checklist_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "columns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "labels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sprints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "board_members_select" ON "board_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.has_board_access("board_members"."board_id"));--> statement-breakpoint
CREATE POLICY "board_members_delete" ON "board_members" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("board_members"."user_id" = (select auth.uid()) or public.is_board_owner("board_members"."board_id"));--> statement-breakpoint
CREATE POLICY "boards_select" ON "boards" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.has_board_access("boards"."id"));--> statement-breakpoint
CREATE POLICY "boards_insert" ON "boards" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("boards"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "boards_update" ON "boards" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.has_board_access("boards"."id")) WITH CHECK (public.has_board_access("boards"."id"));--> statement-breakpoint
CREATE POLICY "boards_delete" ON "boards" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("boards"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "card_events_member_all" ON "card_events" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.has_card_access("card_events"."card_id")) WITH CHECK (public.has_card_access("card_events"."card_id"));--> statement-breakpoint
CREATE POLICY "cards_member_all" ON "cards" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.has_board_access("cards"."board_id")) WITH CHECK (public.has_board_access("cards"."board_id"));--> statement-breakpoint
CREATE POLICY "checklist_items_member_all" ON "checklist_items" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.has_card_access("checklist_items"."card_id")) WITH CHECK (public.has_card_access("checklist_items"."card_id"));--> statement-breakpoint
CREATE POLICY "columns_member_all" ON "columns" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.has_board_access("columns"."board_id")) WITH CHECK (public.has_board_access("columns"."board_id"));--> statement-breakpoint
CREATE POLICY "labels_member_all" ON "labels" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.has_board_access("labels"."board_id")) WITH CHECK (public.has_board_access("labels"."board_id"));--> statement-breakpoint
CREATE POLICY "profiles_select" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profiles"."id" = (select auth.uid()) or public.shares_board_with("profiles"."id"));--> statement-breakpoint
CREATE POLICY "sprints_member_all" ON "sprints" AS PERMISSIVE FOR ALL TO "authenticated" USING (public.has_board_access("sprints"."board_id")) WITH CHECK (public.has_board_access("sprints"."board_id"));