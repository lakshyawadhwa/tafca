import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  ComplianceEntryStatus,
  COMPLIANCE_ENTRY_TRANSITIONS,
} from '@ca-practice-os/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FirmScopedService } from '../common/base/firm-scoped.service';
import {
  computeDuePeriods,
  istToday,
  subtractDays,
  utcDate,
  DeadlineRecurrence,
} from './period.util';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { UpdateEntryStatusDto } from './dto/update-entry-status.dto';

const DEFAULT_BUFFER_DAYS = 3;
const FILED_LIKE = new Set([
  ComplianceEntryStatus.FILED,
  ComplianceEntryStatus.NOT_APPLICABLE,
]);

/** Parse a YYYY-MM-DD (or full ISO) string into a UTC-midnight date. */
function parseIsoDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return utcDate(y, m - 1, d);
}

@Injectable()
export class ComplianceService extends FirmScopedService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(prismaService: PrismaService) {
    super(prismaService);
  }

  // ───────────────────────── Deadline masters ─────────────────────────

  /** Platform statutory deadline masters, optionally filtered. */
  async listDeadlines(category?: string, entityType?: string) {
    const deadlines = await this.unscopedPrisma.statutoryDeadline.findMany({
      where: {
        isActive: true,
        ...(category ? { category: category as any } : {}),
        ...(entityType ? { applicableTo: { has: entityType as any } } : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return deadlines.map((d) => this.deadlineDto(d));
  }

  /**
   * Suggest deadlines for a client: applicable to its entity type, GST ones
   * only when the client has at least one GST number, excluding those already
   * assigned.
   */
  async getSuggestions(clientId: string) {
    const client = await this.requireClient(clientId);
    const gstCount = await this.prisma.clientGstNumber.count({
      where: { clientId },
    });
    const hasGst = gstCount > 0;

    const [deadlines, existing] = await Promise.all([
      this.unscopedPrisma.statutoryDeadline.findMany({
        where: { isActive: true, applicableTo: { has: client.entityType as any } },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.clientComplianceAssignment.findMany({
        where: { clientId },
        select: { statutoryDeadlineId: true },
      }),
    ]);
    const assigned = new Set(existing.map((a) => a.statutoryDeadlineId));

    return deadlines
      .filter((d) => !assigned.has(d.id))
      .filter((d) => d.category !== 'GST' || hasGst)
      .map((d) => ({
        ...this.deadlineDto(d),
        reason:
          d.category === 'GST' && hasGst
            ? 'Has GST registration'
            : `Applies to ${client.entityType}`,
      }));
  }

  // ───────────────────────── Assignments ─────────────────────────

  async createAssignment(dto: CreateAssignmentDto) {
    const client = await this.requireClient(dto.clientId);
    const deadline = await this.requireDeadline(dto.statutoryDeadlineId);

    if (!dto.force && !deadline.applicableTo.includes(client.entityType as any)) {
      throw new BadRequestException(
        `${deadline.name} does not normally apply to a ${client.entityType}. ` +
          `Pass force=true to assign anyway.`,
      );
    }

    const existing = await this.prisma.clientComplianceAssignment.findFirst({
      where: {
        clientId: dto.clientId,
        statutoryDeadlineId: dto.statutoryDeadlineId,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'This deadline is already assigned to the client',
      );
    }

    const userId = this.getUserId();
    const created = await this.prisma.clientComplianceAssignment.create({
      data: {
        firmId: this.getFirmId(),
        clientId: dto.clientId,
        statutoryDeadlineId: dto.statutoryDeadlineId,
        isEnabled: true,
        autoGenerateTasks: dto.autoGenerateTasks ?? true,
        internalBufferDays: dto.internalBufferDays ?? null,
        customDueDateDay: dto.customDueDateDay ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
    });
    return this.assignmentDto(created, deadline);
  }

  /** Assign one or more deadlines to one or more clients; skips conflicts. */
  async bulkAssign(
    clientIds: string[],
    statutoryDeadlineIds: string[],
    autoGenerateTasks = true,
  ) {
    let created = 0;
    let skipped = 0;
    for (const clientId of clientIds) {
      for (const statutoryDeadlineId of statutoryDeadlineIds) {
        try {
          await this.createAssignment({
            clientId,
            statutoryDeadlineId,
            autoGenerateTasks,
            force: true, // suggestions already filtered applicability
          });
          created++;
        } catch (e) {
          if (e instanceof ConflictException || e instanceof NotFoundException) {
            skipped++;
          } else {
            throw e;
          }
        }
      }
    }
    return { created, skipped };
  }

  async listAssignments(clientId?: string) {
    const assignments = await this.prisma.clientComplianceAssignment.findMany({
      where: { ...(clientId ? { clientId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    if (assignments.length === 0) return { items: [] };

    const deadlines = await this.deadlineMap(
      assignments.map((a) => a.statutoryDeadlineId),
    );
    return {
      items: assignments.map((a) =>
        this.assignmentDto(a, deadlines.get(a.statutoryDeadlineId)),
      ),
    };
  }

  async updateAssignment(id: string, dto: UpdateAssignmentDto) {
    const existing = await this.prisma.clientComplianceAssignment.findFirst({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Assignment not found');

    const updated = await this.prisma.clientComplianceAssignment.update({
      where: { id },
      data: {
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        ...(dto.autoGenerateTasks !== undefined
          ? { autoGenerateTasks: dto.autoGenerateTasks }
          : {}),
        ...(dto.internalBufferDays !== undefined
          ? { internalBufferDays: dto.internalBufferDays }
          : {}),
        ...(dto.customDueDateDay !== undefined
          ? { customDueDateDay: dto.customDueDateDay }
          : {}),
        updatedBy: this.getUserId(),
      },
    });
    const deadline = await this.requireDeadline(updated.statutoryDeadlineId);
    return this.assignmentDto(updated, deadline);
  }

  async deleteAssignment(id: string) {
    const existing = await this.prisma.clientComplianceAssignment.findFirst({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Assignment not found');

    await this.prisma.clientComplianceAssignment.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: this.getUserId() },
    });
  }

  // ───────────────────────── Calendar (compute-on-read) ─────────────────────────

  async getCalendar(q: CalendarQueryDto) {
    const today = istToday();
    const from = q.from ? parseIsoDate(q.from) : subtractDays(today, 30);
    let to = q.to ? parseIsoDate(q.to) : new Date(today.getTime() + 60 * 86_400_000);
    // Cap the window at ~12 months to keep computation bounded.
    const MAX_MS = 366 * 86_400_000;
    if (to.getTime() - from.getTime() > MAX_MS) {
      to = new Date(from.getTime() + MAX_MS);
    }

    const assignments = await this.prisma.clientComplianceAssignment.findMany({
      where: { isEnabled: true, ...(q.clientId ? { clientId: q.clientId } : {}) },
    });
    if (assignments.length === 0) {
      return { items: [], totalItems: 0, page: q.page ?? 1, pageSize: q.pageSize ?? 100 };
    }

    const deadlineIds = [...new Set(assignments.map((a) => a.statutoryDeadlineId))];
    const clientIds = [...new Set(assignments.map((a) => a.clientId))];

    const [deadlines, clients, overrides, stored, bufferDefault] = await Promise.all([
      this.deadlineMap(deadlineIds),
      this.clientMap(clientIds),
      this.overrideMap(deadlineIds),
      this.storedEntryMap(clientIds, deadlineIds),
      this.firmBufferDays(),
    ]);

    const items: any[] = [];
    for (const a of assignments) {
      const deadline = deadlines.get(a.statutoryDeadlineId);
      const client = clients.get(a.clientId);
      if (!deadline || !client) continue; // inactive deadline or archived/deleted client

      const periods = computeDuePeriods(
        this.recurrenceOf(deadline),
        from,
        to,
        a.customDueDateDay,
      );
      if (
        periods.length === 0 &&
        deadline.recurrence !== 'ONE_OFF' &&
        deadline.recurrenceDay == null
      ) {
        this.logger.warn(
          `Deadline ${deadline.code} has null recurrenceDay — skipped in generation`,
        );
      }

      const buffer = a.internalBufferDays ?? bufferDefault;
      for (const p of periods) {
        const overrideDate = overrides.get(`${deadline.id}|${p.periodLabel}`);
        const dueDate = overrideDate ?? p.dueDate;
        const storedEntry = stored.get(
          `${a.clientId}|${deadline.id}|${p.periodLabel}`,
        );
        const status = (storedEntry?.status as ComplianceEntryStatus) ??
          ComplianceEntryStatus.PENDING;

        items.push({
          clientId: a.clientId,
          clientName: client.displayName,
          statutoryDeadlineId: deadline.id,
          deadlineCode: deadline.code,
          deadlineName: deadline.name,
          category: deadline.category,
          recurrence: deadline.recurrence,
          periodLabel: p.periodLabel,
          dueDate: dueDate.toISOString().slice(0, 10),
          internalDueDate: subtractDays(dueDate, buffer)
            .toISOString()
            .slice(0, 10),
          status,
          isOverdue: dueDate.getTime() < today.getTime() && !FILED_LIKE.has(status),
          linkedTaskId: storedEntry?.linkedTaskId ?? null,
          penaltyPerDay: deadline.penaltyPerDay
            ? Number(deadline.penaltyPerDay)
            : null,
        });
      }
    }

    let filtered = items;
    if (q.category) filtered = filtered.filter((i) => i.category === q.category);
    if (q.status) filtered = filtered.filter((i) => i.status === q.status);
    filtered.sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        a.clientName.localeCompare(b.clientName),
    );

    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 100;
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      totalItems: filtered.length,
      page,
      pageSize,
    };
  }

  /**
   * Manually set the status of a calendar entry. Because entries are computed
   * on read, this recomputes the authoritative due date for the (deadline,
   * period), validates the transition, and materialises/updates the stored row.
   */
  async updateEntryStatus(dto: UpdateEntryStatusDto) {
    const client = await this.requireClient(dto.clientId);
    const deadline = await this.requireDeadline(dto.statutoryDeadlineId);

    const assignment = await this.prisma.clientComplianceAssignment.findFirst({
      where: {
        clientId: dto.clientId,
        statutoryDeadlineId: dto.statutoryDeadlineId,
      },
    });
    if (!assignment) {
      throw new NotFoundException('No compliance assignment for this deadline');
    }

    // Recompute the due date for the requested period over a wide window.
    const today = istToday();
    const wideStart = new Date(today.getTime() - 550 * 86_400_000);
    const wideEnd = new Date(today.getTime() + 550 * 86_400_000);
    const periods = computeDuePeriods(
      this.recurrenceOf(deadline),
      wideStart,
      wideEnd,
      assignment.customDueDateDay,
    );
    const match = periods.find((p) => p.periodLabel === dto.periodLabel);
    if (!match) {
      throw new BadRequestException(
        `Unknown period '${dto.periodLabel}' for deadline ${deadline.code}`,
      );
    }
    const overrideDate = (await this.overrideMap([deadline.id])).get(
      `${deadline.id}|${dto.periodLabel}`,
    );
    const dueDate = overrideDate ?? match.dueDate;
    const buffer =
      assignment.internalBufferDays ?? (await this.firmBufferDays());
    const internalDueDate = subtractDays(dueDate, buffer);

    const existing = await this.prisma.complianceCalendarEntry.findFirst({
      where: {
        clientId: dto.clientId,
        statutoryDeadlineId: dto.statutoryDeadlineId,
        periodLabel: dto.periodLabel,
      },
    });
    const current =
      (existing?.status as ComplianceEntryStatus) ??
      ComplianceEntryStatus.PENDING;

    if (dto.status === current) {
      // Idempotent no-op.
      return this.entryDto(existing, {
        client,
        deadline,
        dueDate,
        internalDueDate,
        periodLabel: dto.periodLabel,
        status: current,
      });
    }

    const allowed = COMPLIANCE_ENTRY_TRANSITIONS[current] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Cannot change status from ${current} to ${dto.status}`,
        error: 'Invalid Transition',
        allowed_transitions: allowed,
      });
    }

    let row;
    if (existing) {
      row = await this.prisma.complianceCalendarEntry.update({
        where: { id: existing.id },
        data: { status: dto.status },
      });
    } else {
      row = await this.prisma.complianceCalendarEntry.create({
        data: {
          firmId: this.getFirmId(),
          clientId: dto.clientId,
          statutoryDeadlineId: dto.statutoryDeadlineId,
          periodLabel: dto.periodLabel,
          dueDate,
          internalDueDate,
          status: dto.status,
        },
      });
    }

    return this.entryDto(row, {
      client,
      deadline,
      dueDate,
      internalDueDate,
      periodLabel: dto.periodLabel,
      status: dto.status,
    });
  }

  // ───────────────────────── Private helpers ─────────────────────────

  private recurrenceOf(d: any): DeadlineRecurrence {
    return {
      recurrence: d.recurrence,
      recurrenceDay: d.recurrenceDay,
      recurrenceMonth: d.recurrenceMonth,
      quarterMonthOffset: d.quarterMonthOffset,
    };
  }

  private async requireClient(clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId },
      select: { id: true, displayName: true, entityType: true, status: true },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  private async requireDeadline(id: string) {
    const deadline = await this.unscopedPrisma.statutoryDeadline.findFirst({
      where: { id, isActive: true },
    });
    if (!deadline) throw new NotFoundException('Statutory deadline not found');
    return deadline;
  }

  private async deadlineMap(ids: string[]) {
    const rows = await this.unscopedPrisma.statutoryDeadline.findMany({
      where: { id: { in: ids }, isActive: true },
    });
    return new Map(rows.map((r) => [r.id, r]));
  }

  private async clientMap(ids: string[]) {
    // Scoped client already excludes soft-deleted rows; there is no ARCHIVED
    // client status in this schema, so no extra status filter is needed.
    const rows = await this.prisma.client.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, entityType: true },
    });
    return new Map(rows.map((r) => [r.id, r]));
  }

  private async overrideMap(deadlineIds: string[]) {
    const rows = await this.unscopedPrisma.statutoryDeadlineOverride.findMany({
      where: { statutoryDeadlineId: { in: deadlineIds } },
    });
    return new Map(
      rows.map((r) => [`${r.statutoryDeadlineId}|${r.periodLabel}`, r.extendedDate]),
    );
  }

  private async storedEntryMap(clientIds: string[], deadlineIds: string[]) {
    const rows = await this.prisma.complianceCalendarEntry.findMany({
      where: {
        clientId: { in: clientIds },
        statutoryDeadlineId: { in: deadlineIds },
      },
      select: {
        clientId: true,
        statutoryDeadlineId: true,
        periodLabel: true,
        status: true,
        linkedTaskId: true,
      },
    });
    return new Map(
      rows.map((r) => [
        `${r.clientId}|${r.statutoryDeadlineId}|${r.periodLabel}`,
        r,
      ]),
    );
  }

  private async firmBufferDays(): Promise<number> {
    try {
      const firm = await this.unscopedPrisma.firm.findUnique({
        where: { id: this.getFirmId() },
        select: { settings: true },
      });
      const settings = firm?.settings as Record<string, any> | undefined;
      const v = settings?.default_internal_deadline_buffer_days;
      return typeof v === 'number' ? v : DEFAULT_BUFFER_DAYS;
    } catch {
      return DEFAULT_BUFFER_DAYS;
    }
  }

  private deadlineDto(d: any) {
    return {
      id: d.id,
      code: d.code,
      name: d.name,
      description: d.description,
      category: d.category,
      recurrence: d.recurrence,
      recurrenceDay: d.recurrenceDay,
      applicableTo: d.applicableTo,
      penaltyPerDay: d.penaltyPerDay ? Number(d.penaltyPerDay) : null,
      penaltyNotes: d.penaltyNotes ?? null,
    };
  }

  private assignmentDto(a: any, deadline?: any) {
    return {
      id: a.id,
      clientId: a.clientId,
      statutoryDeadlineId: a.statutoryDeadlineId,
      isEnabled: a.isEnabled,
      autoGenerateTasks: a.autoGenerateTasks,
      internalBufferDays: a.internalBufferDays,
      customDueDateDay: a.customDueDateDay,
      deadline: deadline ? this.deadlineDto(deadline) : null,
    };
  }

  private entryDto(
    row: any,
    ctx: {
      client: any;
      deadline: any;
      dueDate: Date;
      internalDueDate: Date;
      periodLabel: string;
      status: ComplianceEntryStatus;
    },
  ) {
    return {
      id: row?.id ?? null,
      clientId: ctx.client.id,
      clientName: ctx.client.displayName,
      statutoryDeadlineId: ctx.deadline.id,
      deadlineCode: ctx.deadline.code,
      deadlineName: ctx.deadline.name,
      category: ctx.deadline.category,
      periodLabel: ctx.periodLabel,
      dueDate: ctx.dueDate.toISOString().slice(0, 10),
      internalDueDate: ctx.internalDueDate.toISOString().slice(0, 10),
      status: ctx.status,
      linkedTaskId: row?.linkedTaskId ?? null,
    };
  }
}
