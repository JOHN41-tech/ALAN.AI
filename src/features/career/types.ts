export type CareerAnswers = {
  interests: string[];
  skills: string[];
  learningStyle: string;
  availableHours: number;
  targetDomain: string | null;
};

export type Opportunity = {
  id: string;
  title: string;
  company: string;
  kind: string;
  domain: string | null;
  location: string | null;
  work_mode: string | null;
  skills: string[];
  description: string;
  deadline: string | null;
  source_url: string | null;
  verification_status: "unverified" | "verified" | "rejected";
  saved?: boolean;
  published?: boolean;
};

export type RoadmapTask = {
  id: string;
  roadmap_id: string;
  title: string;
  phase: string;
  description: string;
  estimated_hours: number;
  done: boolean;
  notes: string;
  position: number;
};

export type Roadmap = {
  id: string;
  user_id: string;
  title: string;
  domain: string;
  summary: string;
  weekly_hours: number;
  status: "active" | "paused" | "completed";
  ai_generated: boolean;
  created_at: string;
  phase2_roadmap_tasks: RoadmapTask[];
};

export type CareerResource = {
  id: string;
  title: string;
  provider: string;
  domain: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  resource_type: string;
  url: string;
  skills: string[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type AssessmentQuestion = {
  assessment_id: string;
  assessment_slug: string;
  assessment_title: string;
  topic: string;
  instructions: string;
  question_id: string;
  position: number;
  prompt: string;
  options: string[];
};

export type RoadmapDraft = {
  title: string;
  summary: string;
  tasks: Array<{
    title: string;
    phase: string;
    description: string;
    estimatedHours: number;
  }>;
};
