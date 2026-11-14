"use client";

import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  codeBlockPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  ListsToggle,
} from "@mdxeditor/editor";
import { useRef } from "react";
import "@mdxeditor/editor/style.css";

/**
 * Éditeur Markdown WYSIWYG partagé (admin content). Monté côté client
 * uniquement (import dynamique { ssr: false } chez l'appelant) car
 * `@mdxeditor/editor` dépend de Lexical → pas de SSR.
 *
 * Plugins actifs :
 *   - headings (H1-H6), listes (bullet/ordered), citations, HR
 *   - liens inline + dialogue d'édition (titre + href)
 *   - blocs de code inline (sans highlight — on reste Markdown pur,
 *     le rendu public utilise react-syntax-highlighter)
 *   - markdown shortcuts (# → H1, * → bullet, > → blockquote, etc.)
 *
 * Propagation : `onChange(nextMarkdown)` est appelé à chaque frappe.
 * L'appelant garde l'état parent et peut repasser `value` pour reset.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minHeight = 400,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<MDXEditorMethods>(null);

  return (
    <div className="mdx-editor-wrapper" style={{ minHeight }}>
      <MDXEditor
        ref={ref}
        markdown={value}
        onChange={onChange}
        placeholder={placeholder ?? "Écris le contenu Markdown…"}
        contentEditableClassName="prose prose-invert max-w-none dark:prose-invert"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          codeBlockPlugin({ defaultCodeBlockLanguage: "" }),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BoldItalicUnderlineToggles />
                <BlockTypeSelect />
                <CreateLink />
                <ListsToggle />
              </>
            ),
          }),
        ]}
      />
      <style jsx global>{`
        .mdx-editor-wrapper .mdxeditor {
          border-radius: 0.375rem;
          border-width: 1px;
          background-color: hsl(var(--background));
        }
        .mdx-editor-wrapper .mdxeditor-toolbar {
          background-color: hsl(var(--muted));
          border-bottom-width: 1px;
        }
        .mdx-editor-wrapper .mdxeditor-root-contenteditable {
          min-height: 320px;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}
