import { Queue, Worker, type ConnectionOptions } from "bullmq";
import type { JobData } from "@gitvisor/shared";
import type { EnqueueOptions, JobHandler, QueueRepository } from "./repository.js";

const QUEUE_NAME = "gitvisor-sync";

export interface BullMQQueueConfig {
  redis: ConnectionOptions;
}

export class BullMQQueueRepository implements QueueRepository {
  private readonly queue: Queue;
  private worker: Worker | null = null;

  constructor(config: BullMQQueueConfig) {
    this.queue = new Queue(QUEUE_NAME, {
      connection: config.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }

  async enqueue(job: JobData, opts: EnqueueOptions = {}): Promise<void> {
    await this.queue.add(job.type, job, {
      ...(opts.delay !== undefined ? { delay: opts.delay } : {}),
      ...(opts.attempts !== undefined ? { attempts: opts.attempts } : {}),
      ...(opts.jobId !== undefined ? { jobId: opts.jobId } : {}),
    });
  }

  process(handler: JobHandler): void {
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        await handler(job.data as JobData);
      },
      {
        connection: this.queue.opts.connection as ConnectionOptions,
        concurrency: 5,
      },
    );

    this.worker.on("failed", (job, err) => {
      console.error(`[queue] job ${job?.id} (${job?.name}) failed:`, err.message);
    });
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}
