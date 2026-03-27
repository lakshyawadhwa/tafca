import { ValidationPipe, BadRequestException } from '@nestjs/common';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors) => {
      const messages = errors.flatMap((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints)
          : [];
        return constraints.map((c) => `${error.property}: ${c}`);
      });
      return new BadRequestException({
        statusCode: 400,
        message: messages,
        error: 'Validation Failed',
      });
    },
  });
}
