declare module "lingo.dev" {
  interface TranslateOptions {
    text: string;
    targetLanguage: string;
  }

  interface TranslateResult {
    translation: string;
  }

  export default class Lingo {
    constructor(config: { apiKey: string });
    translate(options: TranslateOptions): Promise<TranslateResult>;
  }
}