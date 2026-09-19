export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="font-mono text-xs tracking-widest text-[var(--ink-3)] uppercase">Roopac Brief</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Scaffold ready — snapshot loaded</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-3)]">
        The brief builder UI arrives in Task 6. Run <code className="font-mono text-sm">npm run verify-data</code> to
        check the committed snapshot.
      </p>
    </main>
  );
}
