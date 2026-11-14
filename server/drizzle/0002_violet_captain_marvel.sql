CREATE TYPE "public"."skin_source" AS ENUM('mineskin', 'mojang', 'upload');--> statement-breakpoint
CREATE TABLE "skins" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"hash" varchar(64) NOT NULL,
	"model" "skin_model" NOT NULL,
	"source" "skin_source" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skins" ADD CONSTRAINT "skins_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "skins_hash_model_idx" ON "skins" USING btree ("hash","model");