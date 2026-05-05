-- AlterTable
ALTER TABLE "User" ADD COLUMN     "data_quality_status" TEXT NOT NULL DEFAULT 'clean',
ADD COLUMN     "is_seed_user" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone_primary" TEXT,
ADD COLUMN     "phone_secondary" TEXT;

-- CreateIndex
CREATE INDEX "User_is_seed_user_idx" ON "User"("is_seed_user");

-- CreateIndex
CREATE INDEX "User_data_quality_status_idx" ON "User"("data_quality_status");
