CREATE TYPE "public"."feedback_kind" AS ENUM('topic_request', 'idea', 'bug', 'other');--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "feedback_kind" DEFAULT 'topic_request' NOT NULL,
	"message" text NOT NULL,
	"contact" text,
	"user_id" text,
	"handled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_handled_idx" ON "feedback" USING btree ("handled");