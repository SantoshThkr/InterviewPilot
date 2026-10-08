-- Structured, explainable evaluation.
-- Dimensions that an interview type does not assess (e.g. technical depth in
-- an HR screen) are stored as NULL instead of a fabricated score. Additive and
-- backward compatible: existing rows keep their values.

-- AlterTable
ALTER TABLE "InterviewReport" ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "questionFeedback" JSONB,
ALTER COLUMN "communicationScore" DROP NOT NULL,
ALTER COLUMN "technicalScore" DROP NOT NULL,
ALTER COLUMN "confidenceScore" DROP NOT NULL,
ALTER COLUMN "problemSolvingScore" DROP NOT NULL;
