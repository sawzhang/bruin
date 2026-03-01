import { useEffect } from "react";
import { useEditor, EditorContent, BubbleMenu, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Markdown } from "tiptap-markdown";
import clsx from "clsx";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { InlineTag } from "./extensions/InlineTag";
import { WikiLink } from "./extensions/WikiLink";
import { SlashCommand, slashCommands } from "./extensions/SlashCommand";
import { SlashCommandMenu } from "./SlashCommandMenu";
import * as tauri from "../../lib/tauri";
import "../../styles/code-highlight.css";
import "../../styles/editor.css";

interface MarkdownEditorProps {
  content: string;
  onUpdate: (markdown: string) => void;
  onTagClick?: (tag: string) => void;
  onWikiLinkClick?: (title: string) => void;
  wordCount?: number;
}

export function MarkdownEditor({
  content,
  onUpdate,
  onTagClick,
  onWikiLinkClick,
  wordCount,
}: MarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        code: {
          HTMLAttributes: {
            class: "bg-bear-inline-code rounded px-1.5 py-0.5 font-mono text-sm",
          },
        },
      }),
      CodeBlockLowlight.configure({
        lowlight: createLowlight(common),
        HTMLAttributes: {
          class: "bg-bear-inline-code rounded p-3 my-2 font-mono text-sm",
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.extend({
        addProseMirrorPlugins() {
          const imageHandler = new Plugin({
            key: new PluginKey("imageDropPaste"),
            props: {
              handleDrop: (view, event) => {
                const files = event.dataTransfer?.files;
                if (!files || files.length === 0) return false;
                const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
                if (imageFiles.length === 0) return false;
                event.preventDefault();
                for (const file of imageFiles) {
                  file.arrayBuffer().then((buffer) => {
                    const data = Array.from(new Uint8Array(buffer));
                    tauri.saveImage(data, file.name).then((path) => {
                      const src = convertFileSrc(path);
                      const { tr } = view.state;
                      const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
                      const node = view.state.schema.nodes.image.create({ src });
                      view.dispatch(tr.insert(pos, node));
                    });
                  });
                }
                return true;
              },
              handlePaste: (view, event) => {
                const items = event.clipboardData?.items;
                if (!items) return false;
                const imageItems = Array.from(items).filter((item) => item.type.startsWith("image/"));
                if (imageItems.length === 0) return false;
                event.preventDefault();
                for (const item of imageItems) {
                  const file = item.getAsFile();
                  if (!file) continue;
                  file.arrayBuffer().then((buffer) => {
                    const data = Array.from(new Uint8Array(buffer));
                    tauri.saveImage(data, file.name || "pasted-image.png").then((path) => {
                      const src = convertFileSrc(path);
                      const { tr } = view.state;
                      const node = view.state.schema.nodes.image.create({ src });
                      view.dispatch(tr.insert(view.state.selection.from, node));
                    });
                  });
                }
                return true;
              },
            },
          });
          return [imageHandler];
        },
      }),
      ...(wordCount === undefined || wordCount < 10000 ? [Typography] : []),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-bear-link underline",
        },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Markdown.configure({
        html: false,
        transformCopiedText: true,
        transformPastedText: true,
      }),
      InlineTag.configure({ onTagClick }),
      WikiLink.configure({ onLinkClick: onWikiLinkClick }),
      SlashCommand.configure({
        suggestion: {
          items: ({ query }: { query: string }) => {
            return slashCommands.filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase())
            );
          },
          render: () => {
            let component: ReactRenderer | null = null;
            let popup: TippyInstance[] | null = null;

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(SlashCommandMenu, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },
              onUpdate: (props: any) => {
                component?.updateProps(props);
                if (popup?.[0] && props.clientRect) {
                  popup[0].setProps({
                    getReferenceClientRect: props.clientRect,
                  });
                }
              },
              onKeyDown: (props: any) => {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }
                return (component?.ref as any)?.onKeyDown?.(props) ?? false;
              },
              onExit: () => {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        },
      }),
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
    <div data-testid="editor-body" className="flex-1 overflow-y-auto">
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
          {editor.isActive("table") && (
            <>
              <span className="w-px h-4 bg-bear-border mx-0.5" />
              <BubbleButton
                active={false}
                onClick={() => editor.chain().focus().addRowAfter().run()}
              >
                +Row
              </BubbleButton>
              <BubbleButton
                active={false}
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              >
                +Col
              </BubbleButton>
              <BubbleButton
                active={false}
                onClick={() => editor.chain().focus().deleteRow().run()}
              >
                -Row
              </BubbleButton>
              <BubbleButton
                active={false}
                onClick={() => editor.chain().focus().deleteColumn().run()}
              >
                -Col
              </BubbleButton>
              <BubbleButton
                active={false}
                onClick={() => editor.chain().focus().deleteTable().run()}
              >
                Del
              </BubbleButton>
            </>
          )}
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
