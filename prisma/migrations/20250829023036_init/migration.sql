-- CreateTable
CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "minAgeMonths" INTEGER,
    "maxAgeMonths" INTEGER,
    "durationMin" INTEGER,
    "openHoursJson" JSONB,
    "weatherFlags" TEXT[],
    "costTier" INTEGER,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" SERIAL NOT NULL,
    "activityId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER,
    "rating" INTEGER,
    "notes" TEXT,
    "who" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryPref" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryPref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_lat_lng_idx" ON "Activity"("lat", "lng");

-- CreateIndex
CREATE INDEX "ActivityLog_startedAt_idx" ON "ActivityLog"("startedAt");

-- CreateIndex
CREATE INDEX "ActivityLog_activityId_startedAt_idx" ON "ActivityLog"("activityId", "startedAt");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
