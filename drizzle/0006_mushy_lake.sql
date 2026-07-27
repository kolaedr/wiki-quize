CREATE TABLE "game_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"game_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"best_score" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"first_cleared_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "level" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "stars" integer;--> statement-breakpoint
ALTER TABLE "game_progress" ADD CONSTRAINT "game_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_progress" ADD CONSTRAINT "game_progress_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_progress_user_game_level_uq" ON "game_progress" USING btree ("user_id","game_id","level");--> statement-breakpoint
CREATE INDEX "game_progress_user_idx" ON "game_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "game_progress_game_idx" ON "game_progress" USING btree ("game_id");