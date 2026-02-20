import { useEffect } from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import clsx from "clsx";
import { InlineTag } from "./extensions/InlineTag";
import { WikiLink } from "./extensions/WikiLink";

interface MarkdownEditorProps {
  content: string;
  onUpdate: (markdown: string) => void;
  onTagClick?: (tag: string) => void;
  onWikiLinkClick?: (title: string) => void;
}

export function MarkdownEditor({
  content,
  onUpdate,
  onTagClick,
  onWikiLinkClick,
}: MarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: {
          HTMLAttributes: {
            class: "bg-bear-inline-code rounded p-3 my-2 font-mono text-sm",
          },
        },
        code: {
          HTMLAttributes: {
            class: "bg-bear-inline-code rounded px-1.5 py-0.5 font-mono text-sm",
          },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      Typography,
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-bear-link underline",
        },
      }),
      Markdown.configure({
        html: false,
        transformCopiedText: true,
        transformPastedText: true,
      }),
      InlineTag.configure({ onTagClick }),
      WikiLink.configure({ onLinkClick: onWikiLinkClick }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none outline-none min-h-[300px] text-[15px] leading-relaxed text-bear-text",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = ed.storage.markdown?.getMarkdown?.() ?? ed.getText();
      onUpdate(md);
    },
  });

  // Sync content from props when it changes (e.g. note switch)
  useEffect(() => {
    if (editor && content !== undefined) {
      const currentContent =
        editor.storage.markdown?.getMarkdown?.() ?? editor.getText();
      if (currentContent !== content) {
        editor.commands.setContent(content);
      }
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="flex items-center gap-0.5 bg-bear-sidebar border border-bear-border rounded-lg shadow-lg px-1 py-0.5"
        >
          <BubbleButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </BubbleButton>
          <BubbleButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </BubbleButton>
          <BubbleButton
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            {"<>"}
          </BubbleButton>
          <BubbleButton
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            H
          </BubbleButton>
          <BubbleButton
            active={editor.isActive("link")}
            onClick={() => {
              if (editor.isActive("link")) {
                editor.chain().focus().unsetLink().run();
              } else {
                const url = window.prompt("URL:");
                if (url) {
                  editor.chain().focus().setLink({ href: url }).run();
                }
              }
            }}
          >
            {"~"}
          </BubbleButton>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

function BubbleButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-2 py-1 text-xs rounded font-medium transition-colors duration-150",
        active
          ? "bg-bear-active text-bear-text"
          : "text-bear-text-secondary hover:text-bear-text hover:bg-bear-hover",
      )}
    >
      {children}
    </button>
  );
}
