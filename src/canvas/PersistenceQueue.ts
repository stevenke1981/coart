export class SerialPersistenceQueue {
  private chain: Promise<void> = Promise.resolve()

  enqueue(task: () => Promise<void>): Promise<void> {
    this.chain = this.chain.catch(() => undefined).then(task)
    return this.chain
  }
}
