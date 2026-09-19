import Link from "next/link";
import Builder from "@/components/builder/Builder";

export default function Home() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="pt-7">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 pb-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-ink-3">
                ROOPAC · Tiruppur · custom print &amp; packaging
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h1 className="font-serif text-[30px] font-semibold leading-none tracking-tight">
                  Roopac Brief
                </h1>
                <p className="text-sm text-ink-3">Enquiry → grounded job brief.</p>
              </div>
            </div>
            <nav
              aria-label="Secondary"
              className="flex gap-5 font-mono text-[10.5px] uppercase tracking-[0.16em]"
            >
              <Link
                href="/health"
                className="text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                Catalogue Health
              </Link>
              <Link
                href="/evals"
                className="text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                Evals
              </Link>
            </nav>
          </div>
          <div aria-hidden className="border-t-2 border-ink" />
          <div aria-hidden className="mt-[3px] border-t border-ink/25" />
        </header>

        <main>
          <Builder />
        </main>

        <footer className="border-t border-line py-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
            Prototype · grounded in the committed roopac.com snapshot · no prices, no promises
          </p>
        </footer>
      </div>
    </div>
  );
}
