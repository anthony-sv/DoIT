-- Card numbers (DSC-1, DSC-2, …) come from a per-board counter, so two tabs
-- creating cards at once never get the same number.
CREATE OR REPLACE FUNCTION public.cards_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.boards
     SET next_number = next_number + 1
   WHERE id = NEW.board_id
  RETURNING next_number - 1 INTO NEW.number;

  IF NEW.number IS NULL THEN
    RAISE EXCEPTION 'board % not found', NEW.board_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER cards_before_insert
BEFORE INSERT ON public.cards
FOR EACH ROW EXECUTE FUNCTION public.cards_before_insert();
--> statement-breakpoint

-- Foreign keys skip row-level security, so check that everything a card points
-- at is on the same board and belongs to the same user.
CREATE OR REPLACE FUNCTION public.cards_check_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.columns c
     WHERE c.id = NEW.column_id AND c.board_id = NEW.board_id AND c.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'column does not belong to this board' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.sprint_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sprints s
     WHERE s.id = NEW.sprint_id AND s.board_id = NEW.board_id AND s.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'sprint does not belong to this board' USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER cards_check_refs
BEFORE INSERT OR UPDATE ON public.cards
FOR EACH ROW EXECUTE FUNCTION public.cards_check_refs();
--> statement-breakpoint

-- The same ownership check for rows that hang off a board or a card.
CREATE OR REPLACE FUNCTION public.check_board_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.boards b WHERE b.id = NEW.board_id AND b.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'board does not belong to this user' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER columns_check_owner BEFORE INSERT OR UPDATE ON public.columns
FOR EACH ROW EXECUTE FUNCTION public.check_board_owner();
--> statement-breakpoint
CREATE TRIGGER sprints_check_owner BEFORE INSERT OR UPDATE ON public.sprints
FOR EACH ROW EXECUTE FUNCTION public.check_board_owner();
--> statement-breakpoint
CREATE TRIGGER labels_check_owner BEFORE INSERT OR UPDATE ON public.labels
FOR EACH ROW EXECUTE FUNCTION public.check_board_owner();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.check_card_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.cards c WHERE c.id = NEW.card_id AND c.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'card does not belong to this user' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER checklist_items_check_owner BEFORE INSERT OR UPDATE ON public.checklist_items
FOR EACH ROW EXECUTE FUNCTION public.check_card_owner();
--> statement-breakpoint
CREATE TRIGGER card_events_check_owner BEFORE INSERT OR UPDATE ON public.card_events
FOR EACH ROW EXECUTE FUNCTION public.check_card_owner();
--> statement-breakpoint

-- Only one active sprint per board.
CREATE UNIQUE INDEX sprints_one_active_per_board
  ON public.sprints (board_id) WHERE state = 'active';
