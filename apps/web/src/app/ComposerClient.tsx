"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type CvListResponse = {
  items: Array<{
    id: string;
    language: string | null;
    iteration: string | null;
    target: string | null;
    displayName: string;
    displayVersion: string;
    git?: {
      lastCommitAt: string | null;
    };
  }>;
};

type TemplateListResponse = {
  items: Array<{
    id: string;
    name: string;
    status: string;
    version: string;
  }>;
};

type ActivePanel = "workspace" | "templates";

type CvPair = {
  key: string;
  displayName: string;
  displayVersion: string;
  bg: CvListResponse["items"][number] | null;
  en: CvListResponse["items"][number] | null;
  latestTs: number;
};

export function ComposerClient() {
  const [activePanel, setActivePanel] = useState<ActivePanel>("workspace");

  const [cvItems, setCvItems] = useState<CvListResponse["items"]>([]);
  const [templateItems, setTemplateItems] = useState<TemplateListResponse["items"]>([]);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [previewNonce, setPreviewNonce] = useState(Date.now());
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<"bg" | "en">("bg");

  const mostRecentCv = useMemo(() => {
    if (!cvItems.length) return null;
    return [...cvItems].sort((a, b) => {
      const aTs = a.git?.lastCommitAt ? Date.parse(a.git.lastCommitAt) : 0;
      const bTs = b.git?.lastCommitAt ? Date.parse(b.git.lastCommitAt) : 0;
      if (aTs !== bTs) return bTs - aTs;
      return b.id.localeCompare(a.id);
    })[0] ?? null;
  }, [cvItems]);

  const orderedTemplateItems = useMemo(() => {
    const priority = (id: string): number => {
      if (id === "europass-v1") return 0;
      if (id === "edinburgh-v1") return 1;
      return 2;
    };
    return [...templateItems].sort((a, b) => {
      const p = priority(a.id) - priority(b.id);
      if (p !== 0) return p;
      return a.name.localeCompare(b.name);
    });
  }, [templateItems]);

  const cvPairs = useMemo<CvPair[]>(() => {
    const pairs = new Map<string, CvPair>();
    for (const item of cvItems) {
      const key = item.iteration && item.target ? `${item.iteration}::${item.target}` : item.id;
      const ts = item.git?.lastCommitAt ? Date.parse(item.git.lastCommitAt) : 0;
      const existing = pairs.get(key);

      if (!existing) {
        pairs.set(key, {
          key,
          displayName: item.displayName,
          displayVersion: item.displayVersion,
          bg: item.language === "bg" ? item : null,
          en: item.language === "en" ? item : null,
          latestTs: ts,
        });
        continue;
      }

      if (item.language === "bg") {
        existing.bg = item;
        existing.displayName = item.displayName;
        existing.displayVersion = item.displayVersion;
      } else if (item.language === "en") {
        existing.en = item;
      }

      if (!existing.displayName) {
        existing.displayName = item.displayName;
      }
      if (!existing.displayVersion) {
        existing.displayVersion = item.displayVersion;
      }
      existing.latestTs = Math.max(existing.latestTs, ts);
    }

    return [...pairs.values()].sort((a, b) => {
      if (a.latestTs !== b.latestTs) return b.latestTs - a.latestTs;
      return a.key.localeCompare(b.key);
    });
  }, [cvItems]);

  const pdfUrl = useMemo(() => {
    if (!selectedCvId || !selectedTemplateId) {
      return "";
    }
    const params = new URLSearchParams({
      cvId: selectedCvId,
      templateId: selectedTemplateId,
      v: String(previewNonce),
    });
    return `/api/export/pdf?${params.toString()}`;
  }, [previewNonce, selectedCvId, selectedTemplateId]);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspaceData() {
      setLoadingWorkspace(true);
      try {
        const [cvsRes, templatesRes] = await Promise.all([
          fetch("/api/cvs"),
          fetch("/api/templates"),
        ]);
        const cvs = (await cvsRes.json()) as CvListResponse;
        const templates = (await templatesRes.json()) as TemplateListResponse;
        if (cancelled) {
          return;
        }
        setCvItems(cvs.items ?? []);
        setTemplateItems(templates.items ?? []);

        if ((!selectedCvId || !cvs.items?.some((item) => item.id === selectedCvId)) && cvs.items?.length) {
          setSelectedCvId(cvs.items[0].id);
          const lang = cvs.items[0].language === "en" ? "en" : "bg";
          setSelectedLanguage(lang);
        }

        if (
          (!selectedTemplateId || !templates.items?.some((item) => item.id === selectedTemplateId)) &&
          templates.items?.length
        ) {
          const preferred = templates.items.find((entry) => entry.id === "europass-v1");
          setSelectedTemplateId(preferred?.id ?? templates.items[0].id);
        }
      } finally {
        if (!cancelled) {
          setLoadingWorkspace(false);
        }
      }
    }
    void loadWorkspaceData();
    return () => {
      cancelled = true;
    };
    // Initial load only; avoid reset loops that can override user template selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCvMeta = useMemo(
    () => cvItems.find((item) => item.id === selectedCvId) ?? null,
    [cvItems, selectedCvId],
  );

  const variantPair = useMemo(() => {
    if (!selectedCvMeta?.target || !selectedCvMeta?.iteration) {
      return null;
    }
    const prefix = `cv_`;
    const bgId = `${prefix}bg_${selectedCvMeta.iteration}_${selectedCvMeta.target}`;
    const enId = `${prefix}en_${selectedCvMeta.iteration}_${selectedCvMeta.target}`;
    return {
      bg: cvItems.find((item) => item.id === bgId) ?? null,
      en: cvItems.find((item) => item.id === enId) ?? null,
    };
  }, [cvItems, selectedCvMeta?.iteration, selectedCvMeta?.target]);

  const selectedPairKey = useMemo(() => {
    if (!selectedCvMeta) return "";
    if (selectedCvMeta.iteration && selectedCvMeta.target) {
      return `${selectedCvMeta.iteration}::${selectedCvMeta.target}`;
    }
    return selectedCvMeta.id;
  }, [selectedCvMeta]);

  useEffect(() => {
    const lang = selectedCvMeta?.language === "en" ? "en" : "bg";
    setSelectedLanguage(lang);
  }, [selectedCvMeta?.id, selectedCvMeta?.language]);

  function switchLanguage(language: "bg" | "en") {
    setSelectedLanguage(language);
    if (!variantPair) {
      return;
    }
    const next = language === "bg" ? variantPair.bg : variantPair.en;
    if (next?.id) {
      setSelectedCvId(next.id);
      setPreviewNonce(Date.now());
    }
  }

  function switchCvPair(pairKey: string) {
    const pair = cvPairs.find((entry) => entry.key === pairKey);
    if (!pair) {
      return;
    }
    const next = selectedLanguage === "bg" ? (pair.bg ?? pair.en) : (pair.en ?? pair.bg);
    if (next?.id) {
      setSelectedCvId(next.id);
      setPreviewNonce(Date.now());
    }
  }

  function refreshPreview() {
    setPreviewNonce(Date.now());
  }

  function openPdf() {
    if (!pdfUrl) {
      return;
    }
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  }

  function downloadPdf() {
    if (!selectedCvId || !selectedTemplateId) {
      return;
    }
    const params = new URLSearchParams({
      cvId: selectedCvId,
      templateId: selectedTemplateId,
      download: "1",
      v: String(Date.now()),
    });
    window.open(`/api/export/pdf?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="paper-grid grain-overlay h-screen overflow-hidden px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-1)] p-4 shadow-[0_10px_40px_rgba(31,41,55,0.12)] md:p-6">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                Prototype Control Room
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">
                MyFreeCeeVee Composer
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-[var(--ink-muted)]">
                Preview shell for first reality checks with real PDF output.
              </p>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                activePanel === "workspace"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-2)] text-slate-800"
              }`}
              onClick={() => setActivePanel("workspace")}
              type="button"
            >
              CV Workspace
            </button>
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                activePanel === "templates"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-2)] text-slate-800"
              }`}
              onClick={() => setActivePanel("templates")}
              type="button"
            >
              Templates
            </button>
          </div>
          {activePanel === "workspace" && (
            <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[340px_1fr]">
              <article className="min-h-0 overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 pb-6">
                <h2 className="text-xl font-bold text-slate-900">Preview Controls</h2>
                <p className="mt-2 text-sm text-[var(--ink-muted)]">
                  Select CV and template to render a real PDF preview.
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="mb-1 text-sm font-medium text-slate-800">Language</p>
                    <div className="flex w-full justify-center">
                      <div className="inline-flex w-[90%] overflow-hidden rounded-full border border-[var(--line)]">
                        <button
                          className={`flex-1 px-4 py-2 text-sm font-semibold ${
                            selectedLanguage === "bg"
                              ? "bg-[var(--accent)] text-white"
                              : "bg-white text-slate-800"
                          }`}
                          disabled={!variantPair?.bg}
                          onClick={() => switchLanguage("bg")}
                          type="button"
                        >
                          BG
                        </button>
                        <button
                          className={`flex-1 border-l border-[var(--line)] px-4 py-2 text-sm font-semibold ${
                            selectedLanguage === "en"
                              ? "bg-[var(--accent)] text-white"
                              : "bg-white text-slate-800"
                          }`}
                          disabled={!variantPair?.en}
                          onClick={() => switchLanguage("en")}
                          type="button"
                        >
                          EN
                        </button>
                      </div>
                    </div>
                  </div>

                  <label className="block text-sm font-medium text-slate-800">
                    CV Variant
                    <select
                      className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--surface-1)] px-3 py-2"
                      onChange={(event) => switchCvPair(event.target.value)}
                      value={selectedPairKey}
                    >
                      {cvPairs.map((pair) => (
                        <option key={pair.key} value={pair.key}>
                          {pair.displayName} {pair.displayVersion}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-800">
                    Template
                    <select
                      className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--surface-1)] px-3 py-2"
                      onChange={(event) => setSelectedTemplateId(event.target.value)}
                      value={selectedTemplateId}
                    >
                      {orderedTemplateItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} {item.version}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="w-24 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={!selectedCvId || !selectedTemplateId || loadingWorkspace}
                    onClick={refreshPreview}
                    type="button"
                  >
                    Refresh
                  </button>
                  <button
                    className="w-24 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                    disabled={!pdfUrl}
                    onClick={openPdf}
                    type="button"
                  >
                    Open
                  </button>
                  <button
                    className="w-24 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                    disabled={!pdfUrl}
                    onClick={downloadPdf}
                    type="button"
                  >
                    Print
                  </button>
                </div>
              </article>

              <article className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white p-4 pb-5">
                <h3 className="text-lg font-bold text-slate-900">Real PDF Preview</h3>
                <div className="mb-1 mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-1)]">
                  {pdfUrl ? (
                    <iframe
                      className="h-full w-full"
                      src={pdfUrl}
                      title="CV PDF Preview"
                    />
                  ) : (
                    <div className="p-4 text-sm text-[var(--ink-muted)]">
                      Select a CV and template to generate preview.
                    </div>
                  )}
                </div>
              </article>
            </div>
          )}

          {activePanel === "templates" && (
            <div className="flex h-full min-h-0 flex-col">
              <p className="mb-3 text-xs text-[var(--ink-muted)]">
                Source CV: {mostRecentCv ? `${mostRecentCv.displayName} ${mostRecentCv.displayVersion}` : "N/A"}
              </p>
              <div className="grid min-h-0 flex-1 gap-4 overflow-auto md:grid-cols-2 xl:grid-cols-3">
                {orderedTemplateItems.map((item) => {
                  const galleryUrl = mostRecentCv
                    ? `/api/export/image?cvId=${encodeURIComponent(mostRecentCv.id)}&templateId=${encodeURIComponent(item.id)}&v=${previewNonce}`
                    : "";
                  return (
                    <article key={item.id} className="flex flex-col rounded-xl border border-[var(--line)] bg-white p-3">
                      <h3 className="text-base font-bold text-slate-900">{item.name} {item.version}</h3>
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">{item.id}</p>
                      <div className="mt-3 aspect-[210/297] w-full overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface-1)]">
                        {galleryUrl ? (
                          <Image
                            alt={`${item.id} preview`}
                            className="h-full w-full object-contain"
                            height={1755}
                            src={galleryUrl}
                            unoptimized
                            width={1242}
                          />
                        ) : (
                          <div className="p-3 text-xs text-[var(--ink-muted)]">No CV available for preview.</div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
