import { CHARACTERS } from './data/characters';
import { Avatar } from './components/Avatar';

/** Dev-only: /?gallery shows every character in every style. */
export function Gallery() {
  const t0 = performance.now();
  const talk = () => (Math.sin((performance.now() - t0) / 90) + 1) / 2;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: location.search.includes('big') ? '1fr' : 'repeat(3, 1fr)', gap: 8, padding: 8 }}>
      {Object.values(CHARACTERS).flatMap((c) =>
        (['pixar', 'anime', 'real'] as const).map((s, i) => (
          <div key={c.id + s} style={{ textAlign: 'center', fontSize: 12 }}>
            <Avatar character={c} style={s} size={location.search.includes('big') ? 400 : 150} level={i === 0 ? talk : undefined} state={i === 0 ? 'speaking' : 'idle'} />
            <div>{c.name} · {s}</div>
          </div>
        )),
      )}
    </div>
  );
}
