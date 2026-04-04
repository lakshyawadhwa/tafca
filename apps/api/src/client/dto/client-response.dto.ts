import {
  EntityType,
  ConstitutionType,
  ClientStatus,
  GstRegistrationType,
} from '@ca-practice-os/shared';

export class GstNumberResponseDto {
  id!: string;
  gstin!: string;
  stateCode!: string;
  tradeName!: string | null;
  registrationType!: GstRegistrationType;
  isPrimary!: boolean;
  registeredAt!: string | null;
  cancelledAt!: string | null;
  createdAt!: string;
}

export class ClientResponseDto {
  id!: string;
  displayName!: string;
  legalName!: string | null;
  entityType!: EntityType;
  constitution!: ConstitutionType | null;
  status!: ClientStatus;
  pan!: string | null;
  tan!: string | null;
  cin!: string | null;
  primaryContactName!: string | null;
  primaryContactPhone!: string | null;
  primaryContactEmail!: string | null;
  address!: Record<string, unknown> | null;
  notes!: string | null;
  tags!: string[];
  financialYearEnd!: number;
  assignedPartnerId!: string | null;
  assignedManagerId!: string | null;
  assignedJuniorId!: string | null;
  assignedArticleId!: string | null;
  onboardedAt!: string | null;
  createdAt!: string;
  updatedAt!: string;
  gstNumbers!: GstNumberResponseDto[];
  _count!: { engagements: number; tasks: number };
}

export class PaginatedClientsResponseDto {
  data!: ClientResponseDto[];
  meta!: { total: number; page: number; limit: number; totalPages: number };
}
