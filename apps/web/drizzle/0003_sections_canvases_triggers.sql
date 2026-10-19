-- A todo's section must belong to the same user: foreign keys skip row-level
-- security, so the policy alone would not catch someone else's section id.
CREATE OR REPLACE FUNCTION public.todos_check_section()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.section_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.todo_sections s
     WHERE s.id = NEW.section_id AND s.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'section does not belong to this user' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER todos_check_section
BEFORE INSERT OR UPDATE ON public.todos
FOR EACH ROW EXECUTE FUNCTION public.todos_check_section();
--> statement-breakpoint

-- Saving or renaming a canvas bumps its updated_at.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER canvases_touch
BEFORE UPDATE ON public.canvases
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
--> statement-breakpoint

-- cards.label_ids has no foreign key, so a deleted label is taken off every
-- card that had it. Skipped when the label goes because its board did: the
-- board's cards are being deleted anyway.
CREATE OR REPLACE FUNCTION public.labels_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.boards b WHERE b.id = OLD.board_id) THEN
    UPDATE public.cards
       SET label_ids = array_remove(label_ids, OLD.id)
     WHERE board_id = OLD.board_id AND OLD.id = ANY (label_ids);
  END IF;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER labels_after_delete
AFTER DELETE ON public.labels
FOR EACH ROW EXECUTE FUNCTION public.labels_after_delete();
