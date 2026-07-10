// db/referralSchema.ts
// Definiciones Drizzle del Programa de Recompensas (Fase 1): referidos + bug + ugc.
//
// INTERINO: tablas creadas por supabase/migrations/20260710_referral_program.sql
// + 20260710_rewards_generalize.sql. Cuando se regenere db/schema.ts con
// `npx drizzle-kit introspect`, consolidar allí y BORRAR este fichero (evita duplicados).
//
// Diseño: docs/roadmap/programa-referidos-embajadores.md (Anexo A).

import { pgTable, uuid, text, boolean, numeric, jsonb, timestamp, index, check, foreignKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { userProfiles } from "./schema"

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' })

// 1) referral_codes — un código por embajador (Fase 1: solo premium).
export const referralCodes = pgTable("referral_codes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerUserId: uuid("owner_user_id").notNull().unique(),
	code: text().notNull().unique(),
	tier: text().default('premium').notNull(),
	active: boolean().default(true).notNull(),
	createdAt: ts("created_at").defaultNow().notNull(),
}, (table) => [
	foreignKey({ columns: [table.ownerUserId], foreignColumns: [userProfiles.id], name: "referral_codes_owner_fk" }).onDelete("cascade"),
])

// 2) reward_payouts — payout en gift card compartido por los 3 tipos (reason: referral|bug|ugc).
//    Definida ANTES que las tablas que la referencian por FK (referrals, reward_submissions).
//    NOTA: los índices en BD conservan el nombre antiguo `idx_referral_payouts_*` (el rename de
//    tabla no renombra índices) — reflejado aquí tal cual.
export const rewardPayouts = pgTable("reward_payouts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	beneficiaryUserId: uuid("beneficiary_user_id").notNull(),
	reason: text().default('referral').notNull(),
	sourceId: uuid("source_id"),
	amount: numeric({ precision: 10, scale: 2 }).notNull(),
	method: text().default('amazon_giftcard').notNull(),
	purchasedVia: text("purchased_via"),
	giftcardRef: text("giftcard_ref"),
	status: text().default('pending').notNull(),
	approvedBy: uuid("approved_by"),
	paidAt: ts("paid_at"),
	createdAt: ts("created_at").defaultNow().notNull(),
}, (table) => [
	index("idx_referral_payouts_referrer").on(table.beneficiaryUserId),
	index("idx_referral_payouts_status").on(table.status),
	foreignKey({ columns: [table.beneficiaryUserId], foreignColumns: [userProfiles.id], name: "referral_payouts_referrer_fk" }).onDelete("cascade"),
	foreignKey({ columns: [table.approvedBy], foreignColumns: [userProfiles.id], name: "referral_payouts_approved_by_fk" }),
	check("reward_payouts_reason_chk", sql`${table.reason} IN ('referral','bug','ugc','accumulated')`),
	check("referral_payouts_status_check", sql`${table.status} IN ('pending','paid','void')`),
])

// 3) referrals — una fila por usuario referido (first-touch: referred_user_id unique).
export const referrals = pgTable("referrals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	referrerUserId: uuid("referrer_user_id").notNull(),
	referredUserId: uuid("referred_user_id").unique(),
	code: text().notNull(),
	status: text().default('pending').notNull(),
	attributedAt: ts("attributed_at").defaultNow().notNull(),
	qualifiedAt: ts("qualified_at"),
	planType: text("plan_type"),
	qualifyingPaymentRef: text("qualifying_payment_ref"),
	holdUntil: ts("hold_until"),
	bountyAmount: numeric("bounty_amount", { precision: 10, scale: 2 }).default('10').notNull(),
	discountApplied: boolean("discount_applied").default(false).notNull(),
	payoutId: uuid("payout_id"),
	fraudFlags: jsonb("fraud_flags").default([]).notNull(),
	notes: text(),
	createdAt: ts("created_at").defaultNow().notNull(),
	updatedAt: ts("updated_at").defaultNow().notNull(),
}, (table) => [
	index("idx_referrals_referrer").on(table.referrerUserId),
	index("idx_referrals_status").on(table.status),
	index("idx_referrals_hold").on(table.status, table.holdUntil),
	foreignKey({ columns: [table.referrerUserId], foreignColumns: [userProfiles.id], name: "referrals_referrer_fk" }).onDelete("cascade"),
	foreignKey({ columns: [table.referredUserId], foreignColumns: [userProfiles.id], name: "referrals_referred_fk" }).onDelete("cascade"),
	foreignKey({ columns: [table.payoutId], foreignColumns: [rewardPayouts.id], name: "referrals_payout_fk" }).onDelete("set null"),
	check("referrals_status_chk", sql`${table.status} IN ('pending','qualified','payable','paid','rejected','expired')`),
	check("referrals_no_self", sql`${table.referredUserId} IS NULL OR ${table.referredUserId} <> ${table.referrerUserId}`),
])

// 4) reward_submissions — envíos de bug/UX (3 €) y UGC/opinión (5 €). El referido va en `referrals`.
export const rewardSubmissions = pgTable("reward_submissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: text().notNull(),
	status: text().default('pending').notNull(),
	url: text(),
	screenshotUrl: text("screenshot_url"),
	feedbackId: uuid("feedback_id"),
	amount: numeric({ precision: 10, scale: 2 }).notNull(),
	holdUntil: ts("hold_until"),
	payoutId: uuid("payout_id"),
	approvedBy: uuid("approved_by"),
	notes: text(),
	createdAt: ts("created_at").defaultNow().notNull(),
	updatedAt: ts("updated_at").defaultNow().notNull(),
}, (table) => [
	index("idx_reward_submissions_user").on(table.userId),
	index("idx_reward_submissions_status").on(table.type, table.status),
	foreignKey({ columns: [table.userId], foreignColumns: [userProfiles.id], name: "reward_submissions_user_fk" }).onDelete("cascade"),
	foreignKey({ columns: [table.payoutId], foreignColumns: [rewardPayouts.id], name: "reward_submissions_payout_fk" }).onDelete("set null"),
	foreignKey({ columns: [table.approvedBy], foreignColumns: [userProfiles.id], name: "reward_submissions_approved_by_fk" }),
	check("reward_submissions_type_check", sql`${table.type} IN ('bug','ugc')`),
	check("reward_submissions_status_check", sql`${table.status} IN ('pending','approved','rejected','paid')`),
])
