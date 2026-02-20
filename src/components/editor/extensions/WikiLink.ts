import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface WikiLinkOptions {
  onLinkClick?: (title: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (title: string) => ReturnType;
    };
  }
}

export const WikiLink = Node.create<WikiLinkOptions>({
  name: "wikiLink",
  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return {
      onLinkClick: undefined,
    };
  },

  addAttributes() {
    return {
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-wiki-title"),
        renderHTML: (attributes) => ({
          "data-wiki-title": attributes.title,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wiki-title]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "wiki-link",
        style:
          "color: #74b9ff; cursor: pointer; text-decoration: underline; text-decoration-style: dotted;",
      }),
      `[[${node.attrs.title}]]`,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`[[${node.attrs.title}]]`);
        },
        parse: {},
      },
    };
  },

  addCommands() {
    return {
      setWikiLink:
        (title: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { title },
          });
        },
    };
  },

  addProseMirrorPlugins() {
    const onLinkClick = this.options.onLinkClick;
    return [
      new Plugin({
        key: new PluginKey("wikiLinkClick"),
        props: {
          handleClick(view, pos) {
            if (!onLinkClick) return false;
            const node = view.state.doc.nodeAt(pos);
            if (node?.type.name === "wikiLink" && node.attrs.title) {
              onLinkClick(node.attrs.title);
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
        find: /\[\[([^\]]+)\]\]\s$/,
        handler: ({ state, range, match }) => {
          const title = match[1];
          const { tr } = state;
          tr.replaceWith(
            range.from,
            range.to,
            this.type.create({ title }),
          );
          tr.insertText(" ");
        },
      },
    ];
  },
});
