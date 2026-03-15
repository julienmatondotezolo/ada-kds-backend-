# AdaKDS API - Curl Commands for Order Management

## 🍳 Order Sources & Testing Commands

### 📞 Phone Assistant Orders

**Italian Restaurant Order via Phone Assistant:**
```bash
curl -X POST "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/incoming" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "phone_assistant",
    "order_number": "PHONE001",
    "customer_name": "Maria Rossi",
    "customer_type": "takeaway",
    "customer_phone": "+32 456 789 123",
    "priority": "normal",
    "items": [
      {
        "name": "Pizza Margherita",
        "quantity": 2,
        "special_requests": "Extra basil, no oregano",
        "category": "pizza",
        "estimated_time": 12
      },
      {
        "name": "Spaghetti Carbonara",
        "quantity": 1,
        "special_requests": "Extra parmesan cheese",
        "category": "pasta", 
        "estimated_time": 8
      },
      {
        "name": "Tiramisu",
        "quantity": 2,
        "special_requests": "No coffee dust",
        "category": "dessert",
        "estimated_time": 2
      }
    ],
    "special_instructions": "Customer is allergic to nuts, please ensure no cross-contamination"
  }'
```

**Urgent Phone Order:**
```bash
curl -X POST "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/incoming" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "phone_assistant",
    "order_number": "URGENT001",
    "customer_name": "VIP Customer",
    "customer_type": "takeaway",
    "customer_phone": "+32 456 789 456",
    "priority": "urgent",
    "items": [
      {
        "name": "Osso Buco alla Milanese",
        "quantity": 1,
        "special_requests": "Medium rare, extra sauce",
        "category": "meat",
        "estimated_time": 25
      }
    ],
    "special_instructions": "VIP customer, please prioritize"
  }'
```

### 🌐 Website Orders

**Online Order via Website:**
```bash
curl -X POST "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/incoming" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "website",
    "order_number": "WEB2024001",
    "customer_name": "Table 5",
    "customer_type": "dine_in",
    "priority": "normal",
    "items": [
      {
        "name": "Antipasti Misti",
        "quantity": 1,
        "special_requests": "No olives",
        "category": "cold_appetizers",
        "estimated_time": 5
      },
      {
        "name": "Risotto ai Funghi",
        "quantity": 2,
        "special_requests": "Extra mushrooms",
        "category": "pasta",
        "estimated_time": 18
      },
      {
        "name": "Panna Cotta",
        "quantity": 2,
        "special_requests": "",
        "category": "dessert",
        "estimated_time": 2
      }
    ]
  }'
```

**Delivery Order via Website:**
```bash
curl -X POST "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/incoming" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "website",
    "order_number": "DEL001",
    "customer_name": "Giovanni Bianchi",
    "customer_type": "delivery",
    "customer_phone": "+32 456 789 789",
    "priority": "normal",
    "items": [
      {
        "name": "Pizza Quattro Stagioni",
        "quantity": 1,
        "special_requests": "Well done, crispy crust",
        "category": "pizza",
        "estimated_time": 15
      },
      {
        "name": "Caesar Salad",
        "quantity": 1,
        "special_requests": "Dressing on the side",
        "category": "salad",
        "estimated_time": 5
      }
    ],
    "special_instructions": "Delivery address: Via Roma 123, Deerlijk. Ring doorbell twice."
  }'
```

### 📱 QR Code Orders (Table Ordering)

**QR Code Table Order:**
```bash
curl -X POST "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/incoming" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "qr_code",
    "order_number": "QR12001",
    "customer_name": "Table 12",
    "customer_type": "dine_in",
    "priority": "normal",
    "items": [
      {
        "name": "Bruschetta al Pomodoro",
        "quantity": 2,
        "special_requests": "Extra garlic",
        "category": "cold_appetizers",
        "estimated_time": 3
      },
      {
        "name": "Gnocchi alla Sorrentina",
        "quantity": 1,
        "special_requests": "",
        "category": "pasta",
        "estimated_time": 12
      },
      {
        "name": "Grilled Branzino",
        "quantity": 1,
        "special_requests": "Light salt, lemon on the side",
        "category": "grilled_fish",
        "estimated_time": 20
      }
    ]
  }'
```

### 🍹 Bar/Drinks Orders

**Bar Order:**
```bash
curl -X POST "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/incoming" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "pos_system",
    "order_number": "BAR001",
    "customer_name": "Table 8",
    "customer_type": "dine_in",
    "priority": "high",
    "items": [
      {
        "name": "Aperol Spritz",
        "quantity": 2,
        "special_requests": "Light ice, extra prosecco",
        "category": "cocktails",
        "estimated_time": 3
      },
      {
        "name": "Espresso",
        "quantity": 2,
        "special_requests": "",
        "category": "coffee",
        "estimated_time": 1
      },
      {
        "name": "Limoncello",
        "quantity": 2,
        "special_requests": "Chilled glasses",
        "category": "digestif",
        "estimated_time": 1
      }
    ]
  }'
```

### 📦 Bulk Orders (for testing multiple orders)

**Bulk Orders Import:**
```bash
curl -X POST "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/bulk" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "bulk_import",
    "orders": [
      {
        "order_number": "BULK001",
        "customer_name": "Table 3",
        "customer_type": "dine_in",
        "priority": "normal",
        "items": [
          {
            "name": "Caprese Salad",
            "quantity": 1,
            "category": "salad",
            "estimated_time": 5
          }
        ]
      },
      {
        "order_number": "BULK002",
        "customer_name": "Table 7",
        "customer_type": "dine_in", 
        "priority": "normal",
        "items": [
          {
            "name": "Linguine alle Vongole",
            "quantity": 1,
            "category": "pasta",
            "estimated_time": 15
          }
        ]
      }
    ]
  }'
```

## 📊 Order Management Commands

### Get All Orders
```bash
curl "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders"
```

### Get Orders by Status
```bash
# New orders only
curl "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders?status=new"

# Preparing orders only  
curl "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders?status=preparing"

# Ready orders only
curl "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders?status=ready"
```

### Get Orders by Station
```bash
# Hot Kitchen orders
curl "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders?station=hot_kitchen"

# Cold Prep orders
curl "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders?station=cold_prep"

# Bar orders
curl "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders?station=bar"
```

### Bump Order Status
```bash
# Bump order to next status
curl -X POST "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/PHONE001/bump" \
  -H "Content-Type: application/json" \
  -d '{"current_status": "new"}'
```

### Update Order Status Manually
```bash
# Mark order as ready
curl -X PUT "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/PHONE001/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "ready", "old_status": "preparing"}'
```

### Get Kitchen Analytics
```bash
curl "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/analytics"
```

## 🏢 Station Management

### Get All Stations
```bash
curl "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/stations"
```

### Get Station Orders
```bash
curl "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/stations/station-hot/orders"
```

## 🖥️ Display Management

### Get Display Configuration
```bash
curl "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/display/config"
```

### Get Display Status
```bash
curl "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/display/status"
```

### Send Test Alert
```bash
curl -X POST "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/display/test-alert" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test alert from kitchen!", "level": "warning"}'
```

### Force Refresh Displays
```bash
curl -X POST "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/display/refresh"
```

## 🔍 Health Check
```bash
curl "https://api-kds.adasystems.app/health"
```

## 🎯 Demo Scenarios

### Rush Hour Simulation
Run these commands in sequence to simulate a busy kitchen:

1. **Multiple phone orders:**
```bash
# Order 1
curl -X POST "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/incoming" -H "Content-Type: application/json" -d '{"source":"phone_assistant","order_number":"RUSH001","customer_name":"Maria","customer_type":"takeaway","items":[{"name":"Pizza Margherita","quantity":2,"category":"pizza","estimated_time":12}]}'

# Order 2  
curl -X POST "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/incoming" -H "Content-Type: application/json" -d '{"source":"phone_assistant","order_number":"RUSH002","customer_name":"Giovanni","customer_type":"takeaway","items":[{"name":"Spaghetti Carbonara","quantity":1,"category":"pasta","estimated_time":10}]}'

# Order 3
curl -X POST "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/incoming" -H "Content-Type: application/json" -d '{"source":"qr_code","order_number":"RUSH003","customer_name":"Table 5","customer_type":"dine_in","items":[{"name":"Osso Buco","quantity":1,"category":"meat","estimated_time":25}]}'
```

2. **Check analytics:**
```bash
curl "https://api-kds.adasystems.app/api/v1/restaurants/demo-restaurant/orders/analytics"
```

This will show the kitchen dashboard with multiple active orders across different stations, perfect for demonstrating the AdaKDS system to L'Osteria!