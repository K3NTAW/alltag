import { go, type Screen } from "../lib/screen";

const screens: Screen[] = ["look", "scene", "roleplay", "corrections", "review", "diary", "settings"];

export default function Look() {
  return (
    <section className="flex flex-col gap-3 p-4">
      <h1 className="text-xl">look</h1>
      {screens.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => go(s)}
          className="rounded-full border border-line bg-card px-4 py-2 text-left"
        >
          {s}
        </button>
      ))}
    </section>
  );
}
