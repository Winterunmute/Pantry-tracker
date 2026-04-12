# Quick Start

## Prerequisites
- Java 21+
- Node 18+
- Maven 3.9+
- Git

## First time setup

```bash
git clone https://github.com/YOUR_USERNAME/pantry-tracker.git
cd pantry-tracker
```

### Backend config
Create `backend/src/main/resources/application-local.properties`:

```properties
spring.data.mongodb.uri=YOUR_MONGODB_ATLAS_URI
jwt.secret=YOUR_JWT_SECRET_HEX_STRING
jwt.expiration=900000
jwt.refresh-expiration=2592000000
spoonacular.api-key=YOUR_SPOONACULAR_API_KEY
```

### Frontend config
Create `frontend/.env`:

```
VITE_SPOONACULAR_KEY=YOUR_SPOONACULAR_API_KEY
```

## Start backend (Linux)
```bash
cd backend
./mvnw spring-boot:run
```

## Start backend (Windows)
```cmd
cd backend
mvn spring-boot:run
```

## Start frontend
```bash
cd frontend
npm install
npm run dev
```

## Verify everything works
```bash
curl http://localhost:8080/api/inventory
# Should return a JSON array
```

Open http://localhost:5173 in browser

## Known gotchas
- **NordVPN must be OFF** — blocks MongoDB Atlas connection
- **Port 8080 already in use:**
  - Linux: `lsof -i :8080 | grep LISTEN`, then `kill -9 PID`
  - Windows: `netstat -ano | findstr :8080`, then `taskkill /PID xxx /F`
- **Frontend may start on port 5174** if 5173 is taken (both are in CORS allowlist)
- **On Linux use `./mvnw`** instead of `mvn` if Maven not installed globally
