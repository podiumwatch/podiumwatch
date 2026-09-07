-- Podium Watch Writer Portal -- Stage 5 schema
-- Purpose:
--   1. Inline comments: portal_editor_notes gets an optional anchor_text
--      column. NULL (the existing default) means a general note, exactly
--      as today. Set means the note refers to a specific passage --
--      stored as the literal selected text itself rather than a Tiptap
--      mark/position, deliberately: a mark embedded in the article's own
--      saved body JSON would need to survive every subsequent edit
--      without corruption; a plain text anchor instead just stops
--      highlighting (gracefully, not by breaking anything) if a writer
--      later changes that exact passage. Simpler and more robust than
--      the article's content depending on comment bookkeeping surviving
--      inside it.
--   2. portal_style_guide: a single-row table so the style guide is
--      actually editable by staff from the portal itself, not a code
--      change. body is Tiptap JSON, same shape/renderer
--      (public/scripts/writer-portal-render.js) as every article body.

begin;

alter table public.portal_editor_notes
  add column if not exists anchor_text text;

create table if not exists public.portal_style_guide (
  id integer primary key default 1,
  body jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.portal_profiles(id),
  constraint portal_style_guide_singleton check (id = 1)
);

drop trigger if exists portal_style_guide_updated_at_trigger on public.portal_style_guide;
create trigger portal_style_guide_updated_at_trigger
before update on public.portal_style_guide
for each row execute function public.set_recruiting_foundation_updated_at();

alter table public.portal_style_guide enable row level security;
revoke all on table public.portal_style_guide from anon, authenticated;
grant select on table public.portal_style_guide to authenticated;
grant all on table public.portal_style_guide to service_role;

drop policy if exists "portal_style_guide_select_any_portal_user" on public.portal_style_guide;
create policy "portal_style_guide_select_any_portal_user" on public.portal_style_guide for select
  using (exists (select 1 from public.portal_profiles where id = auth.uid()));

comment on column public.portal_editor_notes.anchor_text is 'The exact passage this note refers to, if any -- NULL means a general note. Deliberately not a Tiptap mark inside the article body; see this migration''s header comment.';
comment on table public.portal_style_guide is 'Single-row (id=1) editable style guide content, Tiptap JSON body. Staff-editable from /writer-portal/style-guide/.';

commit;
