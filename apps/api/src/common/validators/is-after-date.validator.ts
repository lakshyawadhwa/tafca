import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Validates that a date field is not earlier than another date field on the
 * same object. Only applies when both are present, so optional pairs stay
 * optional.
 */
export function IsNotBeforeField(
  otherField: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotBeforeField',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const other = (args.object as Record<string, unknown>)[otherField];
          if (!value || !other) return true;
          if (typeof value !== 'string' || typeof other !== 'string') return true;
          return new Date(value).getTime() >= new Date(other).getTime();
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must not be earlier than ${otherField}`;
        },
      },
    });
  };
}
