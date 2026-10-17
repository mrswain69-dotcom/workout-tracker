// Build-generated map: only paths actually included in the native bundle change.
export function nativeArtworkSrc(src, mapping = typeof __NATIVE_ARTWORK__ === 'undefined' ? {} : __NATIVE_ARTWORK__) {
  return typeof src === 'string' && Object.hasOwn(mapping, src) ? mapping[src] : src;
}
