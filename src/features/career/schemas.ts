import { z } from "zod";

export const careerProfileInputSchema = z.object({
  interests: z.array(z.string().trim().min(1).max(80)).max(12),
  skills: z.array(z.string().trim().min(1).max(80)).max(24),
  learningStyle: z.enum(["project", "reading", "video", "practice", "mixed"]),
  availableHours: z.coerce.number().int().min(1).max(40),
  targetDomain: z.string().trim().max(100).nullable(),
});

export const roadmapDraftSchema = z.object({
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(20).max(3000),
  tasks: z.array(z.object({
    title: z.string().trim().min(2).max(180),
    phase: z.string().trim().min(2).max(80),
    description: z.string().trim().min(10).max(2000),
    estimatedHours: z.number().int().min(1).max(100),
  })).min(4).max(10),
});

export const opportunityInputSchema = z.object({
  title: z.string().trim().min(3).max(180),
  company: z.string().trim().min(1).max(160),
  kind: z.enum(["Internship", "Full-time", "Part-time", "Contract", "Apprenticeship", "Scholarship"]),
  domain: z.string().trim().max(100).nullable(),
  location: z.string().trim().max(180).nullable(),
  workMode: z.enum(["Remote", "Hybrid", "Onsite"]).nullable(),
  skills: z.array(z.string().trim().min(1).max(50)).max(20),
  description: z.string().trim().min(10).max(6000),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  sourceUrl: z.string().url().refine((value) => value.startsWith("https://"), "Use an HTTPS source URL."),
  verificationStatus: z.enum(["unverified", "verified", "rejected"]),
  published: z.boolean(),
});

export const chatInputSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  topic: z.enum(["study", "career", "general"]).default("general"),
  sharePreferences: z.boolean().default(false),
});

export const interviewStartSchema = z.object({ role: z.string().trim().min(2).max(100) });
export const interviewAnswerSchema = z.object({ answer: z.string().trim().min(1).max(3000) });
