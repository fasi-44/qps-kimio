/**
 * NQAS Database Seed Script
 *
 * Seeds:
 *   - HospitalSettings (KMIO)
 *   - 14 NQAS Departments (from Excel)
 *   - Areas of Concern (A–H), Standards, Measurable Elements
 *   - 14 ClientDepartments (hospital-specific, mapped to NQAS)
 *   - Demo Users: Admin, HODs, Assessors
 *
 * Run: pnpm --filter @nabh/database db:seed
 */

import { config } from 'dotenv';
import path from 'path';
import { readFileSync, existsSync } from 'fs';
import * as XLSX from 'xlsx';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/client/client';

config({ path: path.join(__dirname, '../../../../.env') });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['warn', 'error'] });

// ─── NQAS Department config ───────────────────────────────────────────────────

interface DepartmentConfig {
  code: string;
  name: string;
  sheetName: string;
  order: number;
}

const NQAS_DEPARTMENTS: DepartmentConfig[] = [
  { code: 'emergency',          name: 'Accident & Emergency',         sheetName: 'Emergency ',          order: 1  },
  { code: 'opd',                name: 'Outpatient Department',        sheetName: 'OPD',                 order: 2  },
  { code: 'paed_ward',          name: 'Paediatrics Ward (MusQan)',    sheetName: 'Paed_Ward',            order: 3  },
  { code: 'ot',                 name: 'Operation Theatre',            sheetName: 'OT',                  order: 4  },
  { code: 'icu',                name: 'Intensive Care Unit',          sheetName: 'ICU',                 order: 5  },
  { code: 'ipd',                name: 'In-Patient Department',        sheetName: 'IPD',                 order: 6  },
  { code: 'blood_bank',         name: 'Blood Bank',                   sheetName: 'Blood Bank',          order: 7  },
  { code: 'lab',                name: 'Laboratory',                   sheetName: 'Lab',                 order: 8  },
  { code: 'radiology',          name: 'Radiology',                    sheetName: 'Radiology ',          order: 9  },
  { code: 'pharmacy',           name: 'Pharmacy',                     sheetName: 'Pharmacy',            order: 10 },
  { code: 'auxiliary_services', name: 'Auxiliary Services',           sheetName: 'Auxillary services',  order: 11 },
  { code: 'mortuary',           name: 'Mortuary',                     sheetName: 'Mortuary ',           order: 12 },
  { code: 'admin',              name: 'Administration',               sheetName: 'Admin',               order: 13 },
  { code: 'paed_opd',           name: 'Paediatrics OPD (MusQan)',     sheetName: 'Paed_OPD',            order: 14 },
];

// ─── Client Department config (KMIO) ─────────────────────────────────────────

interface ClientDeptConfig {
  code: string;
  name: string;
  pdfFileName: string;
  order: number;
  nqasCode: string;       // maps to NQAS_DEPARTMENTS[].code
  programmes?: string[];  // e.g. ['NQAS'], ['NQAS','MUSQAN'], ['NQAS','LAQSHYA']
}

const CLIENT_DEPARTMENTS: ClientDeptConfig[] = [
  { code: 'EMERGENCY',  name: 'Emergency Oncology',              pdfFileName: '1.EMERGENCY -ONCO 2024.pdf',           order: 1,  nqasCode: 'emergency',          programmes: ['NQAS']           },
  { code: 'OPD',        name: 'OPD Oncology',                    pdfFileName: '2.OPD-ONCO 2024.pdf',                  order: 2,  nqasCode: 'opd',                programmes: ['NQAS']           },
  { code: 'PAED_WARD',  name: 'Paediatric Ward (MusQan)',        pdfFileName: '3. PAED WARD MUSKAN-ONCO 2024.pdf',    order: 3,  nqasCode: 'paed_ward',          programmes: ['NQAS', 'MUSQAN'] },
  { code: 'OT',         name: 'Operation Theatre',               pdfFileName: '4. OT-ONCO 2024.pdf',                  order: 4,  nqasCode: 'ot',                 programmes: ['NQAS']           },
  { code: 'ICU',        name: 'Intensive Care Unit',             pdfFileName: '5. ICU-ONCO 2024.pdf',                 order: 5,  nqasCode: 'icu',                programmes: ['NQAS']           },
  { code: 'IPD',        name: 'In-Patient Department',           pdfFileName: '6. IPD-ONCO 2024.pdf',                 order: 6,  nqasCode: 'ipd',                programmes: ['NQAS']           },
  { code: 'BLOOD_BANK', name: 'Blood Bank',                      pdfFileName: '7. BLOOD BANK-ONCO 2024.pdf',          order: 7,  nqasCode: 'blood_bank',         programmes: ['NQAS']           },
  { code: 'LAB',        name: 'Laboratory',                      pdfFileName: '8. LAB-ONCO 2024.pdf',                 order: 8,  nqasCode: 'lab',                programmes: ['NQAS']           },
  { code: 'RADIOLOGY',  name: 'Radiology',                       pdfFileName: '9. RADIOLOGY-ONCO 2024.pdf',           order: 9,  nqasCode: 'radiology',          programmes: ['NQAS']           },
  { code: 'PHARMACY',   name: 'Pharmacy',                        pdfFileName: '10.PHARMACY-ONCO 2024.pdf',            order: 10, nqasCode: 'pharmacy',           programmes: ['NQAS']           },
  { code: 'AUXILIARY',  name: 'Auxiliary Services',              pdfFileName: '11.AUXILLARY SERVICES-ONCO 2024.pdf',  order: 11, nqasCode: 'auxiliary_services', programmes: ['NQAS']           },
  { code: 'MORTUARY',   name: 'Mortuary',                        pdfFileName: '12.MORTUARY-ONCO 2024.pdf',            order: 12, nqasCode: 'mortuary',           programmes: ['NQAS']           },
  { code: 'ADMIN',      name: 'Administration',                  pdfFileName: '13.ADMIN-ONCO 2024.pdf',               order: 13, nqasCode: 'admin',              programmes: ['NQAS']           },
  { code: 'PAED_OPD',   name: 'Paediatric OPD (MusQan)',         pdfFileName: '14. PAED OPD MUSKAN-ONCO 2024.pdf',   order: 14, nqasCode: 'paed_opd',           programmes: ['NQAS', 'MUSQAN'] },
];

// ─── Demo users ───────────────────────────────────────────────────────────────

type AppModuleSeed = 'NQAS' | 'NABH' | 'KAYAKALPA';

interface UserSeed {
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'HOD' | 'ASSESSOR';
  designation?: string;
  phone?: string;
  departmentCode?: string; // NQAS department code for HODs
  moduleAccess?: AppModuleSeed[];
}

const DEMO_USERS: UserSeed[] = [
  // Super Admin — owns the Quality & Patient Safety / KPI template configuration
  {
    email: process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@kmio.ac.in',
    name: process.env.SEED_SUPERADMIN_NAME || 'Super Administrator',
    role: 'SUPER_ADMIN',
    designation: 'Quality & Patient Safety Head',
    phone: '+91-80-26569001',
    moduleAccess: ['NQAS', 'NABH', 'KAYAKALPA'],
  },
  // Admin — full access to all modules
  {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@kmio.ac.in',
    name: process.env.SEED_ADMIN_NAME || 'System Administrator',
    role: 'ADMIN',
    designation: 'Quality Manager',
    phone: '+91-80-26569000',
    moduleAccess: ['NQAS', 'NABH', 'KAYAKALPA'],
  },
  // HODs — NQAS access by default
  { email: 'hod.emergency@kmio.ac.in',  name: 'Dr. Ravi Kumar',      role: 'HOD', designation: 'Head of Emergency',         departmentCode: 'emergency',          moduleAccess: ['NQAS'] },
  { email: 'hod.opd@kmio.ac.in',        name: 'Dr. Priya Sharma',    role: 'HOD', designation: 'Head of OPD',                departmentCode: 'opd',                moduleAccess: ['NQAS'] },
  { email: 'hod.paed@kmio.ac.in',       name: 'Dr. Anitha Reddy',    role: 'HOD', designation: 'Head of Paediatrics',        departmentCode: 'paed_ward',          moduleAccess: ['NQAS'] },
  { email: 'hod.ot@kmio.ac.in',         name: 'Dr. Suresh Babu',     role: 'HOD', designation: 'Head of Operation Theatre',  departmentCode: 'ot',                 moduleAccess: ['NQAS'] },
  { email: 'hod.icu@kmio.ac.in',        name: 'Dr. Meena Nair',      role: 'HOD', designation: 'Head of ICU',                departmentCode: 'icu',                moduleAccess: ['NQAS'] },
  { email: 'hod.ipd@kmio.ac.in',        name: 'Dr. Venkat Rao',      role: 'HOD', designation: 'Head of IPD',                departmentCode: 'ipd',                moduleAccess: ['NQAS'] },
  { email: 'hod.bloodbank@kmio.ac.in',  name: 'Dr. Lakshmi Devi',    role: 'HOD', designation: 'Head of Blood Bank',         departmentCode: 'blood_bank',         moduleAccess: ['NQAS'] },
  { email: 'hod.lab@kmio.ac.in',        name: 'Dr. Kiran Kumar',     role: 'HOD', designation: 'Head of Laboratory',         departmentCode: 'lab',                moduleAccess: ['NQAS'] },
  { email: 'hod.radiology@kmio.ac.in',  name: 'Dr. Girish Patil',    role: 'HOD', designation: 'Head of Radiology',          departmentCode: 'radiology',          moduleAccess: ['NQAS'] },
  { email: 'hod.pharmacy@kmio.ac.in',   name: 'Mr. Ramesh Joshi',    role: 'HOD', designation: 'Chief Pharmacist',           departmentCode: 'pharmacy',           moduleAccess: ['NQAS'] },
  { email: 'hod.auxiliary@kmio.ac.in',  name: 'Mr. Nagaraj S.',      role: 'HOD', designation: 'Head of Auxiliary Services', departmentCode: 'auxiliary_services', moduleAccess: ['NQAS'] },
  { email: 'hod.mortuary@kmio.ac.in',   name: 'Dr. Shivakumar B.',   role: 'HOD', designation: 'Mortuary Incharge',          departmentCode: 'mortuary',           moduleAccess: ['NQAS'] },
  { email: 'hod.admin@kmio.ac.in',      name: 'Mr. Prakash D.',      role: 'HOD', designation: 'Administrative Officer',     departmentCode: 'admin',              moduleAccess: ['NQAS'] },
  { email: 'hod.paedopd@kmio.ac.in',    name: 'Dr. Suma Gowda',      role: 'HOD', designation: 'Head of Paediatric OPD',    departmentCode: 'paed_opd',           moduleAccess: ['NQAS'] },
  // Assessors — NQAS access by default
  { email: 'assessor1@kmio.ac.in', name: 'Dr. Arun Krishnan',   role: 'ASSESSOR', designation: 'Internal Assessor', moduleAccess: ['NQAS'] },
  { email: 'assessor2@kmio.ac.in', name: 'Dr. Deepa Menon',     role: 'ASSESSOR', designation: 'Internal Assessor', moduleAccess: ['NQAS'] },
  { email: 'assessor3@kmio.ac.in', name: 'Ms. Kavitha Raj',     role: 'ASSESSOR', designation: 'Quality Nurse',     moduleAccess: ['NQAS'] },
];

// ─── Areas of Concern names ───────────────────────────────────────────────────

const AREAS_OF_CONCERN: Record<string, string> = {
  A: 'Service Provision',
  B: 'Patient Rights',
  C: 'Inputs',
  D: 'Support Services',
  E: 'Clinical Services',
  F: 'Infection Control',
  G: 'Quality Management',
  H: 'Outcome',
};

// ─── Committee position types (FRS §3.2) ─────────────────────────────────────

interface PositionTypeSeed {
  name: string;
  order: number;
  isLeadership: boolean;
  canApprove: boolean;
}

const COMMITTEE_POSITION_TYPES: PositionTypeSeed[] = [
  { name: 'Chairperson',         order: 1, isLeadership: true,  canApprove: true  },
  { name: 'Vice Chairperson',    order: 2, isLeadership: true,  canApprove: true  },
  { name: 'Member Secretary',    order: 3, isLeadership: true,  canApprove: true  },
  { name: 'Co-ordinator',        order: 4, isLeadership: false, canApprove: false },
  { name: 'Executive Secretary', order: 5, isLeadership: false, canApprove: false },
  { name: 'Member',              order: 6, isLeadership: false, canApprove: false },
  { name: 'Invited Member',      order: 7, isLeadership: false, canApprove: false },
];

// ─── Designations (FRS §3.3A — designation-based membership) ─────────────────

interface DesignationSeed {
  code: string;
  name: string;
}

const DESIGNATIONS: DesignationSeed[] = [
  { code: 'MEDICAL_SUPERINTENDENT', name: 'Medical Superintendent' },
  { code: 'NURSING_SUPERINTENDENT', name: 'Nursing Superintendent' },
  { code: 'QUALITY_HEAD',           name: 'Quality Head' },
  { code: 'HOSPITAL_ADMINISTRATOR', name: 'Hospital Administrator' },
  { code: 'MEDICAL_DIRECTOR',       name: 'Medical Director' },
  { code: 'INFECTION_CONTROL_OFFICER', name: 'Infection Control Officer' },
];

// Title incumbents — which users hold which designation(s).
// Users may hold multiple titles (many-to-many); a title may have multiple
// holders, so designation-based committee membership shows a chooser.
const USER_DESIGNATIONS: Record<string, string[]> = {
  'hod.admin@kmio.ac.in':  ['HOSPITAL_ADMINISTRATOR', 'MEDICAL_SUPERINTENDENT'], // multi-title holder
  'hod.icu@kmio.ac.in':    ['MEDICAL_DIRECTOR'],
  'hod.ipd@kmio.ac.in':    ['NURSING_SUPERINTENDENT'],
  'hod.lab@kmio.ac.in':    ['INFECTION_CONTROL_OFFICER'],
  'assessor1@kmio.ac.in':  ['QUALITY_HEAD'],
  'assessor2@kmio.ac.in':  ['QUALITY_HEAD', 'MEDICAL_SUPERINTENDENT'],          // multi-title holder
  'assessor3@kmio.ac.in':  ['INFECTION_CONTROL_OFFICER', 'QUALITY_HEAD'],       // multi-title holder
};

// ─── Committee demo data ─────────────────────────────────────────────────────

interface MemberSeed {
  position: string;        // CommitteePositionType.name
  type: 'DESIGNATION' | 'NOMINATION';
  email?: string;          // nomination — the nominated user
  designationCode?: string; // designation-based — the title
  holderEmail?: string;     // designation-based — the specific incumbent pinned to this seat
}

interface CommitteeSeed {
  name: string;
  category: string;
  type: string;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'CUSTOM';
  purpose: string;
  members: MemberSeed[];
}

const COMMITTEES: CommitteeSeed[] = [
  {
    name: 'Hospital Infection Control Committee',
    category: 'Clinical', type: 'NABH', frequency: 'MONTHLY',
    purpose: 'Monitor, prevent and control healthcare-associated infections across the institute.',
    members: [
      { position: 'Chairperson',      type: 'DESIGNATION', designationCode: 'MEDICAL_SUPERINTENDENT',   holderEmail: 'hod.admin@kmio.ac.in' },
      { position: 'Member Secretary', type: 'NOMINATION',  email: 'hod.lab@kmio.ac.in' },
      { position: 'Member',           type: 'DESIGNATION', designationCode: 'INFECTION_CONTROL_OFFICER', holderEmail: 'assessor3@kmio.ac.in' },
      { position: 'Member',           type: 'NOMINATION',  email: 'hod.icu@kmio.ac.in' },
      { position: 'Member',           type: 'NOMINATION',  email: 'hod.pharmacy@kmio.ac.in' },
    ],
  },
  {
    name: 'Quality Assurance Committee',
    category: 'Quality', type: 'NQAS', frequency: 'QUARTERLY',
    purpose: 'Oversee quality indicators, audits and continual improvement initiatives.',
    members: [
      { position: 'Chairperson',      type: 'DESIGNATION', designationCode: 'QUALITY_HEAD',    holderEmail: 'assessor3@kmio.ac.in' },
      { position: 'Vice Chairperson', type: 'DESIGNATION', designationCode: 'MEDICAL_DIRECTOR', holderEmail: 'hod.icu@kmio.ac.in' },
      { position: 'Member Secretary', type: 'NOMINATION',  email: 'assessor1@kmio.ac.in' },
      { position: 'Member',           type: 'NOMINATION',  email: 'hod.opd@kmio.ac.in' },
      { position: 'Member',           type: 'NOMINATION',  email: 'hod.emergency@kmio.ac.in' },
      { position: 'Invited Member',   type: 'NOMINATION',  email: 'assessor2@kmio.ac.in' },
    ],
  },
  {
    name: 'Paediatric Oncology Quality Assurance Committee',
    category: 'Clinical', type: 'NQAS', frequency: 'QUARTERLY',
    purpose: 'Quality assurance for paediatric oncology services (MusQan).',
    members: [
      { position: 'Chairperson',      type: 'NOMINATION',  email: 'hod.paed@kmio.ac.in' },
      { position: 'Member Secretary', type: 'NOMINATION',  email: 'hod.paedopd@kmio.ac.in' },
      { position: 'Member',           type: 'DESIGNATION', designationCode: 'NURSING_SUPERINTENDENT', holderEmail: 'hod.ipd@kmio.ac.in' },
      { position: 'Member',           type: 'NOMINATION',  email: 'assessor3@kmio.ac.in' },
    ],
  },
];

// ─── Excel parsing ────────────────────────────────────────────────────────────

interface ParsedRow {
  type: 'area' | 'standard' | 'me';
  areaCode?: string;
  areaName?: string;
  standardCode?: string;
  standardName?: string;
  standardMaxScore?: number;
  meRef?: string;
  meDescription?: string;
  checkpoint?: string;
  maxScore?: number;
  assessmentMethod?: string;
  meansOfVerification?: string;
}

function parseDepartmentSheet(ws: XLSX.WorkSheet): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let dataStarted = false;

  const sheetData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });

  for (const row of sheetData) {
    const nonNull = (row as any[]).filter((v) => v !== null && v !== undefined && v !== '');
    if (nonNull.length === 0) continue;

    const firstCell = String(nonNull[0] || '').trim();

    // Detect header row: "Reference No." in ANY column
    // (OPD sheet has it in col B, not col A)
    if (!dataStarted && nonNull.some((v) => String(v).trim() === 'Reference No.')) {
      dataStarted = true;
      continue;
    }

    // Detect Area of Concern in ANY cell
    // (Blood Bank has a "." in col A before the area text in col B)
    const areaStr = nonNull.map((v) => String(v).trim()).find((s) => s.startsWith('Area of Concern'));
    if (areaStr) {
      // Flexible regex: handles "- A Service Provision", "C: Inputs", "B Patient Rights" variants
      const match = areaStr.match(/Area of Concern\s*[-–]?\s*([A-H])[:\s]\s*(.+)/i);
      if (match) {
        // Also triggers dataStarted for sheets without a Reference No. header (Lab)
        if (!dataStarted) dataStarted = true;
        rows.push({ type: 'area', areaCode: match[1].toUpperCase(), areaName: match[2].trim() });
      }
      continue;
    }

    if (!dataStarted) continue;

    // Real NQAS standards: "Standard A1", "Standard F6." etc.
    // Requires letter (A-H) + digit to exclude "Standard practice of mopping..." type rows
    if (/^Standard\s+[A-H]\d/i.test(firstCell)) {
      const code = firstCell.replace(/\.$/, '').trim();
      const name = nonNull[1] ? String(nonNull[1]).trim() : '';
      const rawScore = nonNull[2];
      const maxScore = typeof rawScore === 'number' ? rawScore : 0;
      rows.push({ type: 'standard', standardCode: code, standardName: name, standardMaxScore: maxScore });
      continue;
    }

    if (firstCell.startsWith('ME ')) {
      const meRef = firstCell;
      const meDescription = nonNull[1] ? String(nonNull[1]).trim() : '';
      let checkpoint: string | undefined;
      let maxScore = 0;
      let assessmentMethod: string | undefined;
      let meansOfVerification: string | undefined;

      if (nonNull.length >= 4 && typeof nonNull[3] === 'number') {
        checkpoint = String(nonNull[2]).trim();
        maxScore = nonNull[3] as number;
        assessmentMethod = nonNull[4] ? String(nonNull[4]).trim() : undefined;
        meansOfVerification = nonNull[5] ? String(nonNull[5]).trim() : undefined;
      } else if (nonNull.length >= 3 && typeof nonNull[2] === 'number') {
        maxScore = nonNull[2] as number;
        assessmentMethod = nonNull[3] ? String(nonNull[3]).trim() : undefined;
      }

      rows.push({
        type: 'me',
        meRef,
        meDescription,
        checkpoint: checkpoint || undefined,
        maxScore,
        assessmentMethod,
        meansOfVerification,
      });
      continue;
    }
  }

  return rows;
}

// ─── Seeding functions ────────────────────────────────────────────────────────

async function seedHospitalSettings() {
  console.log('  Seeding hospital settings…');
  const count = await prisma.hospitalSettings.count();
  if (count === 0) {
    await prisma.hospitalSettings.create({
      data: {
        name: 'Kidwai Memorial Institute of Oncology',
        shortName: 'KMIO',
        address: 'Hosur Road, Bengaluru – 560029',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560029',
        phone: '+91-80-26569000',
        email: 'director@kmio.karnataka.gov.in',
        website: 'https://kmio.karnataka.gov.in',
        districtBoard: 'Karnataka Health & Family Welfare Services',
        accreditationBody: 'NABH',
      },
    });
    console.log('    ✓ Hospital settings created (KMIO)');
  } else {
    // Update existing record
    const existing = await prisma.hospitalSettings.findFirst();
    if (existing) {
      await prisma.hospitalSettings.update({
        where: { id: existing.id },
        data: {
          name: 'Kidwai Memorial Institute of Oncology',
          shortName: 'KMIO',
          address: 'Hosur Road, Bengaluru – 560029',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560029',
          phone: '+91-80-26569000',
          email: 'director@kmio.karnataka.gov.in',
          districtBoard: 'Karnataka Health & Family Welfare Services',
          accreditationBody: 'NABH',
        },
      });
    }
    console.log('    ✓ Hospital settings updated (KMIO)');
  }
}

async function seedNqasDepartment(dept: DepartmentConfig, ws: XLSX.WorkSheet | undefined) {
  console.log(`  Seeding: ${dept.name}`);

  const department = await prisma.department.upsert({
    where: { code: dept.code },
    update: { name: dept.name, sheetName: dept.sheetName, order: dept.order },
    create: { code: dept.code, name: dept.name, sheetName: dept.sheetName, order: dept.order },
  });

  if (!ws) {
    console.warn(`    ⚠ Sheet "${dept.sheetName}" not found — skipping MEs`);
    return;
  }

  const rows = parseDepartmentSheet(ws);
  let currentAreaId: string | null = null;
  let currentStandardId: string | null = null;
  let areaOrder = 0, standardOrder = 0, meOrder = 0;

  for (const row of rows) {
    if (row.type === 'area') {
      areaOrder++; meOrder = 0; standardOrder = 0;
      const areaName = row.areaName || AREAS_OF_CONCERN[row.areaCode!] || row.areaCode!;
      const area = await prisma.areaOfConcern.upsert({
        where: { code_departmentId: { code: row.areaCode!, departmentId: department.id } },
        update: { name: areaName, order: areaOrder },
        create: { code: row.areaCode!, name: areaName, order: areaOrder, departmentId: department.id },
      });
      currentAreaId = area.id;
    } else if (row.type === 'standard' && currentAreaId) {
      standardOrder++; meOrder = 0;
      const standard = await prisma.standard.upsert({
        where: { code_areaOfConcernId: { code: row.standardCode!, areaOfConcernId: currentAreaId } },
        update: { name: row.standardName || '', maxScore: row.standardMaxScore || 0, order: standardOrder },
        create: { code: row.standardCode!, name: row.standardName || '', maxScore: row.standardMaxScore || 0, order: standardOrder, areaOfConcernId: currentAreaId },
      });
      currentStandardId = standard.id;
    } else if (row.type === 'me' && currentStandardId) {
      meOrder++;
      await prisma.measurableElement.upsert({
        where: { meRef_standardId: { meRef: row.meRef!, standardId: currentStandardId } },
        update: {
          meDescription: row.meDescription || '',
          checkpoint: row.checkpoint || null,
          maxScore: row.maxScore || 0,
          isScored: !!(row.checkpoint && (row.maxScore || 0) > 0),
          assessmentMethod: row.assessmentMethod || null,
          meansOfVerification: row.meansOfVerification || null,
          order: meOrder,
        },
        create: {
          meRef: row.meRef!,
          meDescription: row.meDescription || '',
          checkpoint: row.checkpoint || null,
          maxScore: row.maxScore || 0,
          isScored: !!(row.checkpoint && (row.maxScore || 0) > 0),
          assessmentMethod: row.assessmentMethod || null,
          meansOfVerification: row.meansOfVerification || null,
          order: meOrder,
          standardId: currentStandardId,
        },
      });
    }
  }

  const meCount = rows.filter((r) => r.type === 'me').length;
  const scored = rows.filter((r) => r.type === 'me' && r.checkpoint).length;
  console.log(`    ✓ ${meCount} MEs (${scored} scored)`);
}

async function seedClientDepartments() {
  console.log('\n🏥 Seeding client departments (KMIO)…');

  for (const cd of CLIENT_DEPARTMENTS) {
    // Look up the corresponding NQAS department
    const nqasDept = await prisma.department.findUnique({ where: { code: cd.nqasCode } });

    await prisma.clientDepartment.upsert({
      where: { code: cd.code },
      update: {
        name: cd.name,
        pdfFileName: cd.pdfFileName,
        order: cd.order,
        isActive: true,
        programmes: cd.programmes ?? ['NQAS'],
        nqasDepartmentId: nqasDept?.id ?? null,
      },
      create: {
        code: cd.code,
        name: cd.name,
        pdfFileName: cd.pdfFileName,
        order: cd.order,
        isActive: true,
        programmes: cd.programmes ?? ['NQAS'],
        nqasDepartmentId: nqasDept?.id ?? null,
      },
    });

    console.log(`  ✓ ${cd.code} — ${cd.name}`);
  }
}

async function seedUsers() {
  console.log('\n👤 Seeding users…');

  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || 'Demo@1234!';
  const hashed = await bcrypt.hash(defaultPassword, 12);

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@1234!';
  const hashedAdmin = await bcrypt.hash(adminPassword, 12);

  const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'SuperAdmin@1234!';
  const hashedSuper = await bcrypt.hash(superAdminPassword, 12);

  // Build department name lookup (code → name)
  const deptNameMap: Record<string, string> = {};
  for (const d of NQAS_DEPARTMENTS) {
    deptNameMap[d.code] = d.name;
  }

  for (const u of DEMO_USERS) {
    const isAdmin = u.role === 'ADMIN' || u.role === 'SUPER_ADMIN';
    const passwordHash =
      u.role === 'SUPER_ADMIN' ? hashedSuper : u.role === 'ADMIN' ? hashedAdmin : hashed;
    const deptName = u.departmentCode ? deptNameMap[u.departmentCode] : undefined;

    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, isActive: true, designation: u.designation ?? null, moduleAccess: u.moduleAccess ?? ['NQAS'] },
      create: {
        email: u.email,
        password: passwordHash,
        name: u.name,
        role: u.role,
        designation: u.designation ?? null,
        phone: u.phone ?? null,
        department: deptName ?? null,
        isActive: true,
        moduleAccess: u.moduleAccess ?? ['NQAS'],
      },
    });

    const tag = isAdmin ? '🔑' : u.role === 'HOD' ? '🏥' : '📋';
    console.log(`  ${tag} ${u.role.padEnd(8)} ${u.email}`);
  }

  console.log(`\n  Default password (non-admin): ${defaultPassword}`);
  console.log(`  Admin password:               ${adminPassword}`);
  console.log(`  Super Admin password:         ${superAdminPassword}`);
}

// ─── Client sections & checkpoints (from NQAS ME structure) ──────────────────

async function seedClientSections() {
  console.log('\n📝 Seeding client sections & checkpoints…');

  for (const cd of CLIENT_DEPARTMENTS) {
    const clientDept = await prisma.clientDepartment.findUnique({ where: { code: cd.code } });
    if (!clientDept?.nqasDepartmentId) {
      console.log(`  ⚠ ${cd.code} — no NQAS link, skipping`);
      continue;
    }

    const areas = await prisma.areaOfConcern.findMany({
      where: { departmentId: clientDept.nqasDepartmentId },
      orderBy: { order: 'asc' },
      include: {
        standards: {
          orderBy: { order: 'asc' },
          include: {
            measurableElements: {
              where: { isScored: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    let sectionCount = 0;
    let checkpointCount = 0;

    for (const area of areas) {
      const scoredMEs = area.standards.flatMap((s) => s.measurableElements);
      if (scoredMEs.length === 0) continue;

      sectionCount++;
      const sectionCode = `${cd.code}-${area.code}`;

      const section = await prisma.clientSection.upsert({
        where: { sectionCode_clientDepartmentId: { sectionCode, clientDepartmentId: clientDept.id } },
        update: { sectionName: `${area.code}. ${area.name}`, sectionOrder: area.order },
        create: {
          sectionCode,
          sectionName: `${area.code}. ${area.name}`,
          sectionOrder: area.order,
          clientDepartmentId: clientDept.id,
        },
      });

      for (let i = 0; i < scoredMEs.length; i++) {
        const me = scoredMEs[i];
        const checkpointCode = `${cd.code.substring(0, 5)}-${area.code}${String(i + 1).padStart(3, '0')}`;
        checkpointCount++;

        const cp = await prisma.clientCheckpoint.upsert({
          where: { checkpointCode_clientSectionId: { checkpointCode, clientSectionId: section.id } },
          update: {
            description: me.checkpoint || me.meDescription,
            maxScore: me.maxScore,
            checkpointOrder: i + 1,
          },
          create: {
            checkpointCode,
            description: me.checkpoint || me.meDescription,
            maxScore: me.maxScore,
            scoreOptions: me.maxScore === 2 ? [0, 1, 2] : me.maxScore === 1 ? [0, 1] : [0, me.maxScore],
            checkpointOrder: i + 1,
            clientSectionId: section.id,
          },
        });

        await prisma.checklistMapping.upsert({
          where: { clientCheckpointId: cp.id },
          update: { measurableElementId: me.id, scoreMappingType: 'DIRECT', isNa: false },
          create: {
            clientCheckpointId: cp.id,
            measurableElementId: me.id,
            scoreMappingType: 'DIRECT',
            isNa: false,
            importVersion: 'seed-v1',
          },
        });
      }
    }

    console.log(`  ✓ ${cd.code} — ${sectionCount} sections, ${checkpointCount} checkpoints`);
  }
}

// ─── Role permissions ─────────────────────────────────────────────────────────

async function seedRolePermissions() {
  console.log('\n🔐 Seeding role permissions…');

  const defaults: {
    role: 'SUPER_ADMIN' | 'ADMIN' | 'HOD' | 'ASSESSOR';
    modules: ('NQAS' | 'NABH' | 'KAYAKALPA')[];
    pages: string[];
  }[] = [
    // pages MUST match the dashboard nav hrefs (href.slice(1)) or items get hidden.
    { role: 'SUPER_ADMIN', modules: ['NQAS', 'NABH', 'KAYAKALPA'], pages: ['dashboard','assessment-cycles','approvals','committees','reports','indicators','kpi-templates','users','email-templates','audit-logs','settings'] },
    { role: 'ADMIN',    modules: ['NQAS', 'NABH', 'KAYAKALPA'], pages: ['dashboard','assessment-cycles','approvals','committees','reports','indicators','users','email-templates','audit-logs','settings'] },
    { role: 'HOD',      modules: ['NQAS'],                       pages: ['dashboard','assessment-cycles','approvals','committees','reports'] },
    { role: 'ASSESSOR', modules: ['NQAS'],                       pages: ['dashboard','assessment-cycles','committees','reports'] },
  ];

  for (const { role, modules, pages } of defaults) {
    await prisma.rolePermission.upsert({
      where: { role },
      update: { pageAccess: pages },  // keep nav-aligned page keys current
      create: { role, moduleAccess: modules, pageAccess: pages },
    });
    console.log(`  ✓ ${role} — modules: ${modules.join(', ')} | pages: ${pages.join(', ')}`);
  }
}

// ─── Committee master data ───────────────────────────────────────────────────

async function seedCommitteePositionTypes() {
  console.log('\n🏛️  Seeding committee position types…');
  for (const p of COMMITTEE_POSITION_TYPES) {
    await prisma.committeePositionType.upsert({
      where: { name: p.name },
      update: { order: p.order, isLeadership: p.isLeadership, canApprove: p.canApprove, isActive: true },
      create: { name: p.name, order: p.order, isLeadership: p.isLeadership, canApprove: p.canApprove },
    });
    console.log(`  ✓ ${p.name}${p.canApprove ? ' (can approve)' : ''}`);
  }
}

async function seedDesignations() {
  console.log('\n🧑‍⚕️  Seeding designations…');
  for (const d of DESIGNATIONS) {
    await prisma.designation.upsert({
      where: { code: d.code },
      update: { name: d.name, isActive: true },
      create: { code: d.code, name: d.name },
    });
    console.log(`  ✓ ${d.name}`);
  }
}

// Link users to the designation titles they hold (many-to-many). Runs after
// both users and designations exist so the relation can be connected by code.
async function seedUserDesignations() {
  console.log('\n🏷️  Linking user titles…');
  const designations = await prisma.designation.findMany({ select: { id: true, code: true } });
  const idByCode: Record<string, string> = Object.fromEntries(designations.map((d) => [d.code, d.id]));

  for (const [email, codes] of Object.entries(USER_DESIGNATIONS)) {
    const ids = codes.map((c) => idByCode[c]).filter(Boolean).map((id) => ({ id }));
    if (!ids.length) continue;
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) { console.warn(`  ⚠ ${email} not found — skipping titles`); continue; }
    await prisma.user.update({ where: { id: user.id }, data: { designations: { set: ids } } });
    console.log(`  ✓ ${email} → ${codes.join(', ')}`);
  }
}

// ─── Email templates (used for meeting reminders) ─────────────────────────────

async function seedEmailTemplates() {
  console.log('\n📧 Seeding email templates…');
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });

  const templates = [
    {
      name: 'Standard Meeting Reminder',
      description: 'Default reminder sent to committee members for an upcoming meeting.',
      category: 'MEETING_REMINDER',
      subject: 'Reminder: {{meetingTitle}} on {{meetingDate}}',
      body: `<div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1e293b;">
  <h2 style="color:#0A1628;">{{meetingTitle}}</h2>
  <p>Hello <strong>{{memberName}}</strong>,</p>
  <p>This is a reminder for the upcoming <strong>{{committeeName}}</strong> meeting:</p>
  <ul>
    <li><strong>Date:</strong> {{meetingDate}} {{meetingTime}}</li>
    <li><strong>Mode:</strong> {{mode}}</li>
    <li><strong>Venue:</strong> {{venue}}</li>
    <li><strong>Join link:</strong> {{meetingLink}}</li>
  </ul>
  <p>Please make arrangements to attend. Agenda items may be submitted ahead of the meeting.</p>
  <p style="color:#666;font-size:12px;">Kidwai Memorial Institute of Oncology — NQAS Platform</p>
</div>`,
    },
    {
      name: 'Brief Meeting Reminder',
      description: 'A short, single-line reminder.',
      category: 'MEETING_REMINDER',
      subject: '{{committeeName}} meeting — {{meetingDate}}',
      body: `<div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1e293b;">
  <p>Hello <strong>{{memberName}}</strong>,</p>
  <p>Reminder: <strong>{{meetingTitle}}</strong> ({{committeeName}}) is scheduled on <strong>{{meetingDate}} {{meetingTime}}</strong> — {{mode}}{{venue}}.</p>
</div>`,
    },
  ];

  for (const t of templates) {
    const existing = await prisma.emailTemplate.findFirst({ where: { name: t.name } });
    if (existing) {
      await prisma.emailTemplate.update({ where: { id: existing.id }, data: t });
    } else {
      await prisma.emailTemplate.create({ data: { ...t, createdById: admin?.id ?? null } });
    }
    console.log(`  ✓ ${t.name}`);
  }
}

// ─── Committee demo data (committees → meetings → agenda → minutes → actions) ──

async function seedCommittees() {
  console.log('\n🏛️  Seeding committee demo data…');

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  if (!admin) { console.warn('  ⚠ admin user not found — skipping committee seed'); return; }

  const positions = await prisma.committeePositionType.findMany();
  const posByName: Record<string, string> = Object.fromEntries(positions.map((p) => [p.name, p.id]));
  const designations = await prisma.designation.findMany();
  const desByCode: Record<string, string> = Object.fromEntries(designations.map((d) => [d.code, d.id]));
  const desNameByCode: Record<string, string> = Object.fromEntries(designations.map((d) => [d.code, d.name]));
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, department: true } });
  const userByEmail: Record<string, (typeof users)[number]> = Object.fromEntries(users.map((u) => [u.email, u]));

  const now = new Date();
  const days = (n: number) => new Date(now.getTime() + n * 86_400_000);
  let actionSeq = await prisma.actionItem.count();

  for (const c of COMMITTEES) {
    const dupe = await prisma.committee.findFirst({ where: { name: c.name } });
    if (dupe) { console.log(`  ⏭  ${c.name} — already exists, skipping`); continue; }

    const committee = await prisma.committee.create({
      data: {
        name: c.name, category: c.category, type: c.type, purpose: c.purpose,
        frequency: c.frequency as any, status: 'ACTIVE', module: 'NQAS',
        effectiveDate: days(-180), createdById: admin.id,
      },
    });

    // Members + membership history
    const memberRecords: { id: string; userId: string | null }[] = [];
    for (const m of c.members) {
      const positionTypeId = posByName[m.position];
      // NOMINATION → the nominated user; DESIGNATION → the specific incumbent holding the title.
      const seatUser = m.type === 'NOMINATION'
        ? (m.email ? userByEmail[m.email] : undefined)
        : (m.holderEmail ? userByEmail[m.holderEmail] : undefined);
      const member = await prisma.committeeMember.create({
        data: {
          committeeId: committee.id,
          positionTypeId,
          membershipType: m.type,
          userId: seatUser?.id ?? null,
          designationId: m.type === 'DESIGNATION' ? desByCode[m.designationCode!] ?? null : null,
          startDate: days(-180),
        },
      });
      memberRecords.push({ id: member.id, userId: member.userId });
      await prisma.committeeMembershipHistory.create({
        data: {
          committeeId: committee.id, memberId: member.id, changeType: 'ADDED',
          // Mirror the API's snapshot shape so the UI can resolve the member name.
          newValue: {
            position: m.position,
            membershipType: m.type,
            userName: seatUser?.name ?? null,
            nomineeName: null,
            designation: m.type === 'DESIGNATION' ? (desNameByCode[m.designationCode!] ?? null) : null,
          },
          changedById: admin.id, changeReason: 'Committee constitution',
        },
      });
    }

    const memberUserIds = memberRecords.map((m) => m.userId).filter((id): id is string => !!id);

    // ── Past meeting (conducted) ──
    const pastMeeting = await prisma.committeeMeeting.create({
      data: {
        committeeId: committee.id, title: `${c.name} — Review Meeting`,
        scheduledDate: days(-30), time: '11:00', venue: 'Committee Room', mode: 'PHYSICAL',
        status: 'COMPLETED', agendaDeadline: days(-35), createdById: admin.id,
      },
    });

    // Agenda (2 published, 1 accepted)
    const agendaSpecs = [
      { title: 'Review of previous action points', status: 'PUBLISHED' },
      { title: 'Quality indicator trends', status: 'PUBLISHED' },
      { title: 'New improvement proposals', status: 'ACCEPTED' },
    ];
    const submitter = memberUserIds[0] ?? admin.id;
    const agendaItems: { id: string; title: string }[] = [];
    for (let i = 0; i < agendaSpecs.length; i++) {
      const a = await prisma.agendaItem.create({
        data: {
          meetingId: pastMeeting.id, title: agendaSpecs[i].title,
          description: 'Discussed during the committee meeting.',
          submittedById: submitter, status: agendaSpecs[i].status as any, order: i + 1,
        },
      });
      agendaItems.push({ id: a.id, title: a.title });
    }

    // Attendance (alternate present/absent)
    for (let i = 0; i < memberRecords.length; i++) {
      await prisma.meetingAttendance.create({
        data: {
          meetingId: pastMeeting.id, memberId: memberRecords[i].id,
          status: i % 3 === 2 ? 'ABSENT' : 'PRESENT',
        },
      });
    }

    // Minutes (published, direct entries per published agenda item)
    const minutes = await prisma.meetingMinutes.create({
      data: { meetingId: pastMeeting.id, method: 'DIRECT', status: 'PUBLISHED', approvedById: admin.id, publishedAt: days(-28) },
    });
    const published = agendaItems.filter((_, i) => agendaSpecs[i].status === 'PUBLISHED');
    for (let i = 0; i < published.length; i++) {
      await prisma.minuteEntry.create({
        data: {
          minutesId: minutes.id, agendaItemId: published[i].id,
          discussionSummary: 'Detailed discussion was held and noted.',
          decisions: 'Committee agreed to proceed with the recommended action.',
          recommendations: 'Responsible departments to implement and report back.',
          order: i + 1,
        },
      });
    }

    // ── Upcoming meeting ──
    await prisma.committeeMeeting.create({
      data: {
        committeeId: committee.id, title: `${c.name} — Next Meeting`,
        scheduledDate: days(c.frequency === 'MONTHLY' ? 14 : 45), time: '11:00',
        venue: 'Committee Room', mode: 'HYBRID', status: 'SCHEDULED',
        agendaDeadline: days(c.frequency === 'MONTHLY' ? 9 : 40), createdById: admin.id,
      },
    });

    // ── Action items (varied statuses incl. overdue + closed) ──
    const code = () => `ACT-${String(++actionSeq).padStart(4, '0')}`;
    const responsible = (i: number) => memberUserIds[i % Math.max(memberUserIds.length, 1)] ?? null;
    const actionSpecs = [
      { description: 'Update SOP and circulate to all departments', status: 'IN_PROGRESS', priority: 'MEDIUM', due: 10, agenda: 0 },
      { description: 'Conduct staff training session', status: 'OPEN', priority: 'HIGH', due: -5, agenda: 1 },
      { description: 'Procure additional supplies', status: 'COMPLETED', priority: 'LOW', due: -10, agenda: 1 },
      { description: 'Audit compliance and submit report', status: 'CLOSED', priority: 'MEDIUM', due: -20, agenda: 2 },
    ];
    for (let i = 0; i < actionSpecs.length; i++) {
      const s = actionSpecs[i];
      const respId = responsible(i);
      const respUser = users.find((u) => u.id === respId);
      await prisma.actionItem.create({
        data: {
          actionCode: code(), description: s.description, committeeId: committee.id,
          meetingId: pastMeeting.id, agendaItemId: agendaItems[s.agenda]?.id ?? null,
          source: 'AGENDA', responsibleUserId: respId, department: respUser?.department ?? null,
          priority: s.priority as any, dueDate: days(s.due), status: s.status as any,
          closedById: s.status === 'CLOSED' ? admin.id : null,
          evidenceUrls: s.status === 'COMPLETED' || s.status === 'CLOSED' ? ['https://example.com/evidence.pdf'] : [],
        },
      });
    }

    console.log(`  ✓ ${c.name} — ${c.members.length} members, 2 meetings, ${agendaSpecs.length} agenda, ${actionSpecs.length} actions`);
  }
}

// ─── KPI / Outcome indicators (Quality & Patient Safety) ─────────────────────
// Pre-seeded reference indicators so Super Admin only has to review/tweak.
// Data file: prisma/seed/kpi-indicators.json

interface IndicatorSeed {
  framework: 'KPI' | 'OUTCOME';
  departmentCode: string | null;
  departmentName: string | null;
  type: string;
  name: string;
  numeratorLabel?: string | null;
  denominatorLabel?: string | null;
  formulaText?: string | null;
  formulaType: 'RATIO' | 'MEAN' | 'MEDIAN' | 'CUSTOM';
  multiplier?: number | null;
  customExpression?: string | null;
  formulaSpec?: unknown;   // structured formula (inputs / numerator / denominator / scale)
  unit?: string | null;
  frequency?: string | null;
  sourceOfData?: string | null;
  significance?: string | null;
}

async function seedIndicators() {
  console.log('\n📈 Seeding KPI / Outcome indicators (Quality & Patient Safety)…');
  const file = path.join(__dirname, 'kpi-indicators.json');
  if (!existsSync(file)) {
    console.warn('  ⚠ kpi-indicators.json not found — skipping indicator seed');
    return;
  }
  const rows: IndicatorSeed[] = JSON.parse(readFileSync(file, 'utf-8'));

  // Clean rebuild — these are pre-seeded reference templates, recreated each
  // seed to guarantee the structure matches.
  // (IndicatorEntry rows cascade-delete with their template.)
  await prisma.indicatorTemplate.deleteMany({});
  await prisma.indicatorType.deleteMany({});

  // 1. Types — one per (framework, departmentCode, name). OUTCOME repeats the
  //    types under each department; KPI uses departmentCode "".
  const typeIdByKey = new Map<string, string>();
  const orderInGroup = new Map<string, number>(); // group = framework::departmentCode
  for (const r of rows) {
    const deptCode = r.departmentCode ?? '';
    const key = `${r.framework}::${deptCode}::${r.type}`;
    if (typeIdByKey.has(key)) continue;
    const groupKey = `${r.framework}::${deptCode}`;
    const order = orderInGroup.get(groupKey) ?? 0;
    orderInGroup.set(groupKey, order + 1);
    const type = await prisma.indicatorType.create({
      data: {
        framework: r.framework as any,
        departmentCode: deptCode,
        departmentName: r.departmentName ?? null,
        name: r.type,
        order,
      },
    });
    typeIdByKey.set(key, type.id);
  }

  // 2. Templates — order within their type.
  const orderByType = new Map<string, number>();
  let tpCount = 0;
  for (const r of rows) {
    const deptCode = r.departmentCode ?? '';
    const typeId = typeIdByKey.get(`${r.framework}::${deptCode}::${r.type}`)!;
    const order = orderByType.get(typeId) ?? 0;
    orderByType.set(typeId, order + 1);

    await prisma.indicatorTemplate.create({
      data: {
        typeId,
        name: r.name,
        numeratorLabel: r.numeratorLabel ?? null,
        denominatorLabel: r.denominatorLabel ?? null,
        formulaType: (r.formulaType ?? 'RATIO') as any,
        multiplier: r.multiplier ?? 1,
        customExpression: r.customExpression ?? null,
        formula: r.formulaText ?? null,   // formula text shown in the UI
        formulaSpec: (r.formulaSpec ?? undefined) as any,   // dormant until Phase 2/3 read it
        unit: r.unit ?? null,
        frequency: r.frequency ?? 'Monthly',
        sourceOfData: r.sourceOfData ?? null,
        significance: r.significance ?? null,
        scope: (r.framework === 'OUTCOME' ? 'DEPARTMENT' : 'HOSPITAL') as any,
        departmentCode: r.departmentCode ?? null,
        departmentName: r.departmentName ?? null,
        order,
      },
    });
    tpCount++;
  }

  console.log(`  ✓ ${typeIdByKey.size} types, ${tpCount} indicator templates`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 NQAS Seed — Kidwai Memorial Institute of Oncology\n');

  // 1. Hospital settings
  console.log('⚙️  Hospital Settings:');
  await seedHospitalSettings();

  // 2. NQAS master data (from Excel)
  const xlsxPath = path.resolve(__dirname, '../../../../docs/DH-20_NQAS_Toolkit _28-June_2023.xlsx');
  console.log(`\n📊 Loading NQAS Excel: ${xlsxPath}`);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.readFile(xlsxPath);
    console.log(`   Sheets: ${workbook.SheetNames.join(', ')}\n`);
  } catch (err) {
    console.error('❌ Failed to load NQAS Excel:', err);
    process.exit(1);
  }

  console.log('📋 Seeding NQAS departments, areas, standards & MEs…');
  for (const dept of NQAS_DEPARTMENTS) {
    const ws = workbook.Sheets[dept.sheetName];
    await seedNqasDepartment(dept, ws);
  }

  // 3. Client departments
  await seedClientDepartments();

  // 4. Client sections & checkpoints (derived from NQAS ME structure)
  await seedClientSections();

  // 5. Role permissions
  await seedRolePermissions();

  // 6. Users
  await seedUsers();

  // 7. Committee master data + demo committees
  await seedCommitteePositionTypes();
  await seedDesignations();
  await seedUserDesignations();
  await seedEmailTemplates();
  await seedCommittees();

  // 8. KPI / Outcome indicators (Quality & Patient Safety)
  await seedIndicators();

  // 9. Summary
  const [depts, areas, stds, mes, scoredMes, clientDepts, sections, checkpoints, users, positionTypes, designations] = await Promise.all([
    prisma.department.count(),
    prisma.areaOfConcern.count(),
    prisma.standard.count(),
    prisma.measurableElement.count(),
    prisma.measurableElement.count({ where: { isScored: true } }),
    prisma.clientDepartment.count(),
    prisma.clientSection.count(),
    prisma.clientCheckpoint.count(),
    prisma.user.count(),
    prisma.committeePositionType.count(),
    prisma.designation.count(),
  ]);
  const [committeesCount, meetingsCount, actionsCount] = await Promise.all([
    prisma.committee.count(),
    prisma.committeeMeeting.count(),
    prisma.actionItem.count(),
  ]);
  const [indicatorTypesCount, indicatorTemplatesCount] = await Promise.all([
    prisma.indicatorType.count(),
    prisma.indicatorTemplate.count(),
  ]);

  console.log('\n✅ Seed complete!\n');
  console.log('📊 Summary:');
  console.log(`   NQAS Departments:     ${depts}`);
  console.log(`   Areas of Concern:     ${areas}`);
  console.log(`   Standards:            ${stds}`);
  console.log(`   Measurable Elements:  ${mes} (${scoredMes} scored)`);
  console.log(`   Client Departments:   ${clientDepts}`);
  console.log(`   Client Sections:      ${sections}`);
  console.log(`   Client Checkpoints:   ${checkpoints}`);
  console.log(`   Users:                ${users}`);
  console.log(`   Position Types:       ${positionTypes}`);
  console.log(`   Designations:         ${designations}`);
  console.log(`   Committees:           ${committeesCount}`);
  console.log(`   Committee Meetings:   ${meetingsCount}`);
  console.log(`   Action Items:         ${actionsCount}`);
  console.log(`   Indicator Types:      ${indicatorTypesCount}`);
  console.log(`   Indicator Templates:  ${indicatorTemplatesCount}`);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
