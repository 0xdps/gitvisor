import type { JobData } from "@gitvisor/shared";

export type JobHandler = (job: JobData) => Promise<void>;

export interface QueueRepository {
  /**
   * Add a job to the queue.
   */
  enqueue(job: JobData, opts?: EnqueueOptions): Promise<void>;

  /**
   * Register a handler that processes jobs.
   * Called once during worker startup.
   */
  process(handler: JobHandler): void;

  /**
   * Gracefully shut down the queue connection.
   */
  close(): Promise<void>;
}

export interface EnqueueOptions {
  /** Delay before the job becomes available (ms). */
  delay?: number;
  /** Number of retry attempts on failure. Defaults to 3. */
  attempts?: number;
  /** Job deduplication key — prevents duplicate jobs with the same key. */
  jobId?: string;
}
