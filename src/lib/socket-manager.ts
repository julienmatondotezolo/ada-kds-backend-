import { Server as SocketIOServer } from "socket.io";
import { Station } from "../types";

export class SocketManager {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  // Station-related real-time events
  emitStationCreated(restaurantId: string, station: Station, userId: string) {
    console.log(`📡 Emitting station_created for restaurant ${restaurantId}`);
    this.io.to(`restaurant-${restaurantId}`).emit('station_created', {
      station,
      restaurant_id: restaurantId,
      created_by: userId,
      timestamp: new Date().toISOString(),
      event_type: 'station_created'
    });
  }

  emitStationUpdated(restaurantId: string, station: Station, userId: string) {
    console.log(`📡 Emitting station_updated for station ${station.id}`);
    this.io.to(`restaurant-${restaurantId}`).emit('station_updated', {
      station,
      restaurant_id: restaurantId,
      updated_by: userId,
      timestamp: new Date().toISOString(),
      event_type: 'station_updated'
    });
  }

  emitStationDeleted(restaurantId: string, stationId: string, stationName: string, userId: string, deleteType: 'hard' | 'soft') {
    console.log(`📡 Emitting station_${deleteType}_deleted for station ${stationId}`);
    this.io.to(`restaurant-${restaurantId}`).emit(`station_${deleteType}_deleted`, {
      station_id: stationId,
      station_name: stationName,
      restaurant_id: restaurantId,
      deleted_by: userId,
      delete_type: deleteType,
      timestamp: new Date().toISOString(),
      event_type: `station_${deleteType}_deleted`
    });
  }

  emitStationRestored(restaurantId: string, station: Station, userId: string) {
    console.log(`📡 Emitting station_restored for station ${station.id}`);
    this.io.to(`restaurant-${restaurantId}`).emit('station_restored', {
      station,
      restaurant_id: restaurantId,
      restored_by: userId,
      timestamp: new Date().toISOString(),
      event_type: 'station_restored'
    });
  }

  // Order assignment events
  emitOrderAssigned(restaurantId: string, orderId: string, stationId: string, assignedBy: string) {
    console.log(`📡 Emitting order_assigned - Order ${orderId} to Station ${stationId}`);
    this.io.to(`restaurant-${restaurantId}`).emit('order_assigned', {
      order_id: orderId,
      station_id: stationId,
      restaurant_id: restaurantId,
      assigned_by: assignedBy,
      timestamp: new Date().toISOString(),
      event_type: 'order_assigned'
    });
  }

  // Admin notifications
  emitAdminNotification(restaurantId: string, notification: {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    action?: string;
    userId?: string;
  }) {
    console.log(`📡 Emitting admin_notification for restaurant ${restaurantId}: ${notification.title}`);
    this.io.to(`restaurant-${restaurantId}`).emit('admin_notification', {
      ...notification,
      restaurant_id: restaurantId,
      timestamp: new Date().toISOString(),
      event_type: 'admin_notification'
    });
  }

  // Force refresh events (for critical updates)
  emitForceRefresh(restaurantId: string, reason: string, component?: 'stations' | 'orders' | 'display') {
    console.log(`📡 Emitting force_refresh for restaurant ${restaurantId}: ${reason}`);
    this.io.to(`restaurant-${restaurantId}`).emit('force_refresh', {
      restaurant_id: restaurantId,
      component,
      reason,
      timestamp: new Date().toISOString(),
      event_type: 'force_refresh'
    });
  }

  // User activity tracking
  emitUserActivity(restaurantId: string, userId: string, action: string, details?: any) {
    // Only emit to admin users for audit purposes
    this.io.to(`restaurant-${restaurantId}-admins`).emit('user_activity', {
      user_id: userId,
      action,
      details,
      restaurant_id: restaurantId,
      timestamp: new Date().toISOString(),
      event_type: 'user_activity'
    });
  }

  // Permission changes
  emitPermissionChanged(restaurantId: string, userId: string, oldRole: string, newRole: string, changedBy: string) {
    console.log(`📡 Emitting permission_changed for user ${userId}: ${oldRole} → ${newRole}`);
    this.io.to(`restaurant-${restaurantId}`).emit('permission_changed', {
      user_id: userId,
      old_role: oldRole,
      new_role: newRole,
      changed_by: changedBy,
      restaurant_id: restaurantId,
      timestamp: new Date().toISOString(),
      event_type: 'permission_changed'
    });
  }

  // Join restaurant room with role-based access
  joinRestaurantRoom(socketId: string, restaurantId: string, userId: string, userRole: 'admin' | 'owner' | 'staff') {
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;

    // Join main restaurant room
    socket.join(`restaurant-${restaurantId}`);
    
    // Join role-specific rooms
    if (userRole === 'admin') {
      socket.join(`restaurant-${restaurantId}-admins`);
    }
    if (['admin', 'owner'].includes(userRole)) {
      socket.join(`restaurant-${restaurantId}-managers`);
    }

    console.log(`Socket ${socketId} (${userRole}) joined restaurant ${restaurantId} rooms`);
  }

  // Leave restaurant room
  leaveRestaurantRoom(socketId: string, restaurantId: string) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;

    socket.leave(`restaurant-${restaurantId}`);
    socket.leave(`restaurant-${restaurantId}-admins`);
    socket.leave(`restaurant-${restaurantId}-managers`);
    
    console.log(`Socket ${socketId} left restaurant ${restaurantId} rooms`);
  }

  // Get connection stats
  getConnectionStats(restaurantId: string): {
    total_connections: number;
    restaurant_connections: number;
    admin_connections: number;
    manager_connections: number;
  } {
    const total = this.io.sockets.sockets.size;
    const restaurant = this.io.sockets.adapter.rooms.get(`restaurant-${restaurantId}`)?.size || 0;
    const admins = this.io.sockets.adapter.rooms.get(`restaurant-${restaurantId}-admins`)?.size || 0;
    const managers = this.io.sockets.adapter.rooms.get(`restaurant-${restaurantId}-managers`)?.size || 0;

    return {
      total_connections: total,
      restaurant_connections: restaurant,
      admin_connections: admins,
      manager_connections: managers
    };
  }

  // Broadcast system maintenance notifications
  emitMaintenanceNotification(message: string, scheduledTime?: string) {
    console.log(`📡 Broadcasting maintenance notification: ${message}`);
    this.io.emit('system_maintenance', {
      message,
      scheduled_time: scheduledTime,
      timestamp: new Date().toISOString(),
      event_type: 'system_maintenance'
    });
  }
}

// Utility function to get socket manager from Express app
export function getSocketManager(app: any): SocketManager | null {
  const io = app.get('io') as SocketIOServer;
  return io ? new SocketManager(io) : null;
}