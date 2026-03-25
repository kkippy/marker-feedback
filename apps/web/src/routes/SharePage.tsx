import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnnotationCanvas } from '@/components/editor/AnnotationCanvas';
import { CommentSidebar } from '@/components/editor/CommentSidebar';
import { TopBar } from '@/components/editor/TopBar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { downloadDataUrl } from '@/lib/export';
import { getShare, syncShareDraft } from '@/lib/persistence';
import { useEditorStore } from '@/lib/useEditorStore';

export function SharePage() {
  const { token = '' } = useParams(); const navigate = useNavigate(); const [loading, setLoading] = useState(true); const [missing, setMissing] = useState(false); const [exporter, setExporter] = useState<(() => string | undefined) | null>(null); const draft = useEditorStore((state) => state.draft); const setDraft = useEditorStore((state) => state.setDraft); const zoom = useEditorStore((state) => state.zoom); const zoomIn = useEditorStore((state) => state.zoomIn); const zoomOut = useEditorStore((state) => state.zoomOut); const resetDraft = useEditorStore((state) => state.resetDraft);
  useEffect(() => { const load = async () => { const share = await getShare(token); if (!share) { setMissing(true); setLoading(false); return; } setDraft(share.draft); setLoading(false); }; load(); }, [setDraft, token]);
  useEffect(() => { if (!loading && !missing && draft.asset) syncShareDraft(token, draft); }, [draft, loading, missing, token]);
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading shared feedback…</div>;
  if (missing) return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><Card className="max-w-lg space-y-4 p-8 text-center"><h1 className="text-2xl font-semibold text-slate-900">Share link not found</h1><p className="text-slate-600">This token does not exist in local storage. Create a share from the editor first.</p><Button type="button" onClick={() => navigate('/editor')}>Open editor</Button></Card></div>;
  return <div className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900"><div className="mx-auto flex max-w-[1600px] flex-col gap-6"><TopBar annotationCount={draft.annotations.length} threadCount={draft.threads.length} zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onSaveDraft={() => {}} onCreateShare={() => {}} onExport={() => { const png = exporter?.(); if (png) downloadDataUrl(png, `share-${token}.png`); }} onReset={resetDraft} /><div className="grid gap-6 xl:grid-cols-[1fr,360px]"><div className="space-y-4"><Card className="p-4"><div className="flex items-center justify-between gap-2"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Shared review</p><h1 className="mt-2 text-2xl font-semibold text-slate-900">Token: {token}</h1><p className="mt-1 text-sm text-slate-500">Anonymous collaborators can reply and toggle issue status.</p></div><Button type="button" className="bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={() => navigate('/editor')}>Back to editor</Button></div></Card><AnnotationCanvas readOnly onExportReady={setExporter} /></div><CommentSidebar /></div></div></div>;
}
