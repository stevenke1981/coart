export type ScheduleFrame = (callback: FrameRequestCallback) => number
export type CancelFrame = (handle: number) => void

export class PointerScheduler<T> {
  private pending: T | null = null
  private frame: number | null = null
  private readonly process: (sample: T) => void
  private readonly scheduleFrame: ScheduleFrame
  private readonly cancelFrame: CancelFrame

  constructor(
    process: (sample: T) => void,
    scheduleFrame: ScheduleFrame = requestAnimationFrame,
    cancelFrame: CancelFrame = cancelAnimationFrame
  ) {
    this.process = process
    this.scheduleFrame = scheduleFrame
    this.cancelFrame = cancelFrame
  }

  schedule(sample: T): void {
    this.pending = sample
    if (this.frame !== null) return
    this.frame = this.scheduleFrame(() => {
      this.frame = null
      this.flush()
    })
  }

  flush(): void {
    const sample = this.pending
    this.pending = null
    if (sample !== null) this.process(sample)
  }

  cancel(): void {
    if (this.frame !== null) this.cancelFrame(this.frame)
    this.frame = null
    this.pending = null
  }

  hasPending(): boolean {
    return this.pending !== null
  }
}
