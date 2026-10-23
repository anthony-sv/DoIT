import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { ArrowDownIcon, ArrowUpIcon, EllipsisIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { reportFailure } from '@/components/card/card-writes'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { storiesCollection } from '@/data/collections'
import { removeStory } from '@/data/actions'
import type { Story } from '@/data/schemas'
import { positionBetween } from '@/lib/position'

/** Edit, reorder and delete a story; `stories` is the board's, in order. */
export function StoryMenu({ story, stories }: { story: Story; stories: Story[] }) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const index = stories.findIndex((s) => s.id === story.id)

  // A move writes one row: the story's new position between its new neighbours.
  function moveTo(before: Story | undefined, after: Story | undefined) {
    storiesCollection
      .update(story.id, (draft) => {
        draft.position = positionBetween(before?.position, after?.position)
      })
      .isPersisted.promise.catch(reportFailure('Story order not saved'))
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mt-1 -mr-1 shrink-0"
              aria-label={`${story.title} story options`}
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit story…
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={index <= 0}
              onClick={() => moveTo(stories[index - 2], stories[index - 1])}
            >
              <ArrowUpIcon />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index < 0 || index >= stories.length - 1}
              onClick={() => moveTo(stories[index + 1], stories[index + 2])}
            >
              <ArrowDownIcon />
              Move down
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
              <Trash2Icon />
              Delete story…
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditStoryDialog story={story} open={editing} onOpenChange={setEditing} />
      <DeleteStoryDialog story={story} open={deleting} onOpenChange={setDeleting} />
    </>
  )
}

const storyFormSchema = z.object({
  title: z.string().trim().min(1, 'Give the story a title').max(200),
  description: z.string().max(5_000),
})

function EditStoryDialog({
  story,
  open,
  onOpenChange,
}: {
  story: Story
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounts with each opening, so the form starts from the story as it is now. */}
        <EditStoryForm story={story} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function EditStoryForm({ story, onDone }: { story: Story; onDone: () => void }) {
  const form = useForm({
    defaultValues: { title: story.title, description: story.description },
    validators: { onSubmit: storyFormSchema },
    onSubmit: ({ value }) => {
      storiesCollection
        .update(story.id, (draft) => {
          draft.title = value.title.trim()
          draft.description = value.description
        })
        .isPersisted.promise.catch(reportFailure('Story not saved'))
      onDone()
    },
  })

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <DialogHeader>
        <DialogTitle>Edit story</DialogTitle>
      </DialogHeader>
      <FieldGroup>
        <form.Field name="title">
          {(field) => {
            const invalid = field.state.meta.errors.length > 0
            return (
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="story-title">Title</FieldLabel>
                <Input
                  id="story-title"
                  maxLength={200}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={invalid || undefined}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )
          }}
        </form.Field>
        <form.Field name="description">
          {(field) => {
            const invalid = field.state.meta.errors.length > 0
            return (
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="story-description">Description</FieldLabel>
                <Textarea
                  id="story-description"
                  rows={4}
                  maxLength={5_000}
                  className="max-h-[40svh]"
                  placeholder="As a …, I want …, so that …"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={invalid || undefined}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )
          }}
        </form.Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}

function DeleteStoryDialog({
  story,
  open,
  onOpenChange,
}: {
  story: Story
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{story.title}”?</AlertDialogTitle>
          <AlertDialogDescription>Its cards stay on the board, in no story.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              removeStory(story).isPersisted.promise.catch(reportFailure('Story not deleted'))
              onOpenChange(false)
            }}
          >
            Delete story
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
