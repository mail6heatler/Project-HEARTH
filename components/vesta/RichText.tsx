import { splitTerms } from "@/lib/glossary";
import { splitNumbers } from "@/lib/textfx";
import { Term } from "./Glossary";
import { parseBlocks, parseInline, type Block } from "./parseRichText";

/** Per answer: glossary terms already marked, and whether numbers glow once (finished answers only). */
interface Fx {
  used: Set<string> | null;
  glow: boolean;
}

function Numbers({ text, glow }: { text: string; glow: boolean }) {
  if (!glow) return <>{text}</>;
  return (
    <>
      {splitNumbers(text).map((p, i) =>
        p.num ? (
          <span key={i} className="num-glow">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function Decorated({ text, fx }: { text: string; fx: Fx }) {
  if (!fx.used) return <Numbers text={text} glow={fx.glow} />;
  return (
    <>
      {splitTerms(text, fx.used).map((p, i) =>
        p.term ? (
          <Term key={i} term={p.term}>
            {p.text}
          </Term>
        ) : (
          <Numbers key={i} text={p.text} glow={fx.glow} />
        ),
      )}
    </>
  );
}

function Inline({ text, fx }: { text: string; fx: Fx }) {
  return (
    <>
      {parseInline(text).map((part, i) =>
        part.kind === "bold" ? (
          <strong key={i} className="font-semibold text-text">
            <Numbers text={part.text} glow={fx.glow} />
          </strong>
        ) : part.kind === "code" ? (
          <code key={i} className="rounded bg-bg px-1 py-px font-mono text-[0.85em] text-ember-soft">
            {part.text}
          </code>
        ) : (
          <Decorated key={i} text={part.text} fx={fx} />
        ),
      )}
    </>
  );
}

function BlockView({ block, fx }: { block: Block; fx: Fx }) {
  switch (block.kind) {
    case "gap":
      return <div className="h-1.5" aria-hidden />;
    case "h":
      return (
        <h3 className="mt-1 font-head text-[13px] font-semibold tracking-wide text-ember-soft">
          <Inline text={block.text} fx={fx} />
        </h3>
      );
    case "ul":
      return (
        <ul className="list-disc space-y-0.5 pl-4 marker:text-ember">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} fx={fx} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol start={block.start} className="list-decimal space-y-0.5 pl-5 marker:font-mono marker:text-xs marker:text-ember">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} fx={fx} />
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full text-left text-xs">
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className={r === 0 ? "bg-raised font-semibold" : "border-t border-line"}>
                  {row.map((cell, c) => (
                    <td key={c} className="whitespace-nowrap px-2 py-1">
                      <Inline text={cell} fx={fx} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return (
        <p>
          <Inline text={block.text} fx={fx} />
        </p>
      );
  }
}

/**
 * Safe rendering of the Markdown models write: bold, code, headings, lists and tables. No HTML injection.
 * `terms` marks the first mention of each glossary word; `glow` lets standalone numbers glow once.
 */
export function RichText({ text, terms = false, glow = false }: { text: string; terms?: boolean; glow?: boolean }) {
  const fx: Fx = { used: terms ? new Set<string>() : null, glow };
  return (
    <>
      {parseBlocks(text).map((block, i) => (
        <BlockView key={i} block={block} fx={fx} />
      ))}
    </>
  );
}
