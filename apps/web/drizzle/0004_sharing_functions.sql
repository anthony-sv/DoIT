-- Who may see a shared board, for the policies in 0005. SECURITY DEFINER: they
-- read boards and board_members as the table owner, so a policy that calls
-- them doesn't recurse into those tables' own policies. PL/pgSQL bodies are
-- checked when they first run, so board_members can come in the next migration.

-- The board's owner, or someone it's shared with.
CREATE OR REPLACE FUNCTION public.has_board_access(board uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.boards b WHERE b.id = board AND b.owner_id = (SELECT auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.board_members m WHERE m.board_id = board AND m.user_id = (SELECT auth.uid())
  );
END;
$$;
--> statement-breakpoint

-- Access to the board the card is on.
CREATE OR REPLACE FUNCTION public.has_card_access(card uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.cards c WHERE c.id = card AND public.has_board_access(c.board_id)
  );
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_board_owner(board uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.boards b WHERE b.id = board AND b.owner_id = (SELECT auth.uid())
  );
END;
$$;
--> statement-breakpoint

-- Whether `person` owns or is a member of a board the caller can open.
CREATE OR REPLACE FUNCTION public.shares_board_with(person uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
      FROM public.boards b
      LEFT JOIN public.board_members m ON m.board_id = b.id
     WHERE (b.owner_id = person OR m.user_id = person)
       AND public.has_board_access(b.id)
  );
END;
$$;
