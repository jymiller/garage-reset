/** New uploads have a verified original; older preview-only uploads keep their existing UI. */
export function OriginalPhotoLinks({ photo }: { photo: string }) {
  if (!/^\/api\/photos\/[a-f0-9]{64}\.jpg$/.test(photo)) return null
  return <div className="quick-original-links"><a href={`${photo}?original=1`} download>Download original</a><a href={`${photo}?metadata=1`} download="photo-metadata.json">Photo metadata</a></div>
}
