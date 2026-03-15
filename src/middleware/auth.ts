import { Request, Response, NextFunction } from "express";

// TODO: Implement shared auth middleware with AdaAuth API
// For now, these are placeholders

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  // TODO: Validate JWT token with AdaAuth API
  next();
};

export const requireRestaurantAccess = (req: Request, res: Response, next: NextFunction): void => {
  // TODO: Check restaurant access with AdaAuth API
  next();
};