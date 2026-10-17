// Build-generated map: only paths actually included in the native bundle change.
const bundledArtwork = typeof __NATIVE_ARTWORK__ === 'undefined' ? {} : __NATIVE_ARTWORK__;
export function nativeArtworkSrc(src, mapping = bundledArtwork) {
  return typeof src === 'string' && Object.hasOwn(mapping, src) ? mapping[src] : src;
}
