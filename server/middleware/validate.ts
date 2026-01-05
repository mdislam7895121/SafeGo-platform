import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

interface ValidationErrorResponse {
  error: {
    code: "VALIDATION_ERROR";
    message: string;
    issues: Array<{
      path: string;
      message: string;
    }>;
  };
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));

        const response: ValidationErrorResponse = {
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body validation failed",
            issues,
          },
        };

        return res.status(400).json(response);
      }

      req.body = result.data;
      next();
    } catch (error) {
      console.error("[Validate] Unexpected validation error:", error);
      return res.status(500).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Internal validation error",
          issues: [],
        },
      });
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);
      
      if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));

        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Query parameters validation failed",
            issues,
          },
        });
      }

      (req as any).validatedQuery = result.data;
      next();
    } catch (error) {
      console.error("[Validate] Unexpected query validation error:", error);
      return res.status(500).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Internal validation error",
          issues: [],
        },
      });
    }
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);
      
      if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));

        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Path parameters validation failed",
            issues,
          },
        });
      }

      (req as any).validatedParams = result.data;
      next();
    } catch (error) {
      console.error("[Validate] Unexpected params validation error:", error);
      return res.status(500).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Internal validation error",
          issues: [],
        },
      });
    }
  };
}
