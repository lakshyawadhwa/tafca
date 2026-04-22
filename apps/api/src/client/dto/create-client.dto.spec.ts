import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateClientDto } from './create-client.dto';
import { EntityType } from '@ca-practice-os/shared';

function makeDto(overrides: Partial<Record<string, unknown>>): CreateClientDto {
  return plainToInstance(CreateClientDto, {
    displayName: 'Test Client',
    entityType: EntityType.INDIVIDUAL,
    ...overrides,
  });
}

/**
 * Note on PAN validation strategy:
 * - AC-1 (invalid PAN format → 400): enforced by @Matches in DTO.
 * - AC-2 (PAN missing for non-INDIVIDUAL → 400): enforced in ClientService.createClient
 *   because class-validator cannot independently condition @IsNotEmpty and @Matches
 *   on different predicates for the same property. The service throws BadRequestException.
 */
describe('CreateClientDto validation', () => {
  describe('PAN field', () => {
    it('accepts valid PAN', async () => {
      const dto = makeDto({ pan: 'ABCDE1234F' });
      const errors = await validate(dto);
      const panErrors = errors.filter((e) => e.property === 'pan');
      expect(panErrors).toHaveLength(0);
    });

    it('rejects invalid PAN format (AC-1)', async () => {
      const dto = makeDto({ pan: 'INVALID' });
      const errors = await validate(dto);
      const panErrors = errors.filter((e) => e.property === 'pan');
      expect(panErrors.length).toBeGreaterThan(0);
    });

    it('rejects lowercase PAN (AC-1)', async () => {
      const dto = makeDto({ pan: 'abcde1234f' });
      const errors = await validate(dto);
      const panErrors = errors.filter((e) => e.property === 'pan');
      expect(panErrors.length).toBeGreaterThan(0);
    });

    it('allows missing PAN for INDIVIDUAL entity type', async () => {
      const dto = makeDto({ entityType: EntityType.INDIVIDUAL, pan: undefined });
      const errors = await validate(dto);
      const panErrors = errors.filter((e) => e.property === 'pan');
      expect(panErrors).toHaveLength(0);
    });

    it('accepts valid PAN for PRIVATE_LIMITED', async () => {
      const dto = makeDto({
        entityType: EntityType.PRIVATE_LIMITED,
        pan: 'ABCDE1234F',
      });
      const errors = await validate(dto);
      const panErrors = errors.filter((e) => e.property === 'pan');
      expect(panErrors).toHaveLength(0);
    });

    // AC-2: PAN required for non-INDIVIDUAL is enforced at service layer,
    // not DTO layer, due to cross-field conditional validation limitations.
    // The service check is tested in service tests.
  });

  describe('phone field', () => {
    it('accepts valid E.164 phone', async () => {
      const dto = makeDto({ primaryContactPhone: '+919876543210' });
      const errors = await validate(dto);
      const phoneErrors = errors.filter((e) => e.property === 'primaryContactPhone');
      expect(phoneErrors).toHaveLength(0);
    });

    it('rejects non-E.164 phone (no +)', async () => {
      const dto = makeDto({ primaryContactPhone: '9876543210' });
      const errors = await validate(dto);
      const phoneErrors = errors.filter((e) => e.property === 'primaryContactPhone');
      expect(phoneErrors.length).toBeGreaterThan(0);
    });

    it('rejects phone with letters', async () => {
      const dto = makeDto({ primaryContactPhone: '+91abc' });
      const errors = await validate(dto);
      const phoneErrors = errors.filter((e) => e.property === 'primaryContactPhone');
      expect(phoneErrors.length).toBeGreaterThan(0);
    });

    it('allows missing phone (optional)', async () => {
      const dto = makeDto({ primaryContactPhone: undefined });
      const errors = await validate(dto);
      const phoneErrors = errors.filter((e) => e.property === 'primaryContactPhone');
      expect(phoneErrors).toHaveLength(0);
    });
  });
});
