import { memo, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(getText()).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="absolute right-2 top-2 rounded-md border border-border/60 bg-background/70 p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
      aria-label="Copy code"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function Pre({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  return (
    <div className="group relative my-3">
      <pre
        {...props}
        className="overflow-x-auto rounded-lg border border-border/60 bg-black/40 p-3 text-[13px] leading-relaxed"
      >
        {children}
      </pre>
      <CopyButton
        getText={() => {
          // Extract the text of the enclosed <code> element at click time.
          const el = document.activeElement;
          const wrapper = el?.closest(".group");
          return wrapper?.querySelector("code")?.textContent ?? "";
        }}
      />
    </div>
  );
}

const MarkdownImpl = ({ content }: { content: string }) => {
  return (
    <div
      className={cn(
        "prose prose-invert max-w-none text-sm leading-relaxed",
        "prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2",
        "prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em]",
        "prose-a:text-primary prose-li:my-0.5",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
        ]}
        components={{
          pre: Pre,
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export const Markdown = memo(MarkdownImpl);
