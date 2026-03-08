# Content Service - Implementation Guide

## 📦 Project Structure

```
content-service/
├── package.json              # Dependencies & scripts
├── tsconfig.json            # TypeScript config
├── .env.example             # Environment variables template
├── .gitignore              # Git ignore rules
├── README.md               # Quick start
├── API_EXAMPLES.md         # cURL examples for all endpoints
├── Dockerfile              # Docker image
├── docker-compose.yml      # Docker compose
│
├── db/
│   └── schema.sql          # Database tables & indexes
│
└── src/
    ├── app.ts              # Fastify app configuration
    ├── server.ts           # Server entrypoint
    │
    ├── plugins/
    │   └── supabase.ts     # Supabase client setup
    │
    ├── middleware/
    │   ├── authenticate.ts    # JWT verification
    │   ├── authorizeOrg.ts    # Organization + APPROVED check
    │   └── index.ts           # Exports
    │
    └── modules/
        ├── posts/
        │   ├── posts.routes.ts      # Route definitions
        │   ├── posts.controller.ts  # Request handlers
        │   ├── posts.service.ts     # Business logic
        │   └── posts.schema.ts      # JSON validators
        │
        ├── interactions/
        │   ├── interactions.routes.ts
        │   ├── interactions.controller.ts
        │   ├── interactions.service.ts
        │   └── interactions.schema.ts
        │
        └── feed/
            ├── feed.routes.ts
            ├── feed.controller.ts
            └── feed.service.ts
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd services/content-service
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3001
LOG_LEVEL=info
```

### 3. Build

```bash
npm run build
```

### 4. Run

```bash
npm start
```

Service will start on `http://localhost:3001`

---

## 📊 Database Setup

### Execute Schema

Run the SQL from `db/schema.sql` in your Supabase dashboard:

1. Go to Supabase Dashboard
2. SQL Editor → New Query
3. Copy/paste entire `db/schema.sql`
4. Run

This creates:
- `posts` table
- `post_likes` table
- `post_comments` table
- `post_views` table
- All indexes and RLS setup

---

## 🔌 API Endpoints Summary

| Method | Route | Protection | Description |
|--------|-------|-----------|-------------|
| **POSTS** |
| POST | `/posts` | 🔐 Org+APPROVED | Create post |
| GET | `/posts/:id` | 🌍 Public | Get post |
| PUT | `/posts/:id` | 🔐 Org+Owner | Update post |
| DELETE | `/posts/:id` | 🔐 Org+Owner | Delete post |
| **INTERACTIONS** |
| POST | `/posts/:id/like` | 🔐 Auth | Like post |
| DELETE | `/posts/:id/like` | 🔐 Auth | Unlike post |
| POST | `/posts/:id/comment` | 🔐 Auth | Comment |
| GET | `/posts/:id/comments` | 🌍 Public | Get comments |
| **FEED** |
| GET | `/feed?page=1&limit=10` | 🌍 Public | Global feed |
| GET | `/feed/universites?...` | 🌍 Public | Universities feed |
| GET | `/feed/centres?...` | 🌍 Public | Centers feed |

**Legend:**
- 🔐 = Requires JWT authentication
- 🌍 = Public (no auth required)
- Org+APPROVED = User must be organization with APPROVED status
- Org+Owner = User must be APPROVED organization AND post author

---

## 🔐 Security Details

### Authentication Flow

1. User logs in via `identity-service` → gets JWT token
2. Client sends: `Authorization: Bearer <jwt>`
3. `authenticate` middleware decodes JWT
4. `authorizeOrg` middleware checks:
   - User role is `universite` or `centre_formation`
   - Organization has `statut = APPROVED` in database

### Authorization Rules

**Create Post:**
- Must be authenticated ✓
- Must be APPROVED organization ✓

**Update/Delete Post:**
- Must be authenticated ✓
- Must be APPROVED organization ✓
- Must be post author ✓

**Like/Comment:**
- Must be authenticated ✓
- Can be any user type

**View Feed/Posts:**
- No authentication required ✓
- Public to everyone

---

## 🐳 Docker Setup

### Build & Run with Docker Compose

```bash
docker-compose up --build
```

Service accessible at `http://localhost:3001`

### Environment Variables in Docker

Edit `docker-compose.yml` environment section with Supabase credentials.

---

## 📝 Key Features

✅ **Posts Management**
- Create/read/update/delete posts
- Support for images and videos
- Only APPROVED organizations

✅ **Interactions**
- Like/unlike posts
- Comment on posts
- View comments with pagination

✅ **Feed**
- Global public feed
- Filtered feeds (universities, centers)
- Pagination support
- Auto-count likes and comments

✅ **Security**
- JWT-based authentication
- Organization authorization
- Ownership checks for edits

✅ **Database**
- UUID primary keys
- Proper indexing for performance
- Cascade deletes for data integrity
- RLS ready (can be enabled)

---

## 🧪 Testing

See `API_EXAMPLES.md` for complete cURL examples for all endpoints.

Quick test:

```bash
# Health check
curl http://localhost:3001/health

# Get feed
curl "http://localhost:3001/feed?page=1&limit=10"

# Create post (requires auth)
curl -X POST http://localhost:3001/posts \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"contenu": "Test post"}'
```

---

## 📚 Dependencies

- **fastify** (4.25.1) - Web framework
- **@supabase/supabase-js** (2.38.4) - Database client
- **dotenv** (16.3.1) - Environment config
- **TypeScript** (5.3.3) - Type safety

---

## 🛠️ Development

### Run in Development Mode

```bash
npm run dev
```

Uses `ts-node` for faster iteration.

### Build for Production

```bash
npm run build
npm start
```

---

## 📞 Troubleshooting

**Port already in use:**
```bash
# Change PORT in .env
PORT=3002 npm start
```

**Supabase connection error:**
- Check credentials in `.env`
- Verify SUPABASE_URL format
- Ensure ANON_KEY is correct

**Database tables not found:**
- Run `db/schema.sql` in Supabase SQL editor
- Verify tables created: `posts`, `post_likes`, `post_comments`, `post_views`

**JWT verification failed:**
- Ensure token comes from `identity-service`
- Token must include `sub` (user ID) in claims
- Check token expiration

---

## ✅ Next Steps

1. ✓ Install dependencies
2. ✓ Configure Supabase credentials
3. ✓ Run database schema
4. ✓ Start the service
5. ✓ Test with cURL examples
6. ✓ Deploy to production

---

## 📄 Related Services

- **identity-service** (localhost:3000) - User authentication
- **supabase** - Database and storage
- See parent README for full architecture
