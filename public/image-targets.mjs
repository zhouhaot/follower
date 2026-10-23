/** Verified original target order and dimensions, cross-checked against assets.json.
 * Never infer target indices from UI order or from a caller-supplied card title.
 */
export const IMAGE_TARGETS = Object.freeze({
  flowers: Object.freeze({ key: 'flowers', index: 0, width: 900, height: 1260, title: '花开有声' }),
  peony: Object.freeze({ key: 'peony', index: 1, width: 877, height: 1222, title: '牡丹承瑞' }),
  chrysanthemum: Object.freeze({ key: 'chrysanthemum', index: 2, width: 875, height: 1228, title: '菊影流金' }),
  lotus: Object.freeze({ key: 'lotus', index: 3, width: 884, height: 1255, title: '清荷入梦' }),
  leaves: Object.freeze({ key: 'leaves', index: 4, width: 881, height: 1255, title: '花叶生辉' }),
});
export const imageTargetFor = (key) => typeof key === 'string' && Object.hasOwn(IMAGE_TARGETS, key) ? IMAGE_TARGETS[key] : null;

/** Reject a truncated, reordered or mismatched file before any matching begins. */
export function validateTargetDimensions(dimensions) {
  const targets = Object.values(IMAGE_TARGETS);
  if (!Array.isArray(dimensions) || dimensions.length !== targets.length || targets.some(({ index, width, height }) =>
    !Array.isArray(dimensions[index]) || dimensions[index].length !== 2 || dimensions[index][0] !== width || dimensions[index][1] !== height)) {
    throw new Error('Unexpected image target dataset: expected all five verified dimensions in original order');
  }
  return true;
}
