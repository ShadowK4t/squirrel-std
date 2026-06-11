'use client'

import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {
  IconBold, IconItalic, IconStrikethrough,
  IconList, IconListNumbers,
} from '@tabler/icons-react'

export type RichTextEditorHandle = {
  getEditor: () => Editor | null
  clearContent: () => void
}

type Props = {
  content: string
  onChange: (html: string) => void
  onTextChange?: (text: string) => void
  placeholder?: string
  minHeight?: string
}

const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(
  ({ content, onChange, onTextChange, placeholder, minHeight = '80px' }, ref) => {

    const editor = useEditor({
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: placeholder ?? 'Write something...' }),
      ],
      content,
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        const html = editor.isEmpty ? '' : editor.getHTML()
        onChange(html)
        onTextChange?.(editor.getText())
      },
      editorProps: {
        attributes: {
          class: 'outline-none text-white text-sm',
          style: `min-height: ${minHeight}`,
        },
      },
    })

    useImperativeHandle(ref, () => ({
      getEditor: () => editor,
      clearContent: () => editor?.commands.clearContent(),
    }))

    useEffect(() => {
      if (!editor) return
      const currentHtml = editor.getHTML()
      const incoming = content || ''
      if (currentHtml === incoming) return
      if (!incoming && editor.isEmpty) return
      editor.commands.setContent(incoming)
    }, [content]) // eslint-disable-line

    if (!editor) return null

    function tb(active: boolean, action: () => void, icon: React.ReactNode) {
      return (
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); action() }}
          className={`p-1 rounded transition-colors ${active ? 'bg-sq-accent text-white' : 'text-sq-muted hover:text-white'}`}
        >
          {icon}
        </button>
      )
    }

    return (
      <div className="bg-sq-col border border-sq-muted rounded overflow-hidden focus-within:border-white/30 transition-colors">
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-sq-muted">
          {tb(editor.isActive('bold'),        () => editor.chain().focus().toggleBold().run(),        <IconBold size={13} />)}
          {tb(editor.isActive('italic'),      () => editor.chain().focus().toggleItalic().run(),      <IconItalic size={13} />)}
          {tb(editor.isActive('strike'),      () => editor.chain().focus().toggleStrike().run(),      <IconStrikethrough size={13} />)}
          <div className="w-px h-3 bg-sq-muted mx-1" />
          {tb(editor.isActive('bulletList'),  () => editor.chain().focus().toggleBulletList().run(),  <IconList size={13} />)}
          {tb(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <IconListNumbers size={13} />)}
        </div>
        <div className="p-3">
          <EditorContent editor={editor} />
        </div>
      </div>
    )
  }
)

RichTextEditor.displayName = 'RichTextEditor'
export default RichTextEditor