/** Only tool-provided invoice URLs become links; other chat content stays plain text. */
export default function MessageContent({ content }: { content: string }) {
  const pattern =
    /\[([^\]\n]+)\]\((https:\/\/rent-o-accountant\.web\.app\/api\/invoices\/public\/[A-Za-z0-9_-]{43}(?:\?download=1)?)\)/g;
  const parts: (string | React.JSX.Element)[] = [];
  let start = 0;
  for (const match of content.matchAll(pattern)) {
    parts.push(content.slice(start, match.index));
    parts.push(
      <a key={match.index} href={match[2]} target="_blank" rel="noreferrer">
        {match[1]}
      </a>,
    );
    start = match.index! + match[0].length;
  }
  parts.push(content.slice(start));
  return <>{parts}</>;
}
