/**
 * One-off activation switch for the KPI / Outcome indicators.
 *
 * Default run: keep ONLY the "Paediatric Ward" (OUTCOME) indicator types active
 * for admin data entry; deactivate every other type (all KPI + the other 13
 * OUTCOME departments). Reversible — nothing is deleted, only `isActive` flags.
 *
 *   Deactivate all-but-paed :  pnpm --filter @nabh/database exec tsx activate-paed-only.ts
 *   Revert (reactivate all) :  pnpm --filter @nabh/database exec tsx activate-paed-only.ts --revert
 *
 * The admin data-entry screen shows a template only when BOTH its type and the
 * template are active, so toggling the TYPE flag is enough to show/hide a group.
 */
import { config } from 'dotenv';
import path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './src/generated/client/client';

config({ path: path.join(__dirname, '../../.env') });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['warn', 'error'] });

const REVERT = process.argv.includes('--revert');
const PAED = { framework: 'OUTCOME', departmentCode: 'paed_ward' } as const;

async function summarise(label: string) {
  const types = await prisma.indicatorType.findMany({
    select: { framework: true, departmentCode: true, departmentName: true, name: true, isActive: true },
  });
  const active = types.filter((t) => t.isActive);
  const tplActive = await prisma.indicatorTemplate.count({ where: { isActive: true } });
  const tplTotal = await prisma.indicatorTemplate.count();
  console.log(`\n${label}: ${active.length}/${types.length} types ACTIVE · ${tplActive}/${tplTotal} indicators ACTIVE`);
  const byGroup = new Map<string, number>();
  for (const t of active) {
    const key = t.framework === 'KPI' ? 'KPI (hospital-wide)' : `OUTCOME · ${t.departmentName ?? t.departmentCode}`;
    byGroup.set(key, (byGroup.get(key) ?? 0) + 1);
  }
  for (const [k, n] of [...byGroup].sort()) console.log(`   ${k}: ${n} active type(s)`);
  if (!active.length) console.log('   (none)');
}

async function main() {
  await summarise('BEFORE');

  if (REVERT) {
    const t = await prisma.indicatorType.updateMany({ data: { isActive: true } });
    const tpl = await prisma.indicatorTemplate.updateMany({ data: { isActive: true } });
    console.log(`\n↩  REVERT: reactivated ${t.count} types + ${tpl.count} templates.`);
  } else {
    // 1) deactivate every TYPE and every TEMPLATE that is NOT the Paediatric
    //    Ward (OUTCOME) group — templates too, so Setup shows them as Inactive.
    const off = await prisma.indicatorType.updateMany({
      where: { NOT: { framework: PAED.framework, departmentCode: PAED.departmentCode } },
      data: { isActive: false },
    });
    const offTpls = await prisma.indicatorTemplate.updateMany({
      where: { type: { NOT: { framework: PAED.framework, departmentCode: PAED.departmentCode } } },
      data: { isActive: false },
    });
    // 2) make sure the Paediatric Ward group is ON (types + their templates)
    const onTypes = await prisma.indicatorType.updateMany({
      where: { framework: PAED.framework, departmentCode: PAED.departmentCode },
      data: { isActive: true },
    });
    const onTpls = await prisma.indicatorTemplate.updateMany({
      where: { type: { framework: PAED.framework, departmentCode: PAED.departmentCode } },
      data: { isActive: true },
    });
    console.log(`\n✔  Deactivated ${off.count} non-paediatric types + ${offTpls.count} indicators.`);
    console.log(`✔  Kept ${onTypes.count} Paediatric Ward types + ${onTpls.count} indicators active.`);
  }

  await summarise('AFTER');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
