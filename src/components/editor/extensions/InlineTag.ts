import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface InlineTagOptions {
  onTagClick?: (tag: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineTag: {
      setInlineTag: (tag: string) => ReturnType;
    };
  }
}

export const InlineTag = Node.create<InlineTagOptions>({
  name: "inlineTag",
  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return {
      onTagClick: undefined,
    };
  },

  addAttributes() {
    return {
      tag: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-tag"),
        renderHTML: (attributes) => ({
          "data-tag": attributes.tag,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-tag]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "inline-tag",
        style:
          "background: #3d2520; color: #e17055; padding: 1px 6px; border-radius: 3px; font-size: 0.9em; cursor: pointer;",
      }),
      `#${node.attrs.tag}`,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`#${node.attrs.tag}`);
        },
        parse: {},
      },
    };
  },

  addCommands() {
    return {
      setInlineTag:
        (tag: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { tag },
          });
        },
    };
  },

  addProseMirrorPlugins() {
    const onTagClick = this.options.onTagClick;
    return [
      new Plugin({
        key: new PluginKey("inlineTagClick"),
        props: {
          handleClick(view, pos) {
            if (!onTagClick) return false;
            const node = view.state.doc.nodeAt(pos);
            if (node?.type.name === "inlineTag" && node.attrs.tag) {
              onTagClick(node.attrs.tag);
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },

  addInputRules() {
    return [
      {
        find: /#([\w/]+)\s$/,
        handler: ({ state, range, match }) => {
          const tag = match[1];
          const { tr } = state;
          tr.replaceWith(
            range.from,
            range.to,
            this.type.create({ tag }),
          );
          tr.insertText(" ");
        },
      },
    ];
  },
});
