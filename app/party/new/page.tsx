"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createParty } from "@/app/_lib/partyApi";

type Decade = { label: string; start: number; end: number };
type Genre = { id: number; name: string };
type Provider = { id: number; name: string; logo_path: string | null };

const TMDB_IMG = "https://image.tmdb.org/t/p/w92";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function PinkButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        "rounded-full px-6 py-3 font-semibold text-white",
        "bg-gradient-to-r from-fuchsia-500 to-pink-500",
        "shadow-[0_10px_30px_rgba(236,72,153,0.25)]",
        "hover:brightness-110 active:brightness-95",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        props.className
      )}
    >
      {children}
    </button>
  );
}

function GlassCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-[28px] p-6",
        "border border-white/10",
        "bg-gradient-to-b from-[#0b1630]/70 to-[#071024]/70",
        "shadow-[0_20px_60px_rgba(0,0,0,0.45)]",
        "backdrop-blur"
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Chip({
  label,
  onRemove,
  accent = false,
}: {
  label: string;
  onRemove?: () => void;
  accent?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm",
        "border",
        accent
          ? "border-pink-500/30 bg-pink-500/10 text-pink-100"
          : "border-white/10 bg-white/5 text-white/85"
      )}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className={cx(
            "rounded-full px-2 py-0.5 text-xs",
            accent ? "bg-pink-500/20 hover:bg-pink-500/30" : "bg-white/10 hover:bg-white/15"
          )}
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

function DecadeDropdown({
  decades,
  valueStart,
  onChangeStart,
}: {
  decades: Decade[];
  valueStart: number | null;
  onChangeStart: (start: number | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (valueStart == null) return "Any";
    const d = decades.find((x) => x.start === valueStart);
    return d?.label ?? "Any";
  }, [decades, valueStart]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "mt-3 w-full rounded-2xl px-4 py-3 text-left text-white",
          "border border-white/10 bg-black/25",
          "outline-none focus:border-pink-500/30",
          "flex items-center justify-between gap-3"
        )}
      >
        <span className="text-white/90">{selectedLabel}</span>
        <span className={cx("text-white/60 transition-transform", open && "rotate-180")}>
          ▾
        </span>
      </button>

      {open && (
        <>
          {/* click outside */}
          <button
            type="button"
            className="fixed inset-0 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Close decade dropdown"
          />

          <div
            className={cx(
              "absolute z-50 mt-2 w-full overflow-hidden rounded-2xl",
              "border border-white/10",
              "bg-gradient-to-b from-[#0b1630]/95 to-[#071024]/95",
              "shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
            )}
          >
            <div className="max-h-72 overflow-auto p-2">
              <button
                type="button"
                onClick={() => {
                  onChangeStart(null);
                  setOpen(false);
                }}
                className={cx(
                  "w-full rounded-xl px-3 py-2 text-left text-sm",
                  valueStart == null
                    ? "bg-pink-500/15 text-pink-100 border border-pink-500/20"
                    : "text-white/80 hover:bg-white/5"
                )}
              >
                Any
              </button>

              <div className="my-2 h-px bg-white/10" />

              {decades.map((d) => {
                const active = valueStart === d.start;
                return (
                  <button
                    key={d.start}
                    type="button"
                    onClick={() => {
                      onChangeStart(d.start);
                      setOpen(false);
                    }}
                    className={cx(
                      "w-full rounded-xl px-3 py-2 text-left text-sm",
                      active
                        ? "bg-pink-500/15 text-pink-100 border border-pink-500/20"
                        : "text-white/80 hover:bg-white/5"
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CreatePartyPage() {
  const router = useRouter();

  const [name, setName] = useState("Movie Night");
  const [invite, setInvite] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [watchRegion, setWatchRegion] = useState("US");

  const [decades, setDecades] = useState<Decade[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);

  const [decadeStart, setDecadeStart] = useState<number | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<Set<number>>(new Set());
  const [selectedProviders, setSelectedProviders] = useState<Set<number>>(new Set());

  const [runtimeMin, setRuntimeMin] = useState("");
  const [runtimeMax, setRuntimeMax] = useState("");

  const [providerSearch, setProviderSearch] = useState("");
  const [genreSearch, setGenreSearch] = useState("");

  const runtimeMinNum = useMemo(() => {
    const n = Number(runtimeMin);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [runtimeMin]);

  const runtimeMaxNum = useMemo(() => {
    const n = Number(runtimeMax);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [runtimeMax]);

  const decadeObj = useMemo(() => {
    if (decadeStart == null) return undefined;
    const d = decades.find((x) => x.start === decadeStart);
    if (!d) return undefined;
    return { start: d.start, end: d.end };
  }, [decadeStart, decades]);

  const selectedProviderList = useMemo(() => {
    const ids = selectedProviders;
    return providers.filter((p) => ids.has(p.id));
  }, [providers, selectedProviders]);

  const selectedGenreList = useMemo(() => {
    const ids = selectedGenres;
    return genres.filter((g) => ids.has(g.id));
  }, [genres, selectedGenres]);

  const filteredProviders = useMemo(() => {
    const q = providerSearch.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => p.name.toLowerCase().includes(q));
  }, [providers, providerSearch]);

  const filteredGenres = useMemo(() => {
    const q = genreSearch.trim().toLowerCase();
    if (!q) return genres;
    return genres.filter((g) => g.name.toLowerCase().includes(q));
  }, [genres, genreSearch]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [decRes, genRes] = await Promise.all([
          fetch("/api/tmdb/decades", { cache: "no-store" }),
          fetch("/api/tmdb/genres", { cache: "no-store" }),
        ]);
        const decJson = await decRes.json();
        const genJson = await genRes.json();

        if (!cancelled) {
          setDecades(decJson.decades ?? []);
          setGenres(genJson.genres ?? []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load filters");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/tmdb/providers?region=${encodeURIComponent(watchRegion)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!cancelled) setProviders(json.providers ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load providers");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [watchRegion]);

  function toggleSet(
    setter: (s: Set<number>) => void,
    current: Set<number>,
    id: number
  ) {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function handleCreate() {
    setLoading(true);
    setError(null);

    try {
      const res = await createParty({
        name,
        movieCount: 10,
        watchRegion,
        providerIds: Array.from(selectedProviders),
        filters: {
          decade: decadeObj,
          genreIds: Array.from(selectedGenres),
          runtimeMin: runtimeMinNum,
          runtimeMax: runtimeMaxNum,
        },
      });

      setInvite(res.invite_code);
      setPartyId(res.party_id);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create party");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-7">
        <h1 className="text-4xl font-bold tracking-tight text-white">Create Party</h1>
        <p className="mt-2 text-white/60">
          Pick streaming + preferences so everyone swipes from the same vibe.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
          {error}
        </div>
      )}

      {/* Party name + CTA */}
      <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div
          className={cx(
            "rounded-[28px] border border-white/10 p-6",
            "bg-gradient-to-b from-[#0b1630]/70 to-[#071024]/70",
            "shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur"
          )}
        >
          <label className="text-sm font-medium text-white/70">Party name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cx(
              "mt-3 w-full rounded-2xl px-4 py-3 text-white",
              "border border-white/10 bg-black/25",
              "placeholder:text-white/30 outline-none focus:border-pink-500/30"
            )}
            placeholder="Movie Night"
          />
        </div>

        <PinkButton onClick={handleCreate} disabled={loading}>
          {loading ? "Creating..." : "Create party"}
        </PinkButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Providers */}
        <GlassCard
          title="Streaming Providers"
          subtitle="Filters to subscription streaming (flatrate) in your region."
          right={
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">Region</span>
              <input
                value={watchRegion}
                onChange={(e) => setWatchRegion(e.target.value.toUpperCase().slice(0, 2))}
                className="w-16 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-pink-500/30"
                placeholder="US"
              />
            </div>
          }
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm text-white/70">
              Selected: <span className="font-semibold text-white">{selectedProviders.size}</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedProviders(new Set())}
              className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/80 hover:bg-black/30"
            >
              Clear
            </button>
          </div>

          {selectedProviderList.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedProviderList.slice(0, 10).map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  accent
                  onRemove={() => toggleSet(setSelectedProviders, selectedProviders, p.id)}
                />
              ))}
              {selectedProviderList.length > 10 && (
                <span className="text-sm text-white/50">
                  +{selectedProviderList.length - 10} more
                </span>
              )}
            </div>
          )}

          <input
            value={providerSearch}
            onChange={(e) => setProviderSearch(e.target.value)}
            className={cx(
              "mb-3 w-full rounded-2xl px-4 py-3 text-white",
              "border border-white/10 bg-black/25",
              "placeholder:text-white/30 outline-none focus:border-pink-500/30"
            )}
            placeholder="Search providers (Netflix, Hulu, Prime...)"
          />

          <div className="max-h-80 overflow-auto rounded-[24px] border border-white/10 bg-black/20 p-2">
            {providers.length === 0 ? (
              <div className="p-4 text-sm text-white/60">Loading providers…</div>
            ) : (
              <div className="grid gap-1">
                {providers
                  .filter((p) => p.name.toLowerCase().includes(providerSearch.trim().toLowerCase()))
                  .map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-sm text-white/90 hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProviders.has(p.id)}
                        onChange={() => toggleSet(setSelectedProviders, selectedProviders, p.id)}
                        className="h-4 w-4"
                      />

                      <div className="flex items-center gap-3">
                        {p.logo_path ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${TMDB_IMG}${p.logo_path}`}
                            alt={`${p.name} logo`}
                            className="h-7 w-7 rounded-lg bg-white/10 object-contain p-1"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-lg bg-white/10" />
                        )}
                        <span>{p.name}</span>
                      </div>
                    </label>
                  ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Preferences */}
        <GlassCard title="Party Preferences" subtitle="These help keep your swipe pool on-theme.">
          <div className="grid gap-4">
            {/* Decade (custom dropdown) */}
            <div>
              <label className="text-sm font-medium text-white/70">Decade</label>
              <DecadeDropdown
                decades={decades}
                valueStart={decadeStart}
                onChangeStart={setDecadeStart}
              />
            </div>

            {/* Runtime */}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-white/70">Min runtime (minutes)</label>
                <input
                  value={runtimeMin}
                  onChange={(e) => setRuntimeMin(e.target.value)}
                  className={cx(
                    "mt-3 w-full rounded-2xl px-4 py-3 text-white",
                    "border border-white/10 bg-black/25",
                    "placeholder:text-white/30 outline-none focus:border-pink-500/30"
                  )}
                  inputMode="numeric"
                  placeholder="e.g. 80"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white/70">Max runtime (minutes)</label>
                <input
                  value={runtimeMax}
                  onChange={(e) => setRuntimeMax(e.target.value)}
                  className={cx(
                    "mt-3 w-full rounded-2xl px-4 py-3 text-white",
                    "border border-white/10 bg-black/25",
                    "placeholder:text-white/30 outline-none focus:border-pink-500/30"
                  )}
                  inputMode="numeric"
                  placeholder="e.g. 140"
                />
              </div>
            </div>

            {/* Genres */}
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <label className="text-sm font-medium text-white/70">Genres</label>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-white/70">
                    Selected: <span className="font-semibold text-white">{selectedGenres.size}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedGenres(new Set())}
                    className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/80 hover:bg-black/30"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {selectedGenreList.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedGenreList.slice(0, 12).map((g) => (
                    <Chip
                      key={g.id}
                      label={g.name}
                      onRemove={() => toggleSet(setSelectedGenres, selectedGenres, g.id)}
                    />
                  ))}
                  {selectedGenreList.length > 12 && (
                    <span className="text-sm text-white/50">
                      +{selectedGenreList.length - 12} more
                    </span>
                  )}
                </div>
              )}

              <input
                value={genreSearch}
                onChange={(e) => setGenreSearch(e.target.value)}
                className={cx(
                  "mb-3 w-full rounded-2xl px-4 py-3 text-white",
                  "border border-white/10 bg-black/25",
                  "placeholder:text-white/30 outline-none focus:border-pink-500/30"
                )}
                placeholder="Search genres (Action, Comedy, Horror...)"
              />

              <div className="max-h-80 overflow-auto rounded-[24px] border border-white/10 bg-black/20 p-2">
                {genres.length === 0 ? (
                  <div className="p-4 text-sm text-white/60">Loading genres…</div>
                ) : (
                  <div className="grid gap-1">
                    {genres
                      .filter((g) => g.name.toLowerCase().includes(genreSearch.trim().toLowerCase()))
                      .map((g) => (
                        <label
                          key={g.id}
                          className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-sm text-white/90 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={selectedGenres.has(g.id)}
                            onChange={() => toggleSet(setSelectedGenres, selectedGenres, g.id)}
                            className="h-4 w-4"
                          />
                          <span>{g.name}</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Invite + Start */}
          {invite && partyId && (
            <div className="mt-6 rounded-[24px] border border-white/10 bg-black/25 p-5">
              <div className="text-sm text-white/60">Invite code</div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <code className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white">
                  {invite}
                </code>

                <button
                  onClick={() => navigator.clipboard.writeText(invite)}
                  className="rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium text-white hover:bg-white/15"
                >
                  Copy
                </button>

                <PinkButton onClick={() => router.push(`/party/swipe?party=${partyId}`)}>
                  Start swiping
                </PinkButton>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
