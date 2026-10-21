-- Board sharing: owner_id on everything that hangs off a board is the board's
-- owner, whoever wrote the row, and created_by says who did. The checks below
-- run as the caller, so their reads of boards and cards go through the
-- policies: a row can only point at a board or card the caller can open.

UPDATE public.cards SET created_by = owner_id WHERE created_by IS NULL;
--> statement-breakpoint
UPDATE public.card_events SET created_by = owner_id WHERE created_by IS NULL;
--> statement-breakpoint

-- created_by is the signed-in user on insert and never changes after.
CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = coalesce((SELECT auth.uid()), NEW.created_by);
  ELSE
    NEW.created_by = OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER cards_set_created_by BEFORE INSERT OR UPDATE ON public.cards
FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
--> statement-breakpoint
CREATE TRIGGER card_events_set_created_by BEFORE INSERT OR UPDATE ON public.card_events
FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
--> statement-breakpoint

-- Columns, sprints and labels: the board must be one the caller can open, and
-- the row belongs to its owner. (Same name as in 0001, so its triggers keep it.)
CREATE OR REPLACE FUNCTION public.check_board_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  board_owner uuid;
BEGIN
  SELECT b.owner_id INTO board_owner FROM public.boards b WHERE b.id = NEW.board_id;
  IF board_owner IS NULL THEN
    RAISE EXCEPTION 'board not found' USING ERRCODE = 'check_violation';
  END IF;
  NEW.owner_id = board_owner;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

-- Checklist items and activity: the same, through their card.
CREATE OR REPLACE FUNCTION public.check_card_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  card_owner uuid;
BEGIN
  SELECT c.owner_id INTO card_owner FROM public.cards c WHERE c.id = NEW.card_id;
  IF card_owner IS NULL THEN
    RAISE EXCEPTION 'card not found' USING ERRCODE = 'check_violation';
  END IF;
  NEW.owner_id = card_owner;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

-- Cards: owned by the board's owner, and the column and sprint must be on the
-- same board. Foreign keys skip row-level security, so this is what stops a
-- card from pointing at another board's column.
CREATE OR REPLACE FUNCTION public.cards_check_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  board_owner uuid;
BEGIN
  SELECT b.owner_id INTO board_owner FROM public.boards b WHERE b.id = NEW.board_id;
  IF board_owner IS NULL THEN
    RAISE EXCEPTION 'board not found' USING ERRCODE = 'check_violation';
  END IF;
  NEW.owner_id = board_owner;

  IF NOT EXISTS (
    SELECT 1 FROM public.columns c WHERE c.id = NEW.column_id AND c.board_id = NEW.board_id
  ) THEN
    RAISE EXCEPTION 'column does not belong to this board' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.sprint_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sprints s WHERE s.id = NEW.sprint_id AND s.board_id = NEW.board_id
  ) THEN
    RAISE EXCEPTION 'sprint does not belong to this board' USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint

-- Members may rename a board (and adding a card bumps next_number), but the
-- owner never changes, and archiving and the sidebar position are the owner's.
CREATE OR REPLACE FUNCTION public.boards_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'a board''s owner can''t change' USING ERRCODE = 'check_violation';
  END IF;
  IF (SELECT auth.uid()) IS DISTINCT FROM OLD.owner_id
     AND (NEW.archived_at IS DISTINCT FROM OLD.archived_at OR NEW.position IS DISTINCT FROM OLD.position)
  THEN
    RAISE EXCEPTION 'only the board''s owner can archive or move it' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER boards_guard BEFORE UPDATE ON public.boards
FOR EACH ROW EXECUTE FUNCTION public.boards_guard();
--> statement-breakpoint

-- profiles mirrors auth.users' emails. SECURITY DEFINER: the auth service
-- writes auth.users and has no rights on public tables.
CREATE OR REPLACE FUNCTION public.sync_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, coalesce(NEW.email, ''))
  ON CONFLICT (id) DO UPDATE SET email = excluded.email;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_saved AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_profile();
--> statement-breakpoint
INSERT INTO public.profiles (id, email)
SELECT id, coalesce(email, '') FROM auth.users
ON CONFLICT (id) DO UPDATE SET email = excluded.email;
--> statement-breakpoint

-- Share a board with the account that uses `email`. Only the owner may, and
-- only with someone who has signed in to DoIT at least once. Inviting someone
-- twice is fine: it returns the existing row.
CREATE OR REPLACE FUNCTION public.invite_board_member(board uuid, email text)
RETURNS public.board_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invitee uuid;
  member public.board_members;
BEGIN
  IF NOT public.is_board_owner(board) THEN
    RAISE EXCEPTION 'Only the board''s owner can share it.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT u.id INTO invitee FROM auth.users u WHERE lower(u.email) = lower(trim(invite_board_member.email));
  IF invitee IS NULL THEN
    RAISE EXCEPTION 'No one has signed in to DoIT with that email yet. Ask them to sign in once, then share again.'
      USING ERRCODE = 'no_data_found';
  END IF;
  IF invitee = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'You already own this board.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.board_members (board_id, user_id)
  VALUES (board, invitee)
  ON CONFLICT (board_id, user_id) DO NOTHING;

  SELECT * INTO member FROM public.board_members m WHERE m.board_id = board AND m.user_id = invitee;
  RETURN member;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.invite_board_member(uuid, text) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.invite_board_member(uuid, text) TO authenticated;
--> statement-breakpoint

-- Live updates for shared boards (Supabase Realtime). Each subscriber only
-- hears about rows its policies let it read. Skipped where the publication
-- doesn't exist (plain Postgres, the policy tests).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE
      public.boards, public.board_members, public.columns, public.sprints, public.labels,
      public.cards, public.checklist_items, public.card_events;
  END IF;
END;
$$;
