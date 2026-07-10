-- Add module field to all child models for direct filtering without joins

-- client_departments: tag departments by module (NQAS, NABH, KAYAKALPA)
ALTER TABLE "client_departments" ADD COLUMN "module" "AppModule" NOT NULL DEFAULT 'NQAS';

-- assessment_responses: inherit module from parent assessment
ALTER TABLE "assessment_responses" ADD COLUMN "module" "AppModule" NOT NULL DEFAULT 'NQAS';
CREATE INDEX "assessment_responses_module_idx" ON "assessment_responses"("module");

-- assessment_reviews: inherit module from parent assessment
ALTER TABLE "assessment_reviews" ADD COLUMN "module" "AppModule" NOT NULL DEFAULT 'NQAS';
CREATE INDEX "assessment_reviews_module_idx" ON "assessment_reviews"("module");

-- notifications: tag notifications by module
ALTER TABLE "notifications" ADD COLUMN "module" "AppModule" NOT NULL DEFAULT 'NQAS';
CREATE INDEX "notifications_module_idx" ON "notifications"("module");
CREATE INDEX "notifications_userId_module_idx" ON "notifications"("userId", "module");
