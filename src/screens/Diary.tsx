import * as store from "../srs/store";

function isoDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Diary() {
  const cards = store.all().slice().sort((a, b) => b.learnedAt - a.learnedAt);

  return (
    <section className="flex flex-col gap-4 p-[var(--gutter)]">
      <h1 className="text-[length:var(--text-h1)] leading-[var(--lh-h1)]">what you can say now</h1>
      {cards.length === 0 ? (
        <p className="text-muted">nothing kept yet, go look at something</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {cards.map((card) => (
            <li
              key={card.id}
              data-testid="diary-tile"
              className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-card"
            >
              {card.crop ? (
                <img src={card.crop} alt={card.place ?? card.phrase_fr} className="aspect-square w-full object-cover" />
              ) : (
                <div aria-hidden className="aspect-square w-full bg-line" />
              )}
              <div className="flex flex-col gap-1 p-3">
                <p className="text-[length:var(--text-body)] leading-[var(--lh-body)]">{card.phrase_fr}</p>
                {card.place && <p className="text-[length:var(--text-small)] text-muted">{card.place}</p>}
                <time
                  dateTime={isoDate(card.learnedAt)}
                  className="text-[length:var(--text-micro)] text-muted"
                >
                  {isoDate(card.learnedAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
