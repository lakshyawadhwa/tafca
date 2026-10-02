import {
  clientScopeWhere,
  engagementScopeWhere,
  taskScopeWhere,
  withScope,
} from './permission-scope.helper';

/**
 * The scope fragments are what stop a JUNIOR_CA listing every client and task
 * in the firm. Firm isolation is separate and handled by the Prisma extension.
 */
describe('permission scope where-clauses', () => {
  const me = 'user-1';

  it('does not narrow anything for the "all" scope', () => {
    expect(clientScopeWhere('all', me)).toBeNull();
    expect(taskScopeWhere('all', me)).toBeNull();
    expect(engagementScopeWhere('all', me)).toBeNull();
  });

  it('limits clients to the four assignment slots', () => {
    expect(clientScopeWhere('assigned', me)).toEqual({
      OR: [
        { assignedPartnerId: me },
        { assignedManagerId: me },
        { assignedJuniorId: me },
        { assignedArticleId: me },
      ],
    });
  });

  it('limits tasks to assignee, reviewer or creator', () => {
    expect(taskScopeWhere('assigned', me)).toEqual({
      OR: [{ assigneeId: me }, { reviewerId: me }, { createdBy: me }],
    });
  });

  it('limits "own" to records the user created', () => {
    expect(clientScopeWhere('own', me)).toEqual({ createdBy: me });
    expect(taskScopeWhere('own', me)).toEqual({ createdBy: me });
  });

  it('reaches the client when scoping engagements', () => {
    const where = engagementScopeWhere('assigned', me) as Record<string, any>;
    expect(where.OR).toContainEqual({ assignedPartnerId: me });
    expect(JSON.stringify(where)).toContain('client');
  });

  describe('withScope', () => {
    it('returns the original clause when the scope is unrestricted', () => {
      expect(withScope({ status: 'ACTIVE' }, null)).toEqual({ status: 'ACTIVE' });
    });

    it('ANDs the scope on so a caller OR cannot widen it', () => {
      const result = withScope(
        { OR: [{ displayName: { contains: 'x' } }] },
        { assignedJuniorId: me },
      );

      // The search OR must stay intact and the scope must sit beside it in AND.
      expect(result.OR).toEqual([{ displayName: { contains: 'x' } }]);
      expect(result.AND).toEqual([{ assignedJuniorId: me }]);
    });

    it('preserves an existing AND', () => {
      const result = withScope({ AND: [{ a: 1 }] }, { b: 2 });
      expect(result.AND).toEqual([{ a: 1 }, { b: 2 }]);
    });
  });
});
