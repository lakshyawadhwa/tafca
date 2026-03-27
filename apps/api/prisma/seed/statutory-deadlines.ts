import { PrismaClient } from '@prisma/client';

interface StatutoryDeadlineSeed {
  code: string;
  name: string;
  description: string;
  category: 'GST' | 'INCOME_TAX' | 'TDS' | 'ROC_COMPLIANCE' | 'AUDIT' | 'PAYROLL' | 'ADVISORY' | 'ACCOUNTING' | 'OTHER';
  applicableTo: string[];
  recurrence: 'ONE_OFF' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUALLY';
  recurrenceDay?: number;
  recurrenceMonth?: number;
  quarterMonthOffset?: number;
  linkedEngagementTypeCode?: string;
}

const STATUTORY_DEADLINES: StatutoryDeadlineSeed[] = [
  // GST Deadlines
  {
    code: 'GSTR1_MONTHLY',
    name: 'GSTR-1 (Monthly)',
    description: 'Monthly outward supply statement',
    category: 'GST',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'INDIVIDUAL', 'HUF', 'TRUST', 'SOCIETY', 'AOP', 'BOI', 'OTHER'],
    recurrence: 'MONTHLY',
    recurrenceDay: 11,
    linkedEngagementTypeCode: 'gst_monthly',
  },
  {
    code: 'GSTR3B_MONTHLY',
    name: 'GSTR-3B (Monthly)',
    description: 'Monthly summary return with tax payment',
    category: 'GST',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'INDIVIDUAL', 'HUF', 'TRUST', 'SOCIETY', 'AOP', 'BOI', 'OTHER'],
    recurrence: 'MONTHLY',
    recurrenceDay: 20,
    linkedEngagementTypeCode: 'gst_monthly',
  },
  {
    code: 'GSTR9_ANNUAL',
    name: 'GSTR-9 (Annual Return)',
    description: 'Annual GST return',
    category: 'GST',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'INDIVIDUAL', 'HUF', 'TRUST', 'SOCIETY', 'AOP', 'BOI', 'OTHER'],
    recurrence: 'ANNUALLY',
    recurrenceDay: 31,
    recurrenceMonth: 12,
    linkedEngagementTypeCode: 'gst_annual',
  },
  {
    code: 'GSTR9C_RECONCILIATION',
    name: 'GSTR-9C (Reconciliation Statement)',
    description: 'Annual GST audit/reconciliation statement for turnover > 5 crore',
    category: 'GST',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM'],
    recurrence: 'ANNUALLY',
    recurrenceDay: 31,
    recurrenceMonth: 12,
    linkedEngagementTypeCode: 'gst_annual',
  },

  // Income Tax Deadlines
  {
    code: 'ITR_INDIVIDUAL',
    name: 'ITR Filing - Individual/HUF (Non-Audit)',
    description: 'Income Tax Return due date for individuals and HUFs not subject to audit',
    category: 'INCOME_TAX',
    applicableTo: ['INDIVIDUAL', 'HUF'],
    recurrence: 'ANNUALLY',
    recurrenceDay: 31,
    recurrenceMonth: 7,
    linkedEngagementTypeCode: 'itr_individual',
  },
  {
    code: 'ITR_AUDIT_CASE',
    name: 'ITR Filing - Audit Cases',
    description: 'Income Tax Return due date for entities subject to audit (Sec 44AB)',
    category: 'INCOME_TAX',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM'],
    recurrence: 'ANNUALLY',
    recurrenceDay: 31,
    recurrenceMonth: 10,
    linkedEngagementTypeCode: 'itr_company',
  },
  {
    code: 'ITR_COMPANY',
    name: 'ITR Filing - Company',
    description: 'Income Tax Return due date for companies',
    category: 'INCOME_TAX',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED'],
    recurrence: 'ANNUALLY',
    recurrenceDay: 31,
    recurrenceMonth: 10,
    linkedEngagementTypeCode: 'itr_company',
  },
  {
    code: 'ITR_TRANSFER_PRICING',
    name: 'ITR Filing - Transfer Pricing',
    description: 'Income Tax Return due date for entities requiring transfer pricing report',
    category: 'INCOME_TAX',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP'],
    recurrence: 'ANNUALLY',
    recurrenceDay: 30,
    recurrenceMonth: 11,
    linkedEngagementTypeCode: 'itr_company',
  },

  // Advance Tax Deadlines
  {
    code: 'ADVANCE_TAX_Q1',
    name: 'Advance Tax - Q1 (15th June)',
    description: 'First installment of advance tax (15% of estimated tax)',
    category: 'INCOME_TAX',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'INDIVIDUAL', 'HUF'],
    recurrence: 'QUARTERLY',
    recurrenceDay: 15,
    quarterMonthOffset: 3,
    linkedEngagementTypeCode: 'advance_tax',
  },
  {
    code: 'ADVANCE_TAX_Q2',
    name: 'Advance Tax - Q2 (15th September)',
    description: 'Second installment of advance tax (cumulative 45% of estimated tax)',
    category: 'INCOME_TAX',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'INDIVIDUAL', 'HUF'],
    recurrence: 'QUARTERLY',
    recurrenceDay: 15,
    quarterMonthOffset: 6,
    linkedEngagementTypeCode: 'advance_tax',
  },
  {
    code: 'ADVANCE_TAX_Q3',
    name: 'Advance Tax - Q3 (15th December)',
    description: 'Third installment of advance tax (cumulative 75% of estimated tax)',
    category: 'INCOME_TAX',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'INDIVIDUAL', 'HUF'],
    recurrence: 'QUARTERLY',
    recurrenceDay: 15,
    quarterMonthOffset: 9,
    linkedEngagementTypeCode: 'advance_tax',
  },
  {
    code: 'ADVANCE_TAX_Q4',
    name: 'Advance Tax - Q4 (15th March)',
    description: 'Final installment of advance tax (100% of estimated tax)',
    category: 'INCOME_TAX',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'INDIVIDUAL', 'HUF'],
    recurrence: 'QUARTERLY',
    recurrenceDay: 15,
    quarterMonthOffset: 12,
    linkedEngagementTypeCode: 'advance_tax',
  },

  // TDS Deadlines
  {
    code: 'TDS_RETURN_Q1',
    name: 'TDS Return - Q1 (Apr-Jun)',
    description: 'TDS quarterly return for Q1 (Forms 24Q, 26Q, 27Q)',
    category: 'TDS',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'INDIVIDUAL', 'HUF', 'TRUST', 'SOCIETY', 'AOP', 'BOI', 'OTHER'],
    recurrence: 'QUARTERLY',
    recurrenceDay: 31,
    quarterMonthOffset: 4,
    linkedEngagementTypeCode: 'tds_quarterly',
  },
  {
    code: 'TDS_RETURN_Q2',
    name: 'TDS Return - Q2 (Jul-Sep)',
    description: 'TDS quarterly return for Q2',
    category: 'TDS',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'INDIVIDUAL', 'HUF', 'TRUST', 'SOCIETY', 'AOP', 'BOI', 'OTHER'],
    recurrence: 'QUARTERLY',
    recurrenceDay: 31,
    quarterMonthOffset: 7,
    linkedEngagementTypeCode: 'tds_quarterly',
  },
  {
    code: 'TDS_RETURN_Q3',
    name: 'TDS Return - Q3 (Oct-Dec)',
    description: 'TDS quarterly return for Q3',
    category: 'TDS',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'INDIVIDUAL', 'HUF', 'TRUST', 'SOCIETY', 'AOP', 'BOI', 'OTHER'],
    recurrence: 'QUARTERLY',
    recurrenceDay: 31,
    quarterMonthOffset: 10,
    linkedEngagementTypeCode: 'tds_quarterly',
  },
  {
    code: 'TDS_RETURN_Q4',
    name: 'TDS Return - Q4 (Jan-Mar)',
    description: 'TDS quarterly return for Q4',
    category: 'TDS',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'INDIVIDUAL', 'HUF', 'TRUST', 'SOCIETY', 'AOP', 'BOI', 'OTHER'],
    recurrence: 'QUARTERLY',
    recurrenceDay: 31,
    quarterMonthOffset: 2,
    linkedEngagementTypeCode: 'tds_quarterly',
  },
  {
    code: 'TDS_PAYMENT_MONTHLY',
    name: 'TDS Payment (Monthly)',
    description: 'Monthly TDS challan payment (7th of following month, March due 30th April)',
    category: 'TDS',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'INDIVIDUAL', 'HUF', 'TRUST', 'SOCIETY', 'AOP', 'BOI', 'OTHER'],
    recurrence: 'MONTHLY',
    recurrenceDay: 7,
    linkedEngagementTypeCode: 'tds_quarterly',
  },

  // ROC Deadlines
  {
    code: 'ROC_AOC4',
    name: 'ROC - AOC-4 (Financial Statements)',
    description: 'Filing of financial statements with ROC within 30 days of AGM',
    category: 'ROC_COMPLIANCE',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED'],
    recurrence: 'ANNUALLY',
    recurrenceDay: 29,
    recurrenceMonth: 10,
    linkedEngagementTypeCode: 'roc_annual',
  },
  {
    code: 'ROC_MGT7',
    name: 'ROC - MGT-7 (Annual Return)',
    description: 'Filing of annual return with ROC within 60 days of AGM',
    category: 'ROC_COMPLIANCE',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED'],
    recurrence: 'ANNUALLY',
    recurrenceDay: 28,
    recurrenceMonth: 11,
    linkedEngagementTypeCode: 'roc_annual',
  },
  {
    code: 'ROC_ADT1',
    name: 'ROC - ADT-1 (Auditor Appointment)',
    description: 'Filing of auditor appointment form within 15 days of AGM',
    category: 'ROC_COMPLIANCE',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED'],
    recurrence: 'ANNUALLY',
    recurrenceDay: 14,
    recurrenceMonth: 10,
    linkedEngagementTypeCode: 'roc_annual',
  },

  // Audit Deadlines
  {
    code: 'TAX_AUDIT_REPORT',
    name: 'Tax Audit Report (Form 3CD)',
    description: 'Tax audit report due date under Section 44AB',
    category: 'AUDIT',
    applicableTo: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'INDIVIDUAL', 'HUF'],
    recurrence: 'ANNUALLY',
    recurrenceDay: 30,
    recurrenceMonth: 9,
    linkedEngagementTypeCode: 'tax_audit',
  },
];

export async function seedStatutoryDeadlines(
  prisma: PrismaClient,
): Promise<void> {
  console.log('  Seeding statutory deadlines...');

  for (const sd of STATUTORY_DEADLINES) {
    await prisma.statutoryDeadline.upsert({
      where: { code: sd.code },
      update: {
        name: sd.name,
        description: sd.description,
        category: sd.category,
        applicableTo: sd.applicableTo as any[],
        recurrence: sd.recurrence,
        recurrenceDay: sd.recurrenceDay ?? null,
        recurrenceMonth: sd.recurrenceMonth ?? null,
        quarterMonthOffset: sd.quarterMonthOffset ?? null,
        linkedEngagementTypeCode: sd.linkedEngagementTypeCode ?? null,
        isActive: true,
      },
      create: {
        code: sd.code,
        name: sd.name,
        description: sd.description,
        category: sd.category,
        applicableTo: sd.applicableTo as any[],
        recurrence: sd.recurrence,
        recurrenceDay: sd.recurrenceDay ?? null,
        recurrenceMonth: sd.recurrenceMonth ?? null,
        quarterMonthOffset: sd.quarterMonthOffset ?? null,
        linkedEngagementTypeCode: sd.linkedEngagementTypeCode ?? null,
        isActive: true,
      },
    });
  }

  console.log(`  Seeded ${STATUTORY_DEADLINES.length} statutory deadlines.`);
}
