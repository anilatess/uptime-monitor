import { z } from "zod";

const baseMonitorSchema = z.object({
  name: z.string().min(1, "İsim boş olamaz").max(100),
  url: z.url("Geçerli bir URL gir"),
  intervalMinutes: z.number().int().min(1).max(60),
});

export const createMonitorSchema = baseMonitorSchema.extend({
  intervalMinutes: baseMonitorSchema.shape.intervalMinutes.default(5),
});

export const updateMonitorSchema = baseMonitorSchema.partial();

export const authSchema = z.object({
  email: z.email("Geçerli bir e-posta gir"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı").max(100),
});