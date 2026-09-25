/* Small pure helpers, shared by the reader and the navigation tests. */
(function (root) {
  "use strict";
  const TOTAL = 64;
  const LAST = TOTAL / 2;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const indexFor = page => Math.floor(clamp(Math.round(Number(page) || 1), 1, TOTAL) / 2);
  const spreadFor = index => {
    const i = clamp(Math.round(index), 0, LAST);
    return i === 0 ? [null, 1] : i === LAST ? [TOTAL, null] : [i * 2, i * 2 + 1];
  };
  const fitSpread = (width, height) => {
    const pageWidth = Math.max(1, Math.min(width / 2, height * 3260 / 2975));
    return { width: pageWidth * 2, height: pageWidth * 2975 / 3260 };
  };
  const coverOffset = (index, width) => index === 0 ? -width / 4 : index === LAST ? width / 4 : 0;
  const api = { TOTAL, LAST, clamp, indexFor, spreadFor, fitSpread, coverOffset };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EminentReaderCore = api;
})(typeof window === "object" ? window : globalThis);
