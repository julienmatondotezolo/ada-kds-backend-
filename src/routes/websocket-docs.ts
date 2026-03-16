/**
 * @swagger
 * components:
 *   schemas:
 *     SocketConnection:
 *       type: object
 *       description: WebSocket connection configuration
 *       properties:
 *         url:
 *           type: string
 *           example: "https://api-kds.adasystems.app"
 *         auth:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *               description: JWT token from AdaAuth
 *             restaurantId:
 *               type: string
 *               description: Restaurant UUID to join updates room
 * 
 * /websocket/events:
 *   get:
 *     summary: WebSocket Events Documentation
 *     description: |
 *       # 🔌 AdaKDS WebSocket Integration
 *       
 *       AdaKDS uses Socket.IO for real-time communication between kitchen displays, QR code apps, and management systems.
 *       
 *       ## Connection Setup
 *       
 *       ```javascript
 *       import io from 'socket.io-client';
 *       
 *       const socket = io('https://api-kds.adasystems.app', {
 *         auth: {
 *           token: 'your-jwt-token-from-adaauth',
 *           restaurantId: 'restaurant-uuid'
 *         }
 *       });
 *       ```
 *       
 *       ## 📥 Events You Can Listen To
 *       
 *       ### order:created
 *       Fired when a new order is received (from QR code, phone, etc.)
 *       ```javascript
 *       socket.on('order:created', (data) => {
 *         const { order, source } = data;
 *         console.log('New order:', order);
 *         addOrderToDisplay(order);
 *       });
 *       ```
 *       
 *       ### order:updated
 *       Fired when order status changes or details are modified
 *       ```javascript
 *       socket.on('order:updated', (data) => {
 *         const { order, previousStatus, updatedBy } = data;
 *         console.log(`Order ${order.id} changed from ${previousStatus} to ${order.status}`);
 *         updateOrderInDisplay(order);
 *         
 *         // For QR code apps - notify customer
 *         if (order.status === 'ready') {
 *           showNotification('Your order is ready for pickup!');
 *         }
 *       });
 *       ```
 *       
 *       ### order:deleted
 *       Fired when an order is cancelled or removed
 *       ```javascript
 *       socket.on('order:deleted', (data) => {
 *         const { orderId, reason } = data;
 *         removeOrderFromDisplay(orderId);
 *       });
 *       ```
 *       
 *       ### station:updated
 *       Fired when station configuration changes
 *       ```javascript
 *       socket.on('station:updated', (data) => {
 *         const { station, action } = data; // action: 'created', 'updated', 'deleted'
 *         updateStationConfig(station, action);
 *       });
 *       ```
 *       
 *       ### connection:restaurant
 *       Confirmation that you've joined the restaurant's update room
 *       ```javascript
 *       socket.on('connection:restaurant', (data) => {
 *         console.log(`Connected to restaurant ${data.restaurantId} updates`);
 *       });
 *       ```
 *       
 *       ## 📤 Events You Can Send
 *       
 *       ### order:updateStatus
 *       Update an order's status (kitchen staff action)
 *       ```javascript
 *       socket.emit('order:updateStatus', {
 *         orderId: 'order-uuid',
 *         status: 'preparing', // pending, preparing, ready, completed, cancelled
 *         stationId: 'station-uuid',
 *         notes: 'Started by Chef Mario'
 *       });
 *       ```
 *       
 *       ### order:assignStation
 *       Assign an order to a specific station
 *       ```javascript
 *       socket.emit('order:assignStation', {
 *         orderId: 'order-uuid',
 *         stationId: 'station-uuid',
 *         estimatedTime: 15 // minutes
 *       });
 *       ```
 *       
 *       ### join:restaurant
 *       Manually join a restaurant's update room (usually done automatically on connection)
 *       ```javascript
 *       socket.emit('join:restaurant', {
 *         restaurantId: 'restaurant-uuid'
 *       });
 *       ```
 *       
 *       ## 🔄 Complete QR Code App Integration Example
 *       
 *       ```javascript
 *       class QRCodeOrderApp {
 *         constructor(restaurantId) {
 *           this.restaurantId = restaurantId;
 *           this.socket = io('https://api-kds.adasystems.app', {
 *             auth: { restaurantId }
 *           });
 *           this.setupListeners();
 *         }
 *         
 *         setupListeners() {
 *           // Listen for order status updates
 *           this.socket.on('order:updated', (data) => {
 *             if (data.order.id === this.currentOrderId) {
 *               this.updateOrderStatus(data.order);
 *             }
 *           });
 *         }
 *         
 *         async submitOrder(orderData) {
 *           try {
 *             // Submit via REST API
 *             const response = await fetch(`/api/v1/restaurants/${this.restaurantId}/orders/incoming`, {
 *               method: 'POST',
 *               headers: { 'Content-Type': 'application/json' },
 *               body: JSON.stringify({
 *                 source: 'qr_code',
 *                 ...orderData
 *               })
 *             });
 *             
 *             const result = await response.json();
 *             this.currentOrderId = result.order.id;
 *             
 *             // Now listen for real-time updates
 *             this.showOrderTracking(result.order);
 *             
 *           } catch (error) {
 *             console.error('Order submission failed:', error);
 *           }
 *         }
 *         
 *         updateOrderStatus(order) {
 *           switch(order.status) {
 *             case 'pending':
 *               this.showMessage('Order received! Getting ready to cook...');
 *               break;
 *             case 'preparing':
 *               this.showMessage(`Now cooking! ETA: ${order.estimated_completion}`);
 *               break;
 *             case 'ready':
 *               this.showNotification('🍽️ Your order is ready for pickup!');
 *               this.playSound('order-ready');
 *               break;
 *             case 'completed':
 *               this.showMessage('Thank you! Enjoy your meal! 😊');
 *               break;
 *             case 'cancelled':
 *               this.showError('Order was cancelled. Please contact staff.');
 *               break;
 *           }
 *         }
 *       }
 *       
 *       // Initialize the app
 *       const qrApp = new QRCodeOrderApp('your-restaurant-id');
 *       ```
 *       
 *       ## 🍳 Kitchen Display Integration
 *       
 *       ```javascript
 *       class KitchenDisplay {
 *         constructor(restaurantId, token) {
 *           this.socket = io('https://api-kds.adasystems.app', {
 *             auth: { token, restaurantId }
 *           });
 *           this.setupKitchenListeners();
 *         }
 *         
 *         setupKitchenListeners() {
 *           // New orders coming in
 *           this.socket.on('order:created', (data) => {
 *             this.addOrderToQueue(data.order);
 *             this.playSound('new-order');
 *           });
 *           
 *           // Orders updated by other staff
 *           this.socket.on('order:updated', (data) => {
 *             this.updateOrderCard(data.order);
 *           });
 *         }
 *         
 *         updateOrderStatus(orderId, newStatus) {
 *           // Update via WebSocket for real-time response
 *           this.socket.emit('order:updateStatus', {
 *             orderId,
 *             status: newStatus,
 *             stationId: this.currentStation,
 *             updatedBy: this.currentUser
 *           });
 *         }
 *       }
 *       ```
 *       
 *       ## Error Handling
 *       
 *       ```javascript
 *       socket.on('connect_error', (error) => {
 *         console.error('Connection failed:', error);
 *         // Show offline mode or retry logic
 *       });
 *       
 *       socket.on('error', (error) => {
 *         console.error('Socket error:', error);
 *         // Handle specific errors (auth, permissions, etc.)
 *       });
 *       
 *       socket.on('disconnect', (reason) => {
 *         console.log('Disconnected:', reason);
 *         // Show reconnection status
 *       });
 *       ```
 *     tags: [WebSocket, Real-Time, QR Code Integration]
 *     responses:
 *       200:
 *         description: WebSocket documentation (this is not an actual REST endpoint)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 note:
 *                   type: string
 *                   example: "This is documentation only. WebSocket connections are made to the root URL with Socket.IO"
 */