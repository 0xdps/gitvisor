import { Queue, Worker, type ConnectionOptions } from "bullmq";
import type { JobData } from "@gitvisor/shared";
import type { EnqueueOptions, JobHandler, QueueRepository } from "./repository.js";
import { createLogger } from "@gitvisor/logger";

const log = createLogger("queue");

const QUEUE_NAME = "gitvisor-sync";
const QUEUE_PREFIX = "gitvisor:";

export interface BullMQQueueConfig {
  redis: ConnectionOptions;
  prefix?: string;
  queueName?: string;
}

export class BullMQQueueRepository implements QueueRepository {
  private readonly queue: Queue;
  private worker: Worker | null = null;
  private readonly prefix: string;
  private readonly queueName: string;

  constructor(config: BullMQQueueConfig) {
    this.prefix = config.prefix ?? QUEUE_PREFIX;
    this.queueName = config.queueName ?? QUEUE_NAME;
    this.queue = new Queue(this.queueName, {
      connection: config.redis,
      prefix: this.prefix,
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
      this.queueName,
      async (job) => {
        await handler(job.data as JobData);
      },
      {
        connection: this.queue.opts.connection as ConnectionOptions,
        prefix: this.prefix,
        concurrency: 5,
      },
    );

    this.worker.on("failed", (job, err) => {
      log.error({ jobId: job?.id, jobName: job?.name, err: err.message }, "job failed");
    });
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}
