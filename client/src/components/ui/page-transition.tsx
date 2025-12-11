import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const fadeVariants = {
  initial: { opacity: 0 },
  enter: {
    opacity: 1,
    transition: { duration: 0.25, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

const slideUpVariants = {
  initial: { opacity: 0, y: 30 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    y: -15,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

const scaleVariants = {
  initial: { opacity: 0, scale: 0.96 },
  enter: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

export function PageTransition({ children, className }: PageTransitionProps) {
  const [location] = useLocation();
  const prefersReducedMotion = typeof window !== "undefined" 
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return <div className={className} data-testid="page-transition-static">{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={pageVariants}
        className={className}
        data-testid="page-transition-animated"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function FadeTransition({ children, className }: PageTransitionProps) {
  const prefersReducedMotion = typeof window !== "undefined" 
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return <div className={className} data-testid="fade-transition-static">{children}</div>;
  }

  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={fadeVariants}
      className={className}
      data-testid="fade-transition-animated"
    >
      {children}
    </motion.div>
  );
}

export function SlideUpTransition({ children, className }: PageTransitionProps) {
  const prefersReducedMotion = typeof window !== "undefined" 
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return <div className={className} data-testid="slideup-transition-static">{children}</div>;
  }

  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={slideUpVariants}
      className={className}
      data-testid="slideup-transition-animated"
    >
      {children}
    </motion.div>
  );
}

export function ScaleTransition({ children, className }: PageTransitionProps) {
  const prefersReducedMotion = typeof window !== "undefined" 
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return <div className={className} data-testid="scale-transition-static">{children}</div>;
  }

  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={scaleVariants}
      className={className}
      data-testid="scale-transition-animated"
    >
      {children}
    </motion.div>
  );
}

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function StaggerContainer({ children, className, delay = 0.1 }: StaggerContainerProps) {
  const prefersReducedMotion = typeof window !== "undefined" 
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return <div className={className} data-testid="stagger-container-static">{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: delay,
          },
        },
      }}
      data-testid="stagger-container-animated"
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  const prefersReducedMotion = typeof window !== "undefined" 
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return <div className={className} data-testid="stagger-item-static">{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
        },
      }}
      data-testid="stagger-item-animated"
    >
      {children}
    </motion.div>
  );
}

interface AnimatedSkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function AnimatedSkeleton({ className, width, height }: AnimatedSkeletonProps) {
  const prefersReducedMotion = typeof window !== "undefined" 
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const baseClass = "bg-muted rounded-md";
  const style = { width, height };

  if (prefersReducedMotion) {
    return <div className={`${baseClass} ${className || ""}`} style={style} data-testid="skeleton-static" />;
  }

  return (
    <motion.div
      className={`${baseClass} ${className || ""}`}
      style={style}
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      data-testid="skeleton-animated"
    />
  );
}
