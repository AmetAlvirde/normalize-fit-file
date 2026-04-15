export type {
  WorkoutMetadata,
  DeviceInfo,
  SessionSummary,
  LapData,
  RecordData,
  NormalizedFitData,
  NormalizeMapper,
} from "./normalize";

export { downsampleRecords, objectToHybrid } from "./normalize";

export type { FfpParsedFit } from "./parse-ffp";
export { normalizeFFP, parseFitBuffer } from "./parse-ffp";

export { normalizeGarmin } from "./parse-garmin";

export type { RenameRowKeysOptions } from "./ffp-garmin-field-names";
export {
  snakeToCamelKey,
  renameRowKeys,
  renameRowArray,
} from "./ffp-garmin-field-names";

export {
  STRYD_LABEL_TO_CAMEL,
  labelToCamelKey,
  type RenameStrydRowKeysOptions,
  renameStrydRowKeys,
  renameStrydRowArray,
} from "./ffp-stryd-second-pass";
