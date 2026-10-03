/**
 * One definition of "late", shared by every view.
 *
 * The task list had its own copy and the detail page had none, so a task could
 * show a red date and a red row edge in the table and then render its due date
 * in plain ink on the page you opened to act on it.
 */
export function isOverdue(
  dueDate: string | null | undefined,
  status: string | null | undefined,
): boolean {
  if (!dueDate) return false;
  // Finished work cannot be late.
  if (status === 'DONE' || status === 'CANCELLED') return false;
  return new Date(dueDate) < new Date();
}
