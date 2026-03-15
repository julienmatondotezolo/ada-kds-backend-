import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  restaurant?: {
    id: string;
    name: string;
  };
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "No valid authentication token provided"
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // TODO: Validate token with AdaAuth service
    // For now, mock validation
    const mockUser = {
      id: "user-123",
      email: "admin@losteria.be",
      role: "admin"
    };
    
    req.user = mockUser;
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Invalid authentication token"
    });
  }
};

export const requireRestaurantAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    
    if (!restaurantId) {
      res.status(400).json({
        error: "MISSING_RESTAURANT_ID",
        message: "Restaurant ID is required"
      });
      return;
    }

    // TODO: Validate user has access to this restaurant
    // For now, mock validation
    const mockRestaurant = {
      id: restaurantId,
      name: "L'Osteria Deerlijk"
    };
    
    req.restaurant = mockRestaurant;
    next();
  } catch (error) {
    console.error("Restaurant access error:", error);
    res.status(403).json({
      error: "FORBIDDEN",
      message: "Access to this restaurant is not allowed"
    });
  }
};