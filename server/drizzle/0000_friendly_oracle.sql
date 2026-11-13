CREATE TYPE "public"."role" AS ENUM('pending', 'user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."skin_model" AS ENUM('classic', 'slim');--> statement-breakpoint
CREATE TABLE "tokens" (
	"access_token" varchar(64) PRIMARY KEY NOT NULL,
	"client_token" varchar(128) NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(16) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'pending' NOT NULL,
	"skin_hash" varchar(64),
	"skin_model" "skin_model" DEFAULT 'classic' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tokens_user_id_idx" ON "tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_name_lower_idx" ON "users" USING btree (lower("name"));