import { PrismaClient } from '@prisma/client';

export async function seedTaskTemplates(
  prisma: PrismaClient,
  systemUserId: string,
): Promise<void> {
  console.log('  Seeding task templates...');

  // Find the GST Monthly engagement type
  const gstMonthly = await prisma.engagementType.findFirst({
    where: { code: 'gst_monthly', firmId: null },
  });

  if (!gstMonthly) {
    console.log('  WARNING: gst_monthly engagement type not found, skipping task templates');
    return;
  }

  // Check if template already exists
  const existing = await prisma.taskTemplate.findFirst({
    where: {
      engagementTypeId: gstMonthly.id,
      firmId: null,
      name: 'GST Monthly Compliance',
    },
  });

  if (existing) {
    console.log('  GST Monthly Compliance template already exists, skipping.');
    return;
  }

  // Create GST Monthly Compliance 7-step template (per PRD section 6.7)
  const template = await prisma.taskTemplate.create({
    data: {
      firmId: null,
      engagementTypeId: gstMonthly.id,
      name: 'GST Monthly Compliance',
      isActive: true,
      createdBy: systemUserId,
      updatedBy: systemUserId,
      items: {
        create: [
          {
            title: 'Collect purchase invoices and input data',
            description: 'Gather all purchase invoices, expense bills, and input credit documents from the client for the month.',
            assigneeRole: 'ARTICLE',
            reviewerRole: 'JUNIOR_CA',
            dueOffsetDays: 3,
            displayOrder: 1,
            dependsOnOrder: [],
            checklistItems: JSON.stringify([
              'Purchase register received',
              'Expense bills collected',
              'Import invoices (if any) collected',
              'Credit/debit notes received',
            ]),
            isRequired: true,
          },
          {
            title: 'Collect sales invoices and output data',
            description: 'Gather all sales invoices and output supply documents from the client for the month.',
            assigneeRole: 'ARTICLE',
            reviewerRole: 'JUNIOR_CA',
            dueOffsetDays: 3,
            displayOrder: 2,
            dependsOnOrder: [],
            checklistItems: JSON.stringify([
              'Sales register received',
              'E-invoices reconciled',
              'Credit/debit notes issued',
              'Export invoices (if any) collected',
            ]),
            isRequired: true,
          },
          {
            title: 'Reconcile ITC with GSTR-2B',
            description: 'Match the purchase register with GSTR-2B auto-populated data. Flag mismatches.',
            assigneeRole: 'JUNIOR_CA',
            reviewerRole: 'MANAGER',
            dueOffsetDays: 5,
            displayOrder: 3,
            dependsOnOrder: [1],
            checklistItems: JSON.stringify([
              'GSTR-2B downloaded',
              'Purchase register matched',
              'Mismatches documented',
              'ITC to claim finalized',
            ]),
            isRequired: true,
          },
          {
            title: 'Prepare and file GSTR-1',
            description: 'Prepare GSTR-1 from sales data, validate, and file on GST portal.',
            assigneeRole: 'JUNIOR_CA',
            reviewerRole: 'MANAGER',
            dueOffsetDays: 8,
            displayOrder: 4,
            dependsOnOrder: [2],
            checklistItems: JSON.stringify([
              'B2B invoices entered',
              'B2C summary prepared',
              'Credit/debit notes entered',
              'HSN summary verified',
              'Filed on portal',
              'ARN captured',
            ]),
            isRequired: true,
          },
          {
            title: 'Prepare GSTR-3B',
            description: 'Prepare GSTR-3B summary return with tax computation.',
            assigneeRole: 'JUNIOR_CA',
            reviewerRole: 'MANAGER',
            dueOffsetDays: 15,
            displayOrder: 5,
            dependsOnOrder: [3, 4],
            checklistItems: JSON.stringify([
              'Output tax computed',
              'Input tax credit finalized',
              'Tax liability computed',
              'Challan generated',
            ]),
            isRequired: true,
          },
          {
            title: 'Partner review and approval',
            description: 'Partner reviews the GSTR-3B return and tax computation for accuracy before filing.',
            assigneeRole: 'MANAGER',
            reviewerRole: 'PARTNER',
            dueOffsetDays: 17,
            displayOrder: 6,
            dependsOnOrder: [5],
            checklistItems: JSON.stringify([
              'Tax computation reviewed',
              'ITC claims verified',
              'Return data cross-checked',
              'Approved for filing',
            ]),
            isRequired: true,
          },
          {
            title: 'File GSTR-3B and make payment',
            description: 'File GSTR-3B on GST portal and make tax payment via challan.',
            assigneeRole: 'JUNIOR_CA',
            reviewerRole: 'MANAGER',
            dueOffsetDays: 18,
            displayOrder: 7,
            dependsOnOrder: [6],
            checklistItems: JSON.stringify([
              'GSTR-3B filed on portal',
              'Payment challan generated',
              'Payment made',
              'ARN captured',
              'Filing confirmation saved',
            ]),
            isRequired: true,
          },
        ],
      },
    },
  });

  console.log(`  Created GST Monthly Compliance template with ${7} items (id: ${template.id}).`);
}
