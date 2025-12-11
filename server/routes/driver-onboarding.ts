import { Router, Request, Response } from "express";
import { db as prisma } from "../db";

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

const router = Router();

const ONBOARDING_STEPS = [
  { id: "welcome", name: "Welcome", order: 1 },
  { id: "earnings", name: "How Earnings Work", order: 2 },
  { id: "payouts", name: "Getting Paid", order: 3 },
  { id: "safety", name: "Safety Guidelines", order: 4 },
  { id: "helpCenter", name: "Help Center", order: 5 },
  { id: "completion", name: "You're Ready!", order: 6 },
] as const;

const TUTORIALS = [
  {
    id: "accepting-rides",
    title: "Accepting Your First Ride",
    description: "Learn how to accept and complete ride requests efficiently",
    duration: "3 min",
    category: "rides",
    thumbnailUrl: null,
    videoUrl: null,
  },
  {
    id: "navigation-tips",
    title: "Navigation Best Practices",
    description: "Master navigation to get riders to their destination quickly",
    duration: "4 min",
    category: "rides",
    thumbnailUrl: null,
    videoUrl: null,
  },
  {
    id: "food-delivery",
    title: "Food Delivery Basics",
    description: "How to handle food orders and ensure quality delivery",
    duration: "5 min",
    category: "food",
    thumbnailUrl: null,
    videoUrl: null,
  },
  {
    id: "customer-service",
    title: "Providing Great Service",
    description: "Tips for excellent customer service and high ratings",
    duration: "4 min",
    category: "general",
    thumbnailUrl: null,
    videoUrl: null,
  },
  {
    id: "earnings-maximization",
    title: "Maximizing Your Earnings",
    description: "Strategies to earn more during peak hours and promotions",
    duration: "6 min",
    category: "earnings",
    thumbnailUrl: null,
    videoUrl: null,
  },
  {
    id: "safety-protocols",
    title: "Safety Protocols",
    description: "Essential safety guidelines for you and your passengers",
    duration: "5 min",
    category: "safety",
    thumbnailUrl: null,
    videoUrl: null,
  },
  {
    id: "app-features",
    title: "App Features Overview",
    description: "Discover all the features in the SafeGo driver app",
    duration: "4 min",
    category: "general",
    thumbnailUrl: null,
    videoUrl: null,
  },
  {
    id: "vehicle-maintenance",
    title: "Vehicle Maintenance Tips",
    description: "Keep your vehicle in top condition for driving",
    duration: "3 min",
    category: "general",
    thumbnailUrl: null,
    videoUrl: null,
  },
];

function calculateCompletionPercentage(onboarding: any): number {
  const steps = [
    onboarding.welcomeCompleted,
    onboarding.earningsCompleted,
    onboarding.payoutsCompleted,
    onboarding.safetyCompleted,
    onboarding.helpCenterCompleted,
    onboarding.completionCompleted,
  ];
  const completedCount = steps.filter(Boolean).length;
  return Math.round((completedCount / steps.length) * 100);
}

async function getOrCreateOnboarding(driverId: string) {
  let onboarding = await prisma.driverOnboarding.findUnique({
    where: { driverId },
  });

  if (!onboarding) {
    onboarding = await prisma.driverOnboarding.create({
      data: { driverId },
    });
  }

  return onboarding;
}

/**
 * GET /api/driver/onboarding/status
 * Get current onboarding progress
 */
router.get("/onboarding/status", async (req: AuthRequest, res: Response) => {
  try {
    const driver = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const onboarding = await getOrCreateOnboarding(driver.id);
    const completionPercentage = calculateCompletionPercentage(onboarding);

    const stepsWithStatus = ONBOARDING_STEPS.map((step) => {
      const completedKey = `${step.id}Completed` as keyof typeof onboarding;
      const completedAtKey = `${step.id}CompletedAt` as keyof typeof onboarding;
      return {
        ...step,
        completed: Boolean(onboarding[completedKey]),
        completedAt: onboarding[completedAtKey] || null,
      };
    });

    const nextStep = stepsWithStatus.find((s) => !s.completed);

    res.json({
      isOnboardingComplete: onboarding.isOnboardingComplete,
      completionPercentage,
      steps: stepsWithStatus,
      currentStep: nextStep?.id || "completion",
      lastStepViewed: onboarding.lastStepViewed,
      tutorialsViewed: onboarding.tutorialsViewed,
      startedAt: onboarding.startedAt.toISOString(),
      completedAt: onboarding.completedAt?.toISOString() || null,
    });
  } catch (error: any) {
    console.error("Get onboarding status error:", error);
    res.status(500).json({ error: error.message || "Failed to get onboarding status" });
  }
});

/**
 * POST /api/driver/onboarding/complete-step
 * Mark an onboarding step as completed
 */
router.post("/onboarding/complete-step", async (req: AuthRequest, res: Response) => {
  try {
    const { stepId } = req.body;

    if (!stepId || !ONBOARDING_STEPS.some((s) => s.id === stepId)) {
      return res.status(400).json({ error: "Invalid step ID" });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const onboarding = await getOrCreateOnboarding(driver.id);
    const completedKey = `${stepId}Completed`;
    const completedAtKey = `${stepId}CompletedAt`;

    const updateData: any = {
      [completedKey]: true,
      [completedAtKey]: new Date(),
      lastStepViewed: stepId,
    };

    const updatedOnboarding = await prisma.driverOnboarding.update({
      where: { driverId: driver.id },
      data: updateData,
    });

    const completionPercentage = calculateCompletionPercentage(updatedOnboarding);
    const isComplete = completionPercentage === 100;

    if (isComplete && !updatedOnboarding.isOnboardingComplete) {
      await prisma.driverOnboarding.update({
        where: { driverId: driver.id },
        data: {
          isOnboardingComplete: true,
          completionPercentage: 100,
          completedAt: new Date(),
        },
      });
    } else {
      await prisma.driverOnboarding.update({
        where: { driverId: driver.id },
        data: { completionPercentage },
      });
    }

    const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === stepId);
    const nextStep = ONBOARDING_STEPS[stepIndex + 1] || null;

    res.json({
      success: true,
      stepCompleted: stepId,
      completionPercentage: isComplete ? 100 : completionPercentage,
      isOnboardingComplete: isComplete,
      nextStep: nextStep?.id || null,
    });
  } catch (error: any) {
    console.error("Complete onboarding step error:", error);
    res.status(500).json({ error: error.message || "Failed to complete step" });
  }
});

/**
 * POST /api/driver/onboarding/skip
 * Skip onboarding (mark as viewed but not complete)
 */
router.post("/onboarding/skip", async (req: AuthRequest, res: Response) => {
  try {
    const driver = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    await getOrCreateOnboarding(driver.id);

    await prisma.driverOnboarding.update({
      where: { driverId: driver.id },
      data: {
        welcomeCompleted: true,
        welcomeCompletedAt: new Date(),
        earningsCompleted: true,
        earningsCompletedAt: new Date(),
        payoutsCompleted: true,
        payoutsCompletedAt: new Date(),
        safetyCompleted: true,
        safetyCompletedAt: new Date(),
        helpCenterCompleted: true,
        helpCenterCompletedAt: new Date(),
        completionCompleted: true,
        completionCompletedAt: new Date(),
        isOnboardingComplete: true,
        completionPercentage: 100,
        completedAt: new Date(),
        lastStepViewed: "completion",
      },
    });

    res.json({
      success: true,
      message: "Onboarding skipped",
      isOnboardingComplete: true,
    });
  } catch (error: any) {
    console.error("Skip onboarding error:", error);
    res.status(500).json({ error: error.message || "Failed to skip onboarding" });
  }
});

/**
 * POST /api/driver/onboarding/reset
 * Reset onboarding progress (for testing or re-doing onboarding)
 */
router.post("/onboarding/reset", async (req: AuthRequest, res: Response) => {
  try {
    const driver = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    await prisma.driverOnboarding.upsert({
      where: { driverId: driver.id },
      create: { driverId: driver.id },
      update: {
        welcomeCompleted: false,
        welcomeCompletedAt: null,
        earningsCompleted: false,
        earningsCompletedAt: null,
        payoutsCompleted: false,
        payoutsCompletedAt: null,
        safetyCompleted: false,
        safetyCompletedAt: null,
        helpCenterCompleted: false,
        helpCenterCompletedAt: null,
        completionCompleted: false,
        completionCompletedAt: null,
        isOnboardingComplete: false,
        completionPercentage: 0,
        completedAt: null,
        lastStepViewed: null,
        tutorialsViewed: [],
        startedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: "Onboarding reset",
      isOnboardingComplete: false,
      completionPercentage: 0,
    });
  } catch (error: any) {
    console.error("Reset onboarding error:", error);
    res.status(500).json({ error: error.message || "Failed to reset onboarding" });
  }
});

/**
 * GET /api/driver/tutorials
 * Get available tutorials
 */
router.get("/tutorials", async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.query;

    const driver = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const onboarding = await getOrCreateOnboarding(driver.id);

    let filteredTutorials = TUTORIALS;
    if (category && category !== "all") {
      filteredTutorials = TUTORIALS.filter((t) => t.category === category);
    }

    const tutorialsWithProgress = filteredTutorials.map((tutorial) => ({
      ...tutorial,
      viewed: onboarding.tutorialsViewed.includes(tutorial.id),
    }));

    const categories = Array.from(new Set(TUTORIALS.map((t) => t.category)));

    res.json({
      tutorials: tutorialsWithProgress,
      categories,
      totalViewed: onboarding.tutorialsViewed.length,
      totalTutorials: TUTORIALS.length,
    });
  } catch (error: any) {
    console.error("Get tutorials error:", error);
    res.status(500).json({ error: error.message || "Failed to get tutorials" });
  }
});

/**
 * POST /api/driver/tutorials/:id/view
 * Mark a tutorial as viewed
 */
router.post("/tutorials/:id/view", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tutorial = TUTORIALS.find((t) => t.id === id);
    if (!tutorial) {
      return res.status(404).json({ error: "Tutorial not found" });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const onboarding = await getOrCreateOnboarding(driver.id);

    if (!onboarding.tutorialsViewed.includes(id)) {
      await prisma.driverOnboarding.update({
        where: { driverId: driver.id },
        data: {
          tutorialsViewed: [...onboarding.tutorialsViewed, id],
        },
      });
    }

    res.json({
      success: true,
      tutorialId: id,
      message: "Tutorial marked as viewed",
    });
  } catch (error: any) {
    console.error("Mark tutorial viewed error:", error);
    res.status(500).json({ error: error.message || "Failed to mark tutorial as viewed" });
  }
});

/**
 * GET /api/driver/onboarding/steps
 * Get onboarding step definitions
 */
router.get("/onboarding/steps", async (_req: AuthRequest, res: Response) => {
  res.json({
    steps: ONBOARDING_STEPS,
    totalSteps: ONBOARDING_STEPS.length,
  });
});

export default router;
