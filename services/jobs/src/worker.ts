import { Worker } from "bullmq";
import { runMonitorProcessor } from "./processors/monitor-processor.js";
import { runQueryTaskProcessor } from "./processors/query-task-processor.js";
import { sendEmail } from "./providers/email-provider.js";
import { sendSms } from "./providers/sms-provider.js";
import { notificationQueue, queryQueue } from "./queues.js";

new Worker(queryQueue.name, async (job) => runQueryTaskProcessor(job.data), {
  connection: queryQueue.opts.connection,
});

new Worker(
  notificationQueue.name,
  async (job) =>
    runMonitorProcessor(job.data, {
      sendEmail,
      sendSms,
      saveMessage: async () => ({ delivered: true }),
    }),
  {
    connection: notificationQueue.opts.connection,
  },
);
