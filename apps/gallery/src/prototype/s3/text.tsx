/** Enough Markdown for a README: headings, lists, code, bold. No raw HTML. */
export function Markdown({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/).map((part, index) =>
      // biome-ignore lint/suspicious/noArrayIndexKey: fixed text
      part.startsWith("**") ? (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed text
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
  const blocks = text.split(/```/);
  return (
    <div className="s3-markdown">
      {blocks.map((block, index) =>
        index % 2 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed text
          <pre key={index}>{block.trim()}</pre>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed text
          <div key={index}>
            {block
              .trim()
              .split(/\n{2,}/)
              .map((part) => {
                if (part.startsWith("## "))
                  return <h3 key={part}>{part.slice(3)}</h3>;
                if (part.startsWith("# "))
                  return <h2 key={part}>{part.slice(2)}</h2>;
                if (part.startsWith("- "))
                  return (
                    <ul key={part}>
                      {part.split("\n").map((line) => (
                        <li key={line}>{inline(line.slice(2))}</li>
                      ))}
                    </ul>
                  );
                return <p key={part}>{inline(part)}</p>;
              })}
          </div>
        ),
      )}
    </div>
  );
}
