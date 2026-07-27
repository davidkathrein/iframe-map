export function etagForConditionalWrite(etag: string) {
  return etag.startsWith("W/") ? etag.slice(2) : etag;
}
