CREATE TYPE "public"."loader" AS ENUM('vanilla', 'fabric', 'forge', 'neoforge');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('day', 'dusk', 'night', 'dawn', 'snow', 'desert', 'nether', 'end');--> statement-breakpoint
CREATE TABLE "pack_versions" (
	"pack_id" varchar(32) NOT NULL,
	"version" varchar(32) NOT NULL,
	"manifest" jsonb NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"published_by" uuid,
	CONSTRAINT "pack_versions_pack_id_version_pk" PRIMARY KEY("pack_id","version")
);
--> statement-breakpoint
CREATE TABLE "packs" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"theme" "theme" NOT NULL,
	"minecraft" varchar(16) NOT NULL,
	"loader_type" "loader" NOT NULL,
	"loader_version" varchar(64),
	"java" integer NOT NULL,
	"server" varchar(128),
	"game_server" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pack_versions" ADD CONSTRAINT "pack_versions_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_versions" ADD CONSTRAINT "pack_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;