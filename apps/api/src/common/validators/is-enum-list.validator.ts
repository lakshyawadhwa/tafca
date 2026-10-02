import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Validates a comma-separated list where every entry must be a member of the
 * given enum, e.g. `?status=TO_DO,IN_PROGRESS`.
 *
 * Without this these filters were typed `@IsString()` and split straight into
 * a Prisma `in:` clause, so an unknown value reached the database layer and
 * surfaced as a 500 PrismaClientValidationError instead of a 400.
 */
export function IsEnumList(
  enumObject: Record<string, string>,
  validationOptions?: ValidationOptions,
) {
  const allowed = Object.values(enumObject);

  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEnumList',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const entries = value.split(',').map((v) => v.trim());
          // An empty entry means a stray or trailing comma.
          if (entries.some((e) => e.length === 0)) return false;
          return entries.every((e) => allowed.includes(e));
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a comma-separated list of: ${allowed.join(', ')}`;
        },
      },
    });
  };
}
