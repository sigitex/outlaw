export class UnsupportedTransactionError extends Error {
  override readonly name = "UnsupportedTransactionError"

  constructor() {
    super("This connection does not support transactions.")
  }
}
