/**
 * Read-only audit of what an ADMIN sees on the data-entry screen.
 *
 * The admin screen calls  GET /indicators/templates?active=true …  which returns
 * a template ONLY when BOTH the template.isActive AND its parent type.isActive.
 * This script reproduces that exact rule and reports:
 *   1. What the admin will actually see (the effective active set), grouped.
 *   2. Every anomaly / leak:
 *        · template active but its TYPE is off  → hidden from admin, but "active" in raw data
 *        · type active but all its templates off → empty group
 *        · anything active outside the Paediatric Ward group
 *
 *   pnpm --filter @nabh/database exec tsx audit-active-kpis.ts
 */
import { config } from 'dotenv';
import path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './src/generated/client/client';

config({ path: path.join(__dirname, '../../.env') });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['warn', 'error'] });

const EXPECTED = { framework: 'OUTCOME', departmentCode: 'paed_ward' } as const;
const groupOf = (t: { framework: string; departmentName: string | null; departmentCode: string }) =>
  t.framework === 'KPI' ? 'KPI · hospital-wide' : `OUTCOME · ${t.departmentName ?? t.departmentCode}`;

async function main() {
  const types = await prisma.indicatorType.findMany({
    select: { id: true, framework: true, departmentCode: true, departmentName: true, name: true, isActive: true },
  });
  const tpls = await prisma.indicatorTemplate.findMany({
    select: { id: true, name: true, isActive: true, typeId: true },
  });
  const typeById = new Map(types.map((t) => [t.id, t]));

  const typeActive = types.filter((t) => t.isActive).length;
  const tplActive = tpls.filter((t) => t.isActive).length;

  console.log('════════════════════════════════════════════════════════════════');
  console.log(' KPI / OUTCOME ACTIVATION AUDIT');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Types      : ${typeActive}/${types.length} active`);
  console.log(`Indicators : ${tplActive}/${tpls.length} active (raw isActive flag)`);

  // ── 1. EFFECTIVE set — exactly what the admin data-entry screen returns ──
  const visible = tpls.filter((t) => {
    const ty = typeById.get(t.typeId);
    return t.isActive && ty?.isActive;
  });
  const byGroup = new Map<string, number>();
  for (const t of visible) {
    const ty = typeById.get(t.typeId)!;
    const k = groupOf(ty);
    byGroup.set(k, (byGroup.get(k) ?? 0) + 1);
  }
  console.log('\n── ADMIN DATA-ENTRY sees (type ✔ AND template ✔) ───────────────');
  if (!byGroup.size) console.log('   (nothing — admin sees no indicators)');
  for (const [k, n] of [...byGroup].sort()) console.log(`   ✔ ${k}: ${n} indicator(s)`);
  console.log(`   TOTAL VISIBLE TO ADMIN: ${visible.length} indicator(s)`);

  // ── 2. ANOMALIES / LEAKS ──
  const leaksOutsidePaed = visible.filter((t) => {
    const ty = typeById.get(t.typeId)!;
    return !(ty.framework === EXPECTED.framework && ty.departmentCode === EXPECTED.departmentCode);
  });
  const orphanTpls = tpls.filter((t) => {
    const ty = typeById.get(t.typeId);
    return t.isActive && !ty?.isActive; // template on, type off → hidden but "active" in raw
  });
  const emptyActiveTypes = types.filter(
    (ty) => ty.isActive && !tpls.some((t) => t.typeId === ty.id && t.isActive),
  );

  console.log('\n── ANOMALIES ───────────────────────────────────────────────────');
  console.log(
    leaksOutsidePaed.length
      ? `   ✗ ${leaksOutsidePaed.length} indicator(s) VISIBLE to admin OUTSIDE Paediatric Ward:`
      : '   ✔ No non-Paediatric indicators visible to admin.',
  );
  for (const t of leaksOutsidePaed) {
    const ty = typeById.get(t.typeId)!;
    console.log(`       · [${groupOf(ty)}] ${t.name}`);
  }
  console.log(
    orphanTpls.length
      ? `   ⚠ ${orphanTpls.length} template(s) still flagged active but their TYPE is off (hidden from admin, but show as "Active" in Super-Admin Setup):`
      : '   ✔ No orphan active templates (every active template has an active type).',
  );
  const orphanByGroup = new Map<string, number>();
  for (const t of orphanTpls) {
    const ty = typeById.get(t.typeId)!;
    orphanByGroup.set(groupOf(ty), (orphanByGroup.get(groupOf(ty)) ?? 0) + 1);
  }
  for (const [k, n] of [...orphanByGroup].sort()) console.log(`       · ${k}: ${n}`);
  console.log(
    emptyActiveTypes.length
      ? `   ⚠ ${emptyActiveTypes.length} active type(s) with zero active indicators.`
      : '   ✔ Every active type has at least one active indicator.',
  );

  // ── 3. VERDICT ──
  const clean = leaksOutsidePaed.length === 0 && orphanTpls.length === 0;
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(
    clean
      ? ' VERDICT: ✅ DEMO-READY — admin sees ONLY Paediatric Ward, nothing leaks.'
      : ' VERDICT: ⚠ NEEDS FIX — see anomalies above.',
  );
  console.log('════════════════════════════════════════════════════════════════');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
