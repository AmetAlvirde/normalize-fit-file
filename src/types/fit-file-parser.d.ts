declare module "fit-file-parser" {
  export type FitParserOptions = {
    force?: boolean;
    speedUnit?: string;
    lengthUnit?: string;
    temperatureUnit?: string;
    elapsedRecordField?: boolean;
    pressureUnit?: string;
    mode?: "list" | "cascade" | "both";
  };

  export default class FitParser {
    constructor(options?: FitParserOptions);
    parse(
      content: Buffer | Uint8Array | ArrayBuffer,
      callback: (error: string | null, data: Record<string, unknown>) => void
    ): void;
  }
}
