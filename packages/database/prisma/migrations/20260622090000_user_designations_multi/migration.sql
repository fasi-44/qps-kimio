-- Users may now hold multiple titles/designations.
-- Replace the single `users.designationId` FK with an implicit many-to-many
-- relation (join table `_UserDesignations`), preserving existing links.

-- CreateTable
CREATE TABLE "_UserDesignations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserDesignations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_UserDesignations_B_index" ON "_UserDesignations"("B");

-- AddForeignKey
ALTER TABLE "_UserDesignations" ADD CONSTRAINT "_UserDesignations_A_fkey" FOREIGN KEY ("A") REFERENCES "designations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserDesignations" ADD CONSTRAINT "_UserDesignations_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing single-title links before dropping the column
INSERT INTO "_UserDesignations" ("A", "B")
SELECT "designationId", "id" FROM "users" WHERE "designationId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_designationId_fkey";

-- DropIndex
DROP INDEX "users_designationId_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "designationId";
