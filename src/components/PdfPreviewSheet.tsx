export default function PdfPreviewSheet({
  url,
  title,
  fileName,
  onClose,
}: {
  url: string | null
  title: string
  fileName?: string
  onClose: () => void
}) {
  if (!url) return null
  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col safe-top safe-bottom">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200">
        <h2 className="font-semibold text-slate-900 truncate">{title}</h2>
        <div className="flex items-center gap-3 shrink-0">
          {fileName && (
            // Must be a real, user-tapped anchor (not a JS-triggered click): that's what lets
            // iOS break out of an installed PWA's standalone shell into Safari, whose PDF viewer
            // has its own native Share button — navigator.share() is unreliable there.
            <a href={url} download={fileName} target="_blank" rel="noopener" className="text-sm text-blue-600 font-medium">
              Compartilhar
            </a>
          )}
          <button type="button" onClick={onClose} className="p-1 text-slate-500" aria-label="Fechar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <iframe src={url} title={title} className="flex-1 w-full border-0 bg-slate-200" />
    </div>
  )
}
