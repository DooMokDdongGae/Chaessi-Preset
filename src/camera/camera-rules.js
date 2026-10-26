// Independent caption selection. Coordinates remain continuous; weights are not angles.
export const LEGACY_CAMERA_RULES = 'camera-local-calibration/1';
export const CAMERA_RULES = 'camera-single-direction/2';
export const CAMERA_VOCABULARY = 'camera-english/1';
export const CAMERA_STRENGTH = 1.2;
export const supportsCameraRules = rules => [LEGACY_CAMERA_RULES, CAMERA_RULES].includes(rules);

export function singleExpression(axis, value, yawNames, anchors) {
  if (axis === 'yaw') {
    const angle = ((value % 360) + 360) % 360;
    const index = Math.floor((angle + 22.5) / 45) % 8;
    const coordinate = ((angle - index * 45 + 180) % 360 + 360) % 360 - 180;
    return [{axis, term:`bearing-${index}`, text:yawNames[index], base:CAMERA_STRENGTH,
      coordinate, support:[-22.5, 22.5]}];
  }
  if (!anchors) return null;
  let index = 0;
  while (index < anchors.length - 1 && value >= (anchors[index][0] + anchors[index + 1][0]) / 2) index++;
  const [point, term, text] = anchors[index];
  const left = index ? (anchors[index - 1][0] + point) / 2 : point;
  const right = index + 1 < anchors.length ? (point + anchors[index + 1][0]) / 2 : point;
  return [{axis, term, text, base:CAMERA_STRENGTH, coordinate:value, support:[left, right]}];
}
