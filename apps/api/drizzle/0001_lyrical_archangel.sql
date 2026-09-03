CREATE TABLE IF NOT EXISTS "blindspot_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"therapist_id" uuid,
	"status" text DEFAULT 'evaluando' NOT NULL,
	"initial_assessment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"admin_private_notes" text,
	"crisis_flag" boolean DEFAULT false NOT NULL,
	"crisis_flagged_at" timestamp with time zone,
	"crisis_flagged_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blindspot_session_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"progress_marker" text NOT NULL,
	"internal_summary" text,
	"client_note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blindspot_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"created_by" uuid NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "therapists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"specialty" text,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "therapists_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blindspot_cases" ADD CONSTRAINT "blindspot_cases_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blindspot_cases" ADD CONSTRAINT "blindspot_cases_therapist_id_therapists_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."therapists"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blindspot_session_logs" ADD CONSTRAINT "blindspot_session_logs_case_id_blindspot_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."blindspot_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blindspot_session_logs" ADD CONSTRAINT "blindspot_session_logs_created_by_therapists_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."therapists"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blindspot_tasks" ADD CONSTRAINT "blindspot_tasks_case_id_blindspot_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."blindspot_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blindspot_tasks" ADD CONSTRAINT "blindspot_tasks_created_by_therapists_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."therapists"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
