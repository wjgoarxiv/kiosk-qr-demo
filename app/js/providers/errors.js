export class ProviderError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
  }
}
