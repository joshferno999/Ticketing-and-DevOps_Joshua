/**
 * BuildTrack seed data
 * Run with: npx ts-node prisma/seed-buildtrack.ts
 *
 * Seeds:
 * - 3 seed users (Joshua, Rishabh, Hari) with BtUserProfile roles
 * - Full module hierarchy (DCC, SCT, Hiring Tool)
 * - Default admin config (SLA thresholds, stale ticket policy)
 * - Seed themes
 */

import { PrismaClient, BtRole, BtModuleLevel } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding BuildTrack data...");

  // ── 1. Seed users ──────────────────────────────────────────────────────────
  // These AppUsers must exist first (created via normal auth flow or manual insert).
  // We upsert BtUserProfile only — AppUser emails are placeholders for Hari to update.

  const seedUsers: { email: string; displayName: string; role: BtRole; placeholderEmail?: boolean }[] = [
    { email: "joshua@emsoft.com",          displayName: "Joshua Fernando", role: BtRole.admin },
    { email: "PLACEHOLDER_rishabh@emsoft.com", displayName: "Rishabh",    role: BtRole.pm,          placeholderEmail: true },
    { email: "PLACEHOLDER_hari@emsoft.com",    displayName: "Hari",        role: BtRole.sr_engineer,  placeholderEmail: true },
  ];

  for (const u of seedUsers) {
    // Upsert AppUser (create if missing, skip if exists)
    const appUser = await prisma.appUser.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash: "PLACEHOLDER_CHANGE_ME",
        displayName: u.displayName,
      },
    });

    // Upsert BtUserProfile
    await prisma.btUserProfile.upsert({
      where: { appUserId: appUser.id },
      update: { role: u.role },
      create: {
        appUserId: appUser.id,
        role: u.role,
        isActive: true,
      },
    });

    console.log(`  ✓ User: ${u.displayName} (${u.role})${u.placeholderEmail ? " — UPDATE EMAIL" : ""}`);
  }

  // ── 2. Module hierarchy ────────────────────────────────────────────────────
  type ModuleSeed = {
    name: string;
    level: BtModuleLevel;
    sortOrder: number;
    children?: ModuleSeed[];
  };

  const moduleTree: ModuleSeed[] = [
    {
      name: "Deal Command Center (DCC)", level: BtModuleLevel.product, sortOrder: 1,
      children: [
        { name: "DCC Dashboard",    level: BtModuleLevel.module, sortOrder: 1 },
        { name: "DCC Pipeline",     level: BtModuleLevel.module, sortOrder: 2 },
        {
          name: "DCC Deal Details", level: BtModuleLevel.module, sortOrder: 3,
          children: [
            { name: "Overview",         level: BtModuleLevel.submodule, sortOrder: 1 },
            { name: "Financials",       level: BtModuleLevel.submodule, sortOrder: 2 },
            { name: "Diligence Tasks",  level: BtModuleLevel.submodule, sortOrder: 3 },
            { name: "Collaboration",    level: BtModuleLevel.submodule, sortOrder: 4 },
            { name: "Documentation",    level: BtModuleLevel.submodule, sortOrder: 5 },
          ],
        },
      ],
    },
    {
      name: "Sourcing Control Tower (SCT)", level: BtModuleLevel.product, sortOrder: 2,
      children: [
        { name: "SCT Dashboard",                 level: BtModuleLevel.module, sortOrder: 1 },
        { name: "Sourcing Lead Pipeline",         level: BtModuleLevel.module, sortOrder: 2 },
        { name: "Sequence Management",            level: BtModuleLevel.module, sortOrder: 3 },
        { name: "Email Deliverability Dashboard", level: BtModuleLevel.module, sortOrder: 4 },
        { name: "Reply Dashboard",                level: BtModuleLevel.module, sortOrder: 5 },
      ],
    },
    {
      name: "Hiring Tool", level: BtModuleLevel.product, sortOrder: 3,
      children: [
        { name: "Ops Tool",              level: BtModuleLevel.module, sortOrder: 1 },
        { name: "Screening & Feedback",  level: BtModuleLevel.module, sortOrder: 2 },
      ],
    },
  ];

  async function upsertModule(m: ModuleSeed, parentId?: string): Promise<void> {
    const existing = await prisma.btModule.findFirst({
      where: { name: m.name, level: m.level },
    });

    const mod = existing
      ? existing
      : await prisma.btModule.create({
          data: {
            name: m.name,
            level: m.level,
            sortOrder: m.sortOrder,
            parentId: parentId ?? null,
          },
        });

    console.log(`  ✓ Module: ${"  ".repeat(["product","module","submodule"].indexOf(m.level))}${m.name}`);

    for (const child of m.children ?? []) {
      await upsertModule(child, mod.id);
    }
  }

  for (const root of moduleTree) {
    await upsertModule(root);
  }

  // ── 3. Default themes ──────────────────────────────────────────────────────
  const themes = [
    "Data Quality",
    "UX & Navigation",
    "Performance",
    "Integration",
    "Reporting",
    "Automation",
    "Security",
    "Onboarding",
  ];

  for (const name of themes) {
    await prisma.btTheme.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`  ✓ Themes: ${themes.join(", ")}`);

  // ── 4. Default admin config ────────────────────────────────────────────────
  // We need a system user to set as updatedById — use Joshua's BtUserProfile
  const joshuaApp = await prisma.appUser.findUnique({ where: { email: "joshua@emsoft.com" } });
  const joshuaBt  = joshuaApp
    ? await prisma.btUserProfile.findUnique({ where: { appUserId: joshuaApp.id } })
    : null;

  if (joshuaBt) {
    const configs: { key: string; value: object }[] = [
      {
        key: "sla_thresholds",
        value: {
          p0: { triage_hours: 4,    resolution_hours: 24  },
          p1: { triage_hours: 24,   resolution_hours: 72  },
          p2: { triage_hours: 72,   resolution_hours: 336 }, // 2 weeks
          p3: { triage_hours: 168,  resolution_hours: null },
        },
      },
      {
        key: "sla_breach_actions",
        value: {
          p0: "slack_immediate",
          p1: "slack_immediate",
          p2: "daily_digest_flag",
          p3: "weekly_digest_flag",
        },
      },
      {
        key: "stale_ticket_policy",
        value: {
          status: "next_phase",
          threshold_days: 60,
          notification_channel: "product_requests",
          notify_full_team: true,
          cron: "0 8 * * *", // 8am daily
        },
      },
      {
        key: "slack_channels",
        value: {
          product_requests: "PLACEHOLDER_CHANNEL_ID", // Hari creates & adds
        },
      },
    ];

    for (const { key, value } of configs) {
      await prisma.btAdminConfig.upsert({
        where: { key },
        update: { value, updatedById: joshuaBt.id },
        create: { key, value, updatedById: joshuaBt.id },
      });
    }
    console.log(`  ✓ Admin config: ${configs.map(c => c.key).join(", ")}`);
  }

  console.log("\n✅ BuildTrack seed complete.");
  console.log("⚠️  Update placeholder emails and Slack channel IDs before going live.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
