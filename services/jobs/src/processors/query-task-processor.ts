export async function runQueryTaskProcessor(input: { taskId: string }) {
  return {
    taskId: input.taskId,
    status: "processed",
  };
}
