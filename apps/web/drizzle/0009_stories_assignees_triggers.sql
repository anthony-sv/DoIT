-- Stories, assignees and todos linked to cards (0008). As in 0007, the checks
-- run as the caller, so a row can only point at what the caller can open.

-- Columns, sprints, labels and now stories: as in 0007, plus a row never
-- moves to another board. A member of two boards could otherwise carry a
-- story (or column, sprint) off to their own board and leave its cards
-- pointing at a row on the wrong board.
CREATE OR REPLACE FUNCTION public.check_board_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  board_owner uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.board_id IS DISTINCT FROM OLD.board_id THEN
    RAISE EXCEPTION 'a row can''t move to another board' USING ERRCODE = 'check_violation';
  END IF;
  SELECT b.owner_id INTO board_owner FROM public.boards b WHERE b.id = NEW.board_id;
  IF board_owner IS NULL THEN
    RAISE EXCEPTION 'board not found' USING ERRCODE = 'check_violation';
  END IF;
  NEW.owner_id = board_owner;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

-- Stories belong to their board's owner, like columns, sprints and labels.
CREATE TRIGGER stories_check_owner BEFORE INSERT OR UPDATE ON public.stories
FOR EACH ROW EXECUTE FUNCTION public.check_board_owner();
--> statement-breakpoint

-- Cards, as in 0007, and now also: the story must be on the same board, and
-- the assignee must be the board's owner or one of its members. An update
-- checks only what it changes: an unchanged reference was checked when it was
-- set, and the system's own updates (unassigning someone who left, the
-- SET NULLs of a deleted story, sprint or account) must not trip over it.
CREATE OR REPLACE FUNCTION public.cards_check_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  board_owner uuid;
  moved boolean;
BEGIN
  SELECT b.owner_id INTO board_owner FROM public.boards b WHERE b.id = NEW.board_id;
  IF board_owner IS NULL THEN
    RAISE EXCEPTION 'board not found' USING ERRCODE = 'check_violation';
  END IF;
  NEW.owner_id = board_owner;

  IF TG_OP = 'INSERT' THEN
    moved = true;
  ELSE
    moved = NEW.board_id IS DISTINCT FROM OLD.board_id;
  END IF;

  IF (moved OR NEW.column_id IS DISTINCT FROM OLD.column_id) AND NOT EXISTS (
    SELECT 1 FROM public.columns c WHERE c.id = NEW.column_id AND c.board_id = NEW.board_id
  ) THEN
    RAISE EXCEPTION 'column does not belong to this board' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.sprint_id IS NOT NULL AND (moved OR NEW.sprint_id IS DISTINCT FROM OLD.sprint_id) AND NOT EXISTS (
    SELECT 1 FROM public.sprints s WHERE s.id = NEW.sprint_id AND s.board_id = NEW.board_id
  ) THEN
    RAISE EXCEPTION 'sprint does not belong to this board' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.story_id IS NOT NULL AND (moved OR NEW.story_id IS DISTINCT FROM OLD.story_id) AND NOT EXISTS (
    SELECT 1 FROM public.stories s WHERE s.id = NEW.story_id AND s.board_id = NEW.board_id
  ) THEN
    RAISE EXCEPTION 'story does not belong to this board' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.assignee_id IS NOT NULL AND (moved OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
     AND NEW.assignee_id <> board_owner AND NOT EXISTS (
    SELECT 1 FROM public.board_members m
     WHERE m.board_id = NEW.board_id AND m.user_id = NEW.assignee_id
  ) THEN
    RAISE EXCEPTION 'that person is not on this board' USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint

-- created_by, as in 0007, except that deleting an account may clear it: the
-- foreign key's SET NULL runs with no one signed in. Without this the trigger
-- put the deleted user back, and a second update of the same card in that
-- delete (clearing assignee_id) failed the foreign key.
CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = coalesce((SELECT auth.uid()), NEW.created_by);
  ELSIF NOT (NEW.created_by IS NULL AND (SELECT auth.uid()) IS NULL) THEN
    NEW.created_by = OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

-- Whoever leaves a board, or is taken off it, is taken off its cards too.
-- SECURITY DEFINER: someone leaving can't write the board's cards anymore.
-- Skipped when the membership goes because the board did.
CREATE OR REPLACE FUNCTION public.board_members_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.boards b WHERE b.id = OLD.board_id) THEN
    UPDATE public.cards
       SET assignee_id = NULL
     WHERE board_id = OLD.board_id AND assignee_id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER board_members_after_delete
AFTER DELETE ON public.board_members
FOR EACH ROW EXECUTE FUNCTION public.board_members_after_delete();
--> statement-breakpoint

-- A todo can only be linked to a card the caller can open (foreign keys skip
-- row-level security). Checked when the link is made: a todo keeps it after
-- the card's board stops being shared with its owner, so it still saves.
CREATE OR REPLACE FUNCTION public.todos_check_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.card_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.card_id IS DISTINCT FROM OLD.card_id)
     AND NOT public.has_card_access(NEW.card_id)
  THEN
    RAISE EXCEPTION 'card not found' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER todos_check_card
BEFORE INSERT OR UPDATE ON public.todos
FOR EACH ROW EXECUTE FUNCTION public.todos_check_card();
--> statement-breakpoint

-- Live updates for stories, like the other board tables (see 0007).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
  END IF;
END;
$$;
