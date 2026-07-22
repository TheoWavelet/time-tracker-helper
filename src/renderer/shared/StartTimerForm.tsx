import { useState } from 'react'
import type { TagPickerEntry } from '@shared/types'
import { formatDefaultTimerTitle } from '@shared/format'
import { TagPicker } from './TagPicker'
import { PlusIcon } from './icons'

export interface StartTimerFormValue {
  title?: string
  tagLabel?: string
}

interface StartTimerFormProps {
  onStart: (value: StartTimerFormValue) => void
}

export function StartTimerForm({ onStart }: StartTimerFormProps): JSX.Element {
  const [text, setText] = useState('')
  const [pickedTag, setPickedTag] = useState<TagPickerEntry | null>(null)

  const defaultTitlePreview = formatDefaultTimerTitle(Date.now())

  function handleChange(newText: string): void {
    setText(newText)
    if (pickedTag && newText !== pickedTag.label) setPickedTag(null)
  }

  function handlePickTag(tag: TagPickerEntry): void {
    setText(tag.label)
    setPickedTag(tag)
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    onStart({
      title: pickedTag ? pickedTag.label : text.trim() || undefined,
      tagLabel: pickedTag ? pickedTag.label : undefined
    })
    setText('')
    setPickedTag(null)
  }

  return (
    <form className="start-timer-form" onSubmit={handleSubmit}>
      <TagPicker
        value={text}
        onChange={handleChange}
        onPickTag={handlePickTag}
        placeholder={`Plain title (e.g. ${defaultTitlePreview}) or pick a tag…`}
      />
      <button type="submit" className="icon-button icon-button--add" aria-label="Start timer">
        <PlusIcon />
      </button>
    </form>
  )
}
