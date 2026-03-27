import { PrismaClient } from '@prisma/client';

interface EngagementTypeSeed {
  code: string;
  name: string;
  category: 'GST' | 'INCOME_TAX' | 'TDS' | 'ROC_COMPLIANCE' | 'AUDIT' | 'PAYROLL' | 'ADVISORY' | 'ACCOUNTING' | 'OTHER';
  recurrence: 'ONE_OFF' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUALLY';
  requiresPartnerApproval: boolean;
  description: string;
}

const ENGAGEMENT_TYPES: EngagementTypeSeed[] = [
  {
    code: 'gst_monthly',
    name: 'GST Monthly Return',
    category: 'GST',
    recurrence: 'MONTHLY',
    requiresPartnerApproval: false,
    description: 'Monthly GST filing including GSTR-1 and GSTR-3B',
  },
  {
    code: 'gst_annual',
    name: 'GST Annual Return',
    category: 'GST',
    recurrence: 'ANNUALLY',
    requiresPartnerApproval: true,
    description: 'Annual GST return filing (GSTR-9/9C)',
  },
  {
    code: 'tds_quarterly',
    name: 'TDS Quarterly Return',
    category: 'TDS',
    recurrence: 'QUARTERLY',
    requiresPartnerApproval: false,
    description: 'Quarterly TDS return filing (24Q, 26Q, 27Q)',
  },
  {
    code: 'itr_individual',
    name: 'ITR - Individual / HUF',
    category: 'INCOME_TAX',
    recurrence: 'ANNUALLY',
    requiresPartnerApproval: true,
    description: 'Income Tax Return filing for individuals and HUFs',
  },
  {
    code: 'itr_company',
    name: 'ITR - Company / Firm',
    category: 'INCOME_TAX',
    recurrence: 'ANNUALLY',
    requiresPartnerApproval: true,
    description: 'Income Tax Return filing for companies, firms, and LLPs',
  },
  {
    code: 'statutory_audit',
    name: 'Statutory Audit',
    category: 'AUDIT',
    recurrence: 'ANNUALLY',
    requiresPartnerApproval: true,
    description: 'Annual statutory audit under the Companies Act',
  },
  {
    code: 'tax_audit',
    name: 'Tax Audit',
    category: 'AUDIT',
    recurrence: 'ANNUALLY',
    requiresPartnerApproval: true,
    description: 'Tax audit under Section 44AB of the Income Tax Act',
  },
  {
    code: 'roc_annual',
    name: 'ROC Annual Filing',
    category: 'ROC_COMPLIANCE',
    recurrence: 'ANNUALLY',
    requiresPartnerApproval: false,
    description: 'Annual ROC filings including AOC-4, MGT-7, and ADT-1',
  },
  {
    code: 'advance_tax',
    name: 'Advance Tax',
    category: 'INCOME_TAX',
    recurrence: 'QUARTERLY',
    requiresPartnerApproval: false,
    description: 'Quarterly advance tax computation and payment',
  },
  {
    code: 'mis_monthly',
    name: 'Monthly MIS',
    category: 'ACCOUNTING',
    recurrence: 'MONTHLY',
    requiresPartnerApproval: false,
    description: 'Monthly Management Information System reporting',
  },
  {
    code: 'payroll_monthly',
    name: 'Monthly Payroll',
    category: 'PAYROLL',
    recurrence: 'MONTHLY',
    requiresPartnerApproval: false,
    description: 'Monthly payroll processing including PF, ESI, and TDS on salary',
  },
];

export async function seedEngagementTypes(
  prisma: PrismaClient,
  systemUserId: string,
): Promise<void> {
  console.log('  Seeding engagement types...');

  for (const et of ENGAGEMENT_TYPES) {
    // Check if already exists by code (global types have firmId = null)
    const existing = await prisma.engagementType.findFirst({
      where: { code: et.code, firmId: null },
    });

    if (existing) {
      await prisma.engagementType.update({
        where: { id: existing.id },
        data: {
          name: et.name,
          category: et.category,
          recurrence: et.recurrence,
          requiresPartnerApproval: et.requiresPartnerApproval,
          description: et.description,
          updatedBy: systemUserId,
        },
      });
    } else {
      await prisma.engagementType.create({
        data: {
          firmId: null,
          code: et.code,
          name: et.name,
          category: et.category,
          recurrence: et.recurrence,
          requiresPartnerApproval: et.requiresPartnerApproval,
          description: et.description,
          isActive: true,
          createdBy: systemUserId,
          updatedBy: systemUserId,
        },
      });
    }
  }

  console.log(`  Seeded ${ENGAGEMENT_TYPES.length} engagement types.`);
}
