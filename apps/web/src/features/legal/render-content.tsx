import type { ReactNode } from 'react';

/** Matnni bloklarga ajratadi: «## sarlavha», «- ro‘yxat», oddiy abzatslar. */
export function renderContent(content: string): ReactNode {
  return content
    .trim()
    .split(/\n{2,}/)
    .map((block, index) => {
      const lines = block.split('\n');
      if (lines.length === 1 && lines[0]?.startsWith('## ')) return <h3 key={index}>{lines[0].slice(3)}</h3>;
      // Sarlavha va uning ostidagi ro‘yxat/abzats bitta blokda kelgan bo‘lishi mumkin.
      const nodes: ReactNode[] = [];
      let bullets: string[] = [];
      const flush = () => {
        if (bullets.length > 0) {
          nodes.push(
            <ul key={`ul-${nodes.length}`}>
              {bullets.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>,
          );
          bullets = [];
        }
      };
      lines.forEach((line) => {
        if (line.startsWith('## ')) {
          flush();
          nodes.push(<h3 key={`h-${nodes.length}`}>{line.slice(3)}</h3>);
        } else if (line.startsWith('- ')) {
          bullets.push(line.slice(2));
        } else {
          flush();
          nodes.push(<p key={`p-${nodes.length}`}>{line}</p>);
        }
      });
      flush();
      return <div key={index}>{nodes}</div>;
    });
}
