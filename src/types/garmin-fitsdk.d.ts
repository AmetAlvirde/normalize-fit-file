declare module "@garmin/fitsdk" {
  /** Byte stream over a FIT file buffer. */
  export class Stream {
    static fromBuffer(buffer: Buffer): Stream;
    static fromArrayBuffer(arrayBuffer: ArrayBuffer): Stream;
    length: number;
    position: number;
  }

  export type DecoderReadOptions = {
    mesgListener?: ((mesgNum: number, message: Record<string, unknown>) => void) | null;
    mesgDefinitionListener?: ((messageDefinition: unknown) => void) | null;
    fieldDescriptionListener?: unknown;
    expandSubFields?: boolean;
    expandComponents?: boolean;
    applyScaleAndOffset?: boolean;
    convertTypesToStrings?: boolean;
    convertDateTimesToDates?: boolean;
    includeUnknownData?: boolean;
    mergeHeartRates?: boolean;
    decodeMemoGlobs?: boolean;
    skipHeader?: boolean;
    dataOnly?: boolean;
  };

  export type DecoderReadResult = {
    messages: Record<string, unknown[]>;
    profileVersion: number | null;
    errors: unknown[];
  };

  /** FIT file decoder (Garmin SDK). */
  export class Decoder {
    constructor(stream: Stream);
    static isFIT(stream: Stream): boolean;
    isFIT(): boolean;
    checkIntegrity(): boolean;
    read(options?: DecoderReadOptions): DecoderReadResult;
  }

  export const Profile: Record<string, unknown>;
  export const Utils: Record<string, unknown>;
}
