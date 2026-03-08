# API Examples - Content Service

## Setup

```bash
npm install
npm run build
npm start
```

Service runs on `http://localhost:3001`

---

## 🔐 Authentication

All protected endpoints require a Bearer token from identity-service:

```
Authorization: Bearer <jwt-token>
```

---

## 📝 POSTS Module

### 1. Create a Post (Protected - Organization APPROVED only)

```bash
curl -X POST http://localhost:3001/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "contenu": "Bienvenue à notre université!",
    "media_url": "https://supabase.co/images/university.jpg",
    "media_type": "image"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "org_id": "user-uuid",
    "org_type": "universite",
    "contenu": "Bienvenue à notre université!",
    "media_url": "https://supabase.co/images/university.jpg",
    "media_type": "image",
    "created_at": "2024-02-08T10:00:00Z",
    "updated_at": "2024-02-08T10:00:00Z"
  }
}
```

### 2. Get a Post (Public)

```bash
curl -X GET http://localhost:3001/posts/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "org_id": "user-uuid",
    "org_type": "universite",
    "contenu": "Bienvenue à notre université!",
    "media_url": "https://supabase.co/images/university.jpg",
    "media_type": "image",
    "created_at": "2024-02-08T10:00:00Z",
    "updated_at": "2024-02-08T10:00:00Z",
    "likes_count": 42,
    "comments_count": 5
  }
}
```

### 3. Update a Post (Protected - Author only)

```bash
curl -X PUT http://localhost:3001/posts/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "contenu": "Bienvenue mis à jour!"
  }'
```

### 4. Delete a Post (Protected - Author only)

```bash
curl -X DELETE http://localhost:3001/posts/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## ❤️ INTERACTIONS Module

### 1. Like a Post (Protected - Authenticated)

```bash
curl -X POST http://localhost:3001/posts/550e8400-e29b-41d4-a716-446655440000/like \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "like-uuid",
    "post_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "user-uuid",
    "created_at": "2024-02-08T10:05:00Z"
  }
}
```

### 2. Unlike a Post (Protected - Authenticated)

```bash
curl -X DELETE http://localhost:3001/posts/550e8400-e29b-41d4-a716-446655440000/like \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Comment on a Post (Protected - Authenticated)

```bash
curl -X POST http://localhost:3001/posts/550e8400-e29b-41d4-a716-446655440000/comment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "commentaire": "Excellent post!"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "comment-uuid",
    "post_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "user-uuid",
    "commentaire": "Excellent post!",
    "created_at": "2024-02-08T10:10:00Z"
  }
}
```

### 4. Get Comments (Public - With Pagination)

```bash
curl -X GET "http://localhost:3001/posts/550e8400-e29b-41d4-a716-446655440000/comments?page=1&limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "comment-uuid",
      "post_id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "user-uuid",
      "commentaire": "Excellent post!",
      "created_at": "2024-02-08T10:10:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42
  }
}
```

---

## 📰 FEED Module

### 1. Get Global Feed (Public - With Pagination)

```bash
curl -X GET "http://localhost:3001/feed?page=1&limit=20"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "post-uuid-1",
      "org_id": "org-uuid-1",
      "org_type": "universite",
      "contenu": "Premier post",
      "media_url": null,
      "media_type": null,
      "created_at": "2024-02-08T10:00:00Z",
      "updated_at": "2024-02-08T10:00:00Z",
      "likes_count": 15,
      "comments_count": 3
    },
    {
      "id": "post-uuid-2",
      "org_id": "org-uuid-2",
      "org_type": "centre_formation",
      "contenu": "Deuxième post",
      "media_url": "https://example.com/image.jpg",
      "media_type": "image",
      "created_at": "2024-02-08T09:00:00Z",
      "updated_at": "2024-02-08T09:00:00Z",
      "likes_count": 42,
      "comments_count": 8
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156
  }
}
```

### 2. Get Universities Feed (Public)

```bash
curl -X GET "http://localhost:3001/feed/universites?page=1&limit=10"
```

### 3. Get Training Centers Feed (Public)

```bash
curl -X GET "http://localhost:3001/feed/centres?page=1&limit=10"
```

---

## 🏥 Health Check

```bash
curl http://localhost:3001/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "content-service",
  "timestamp": "2024-02-08T10:15:00Z"
}
```

---

## Environment Variables

```env
NODE_ENV=development
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
LOG_LEVEL=info
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Forbidden: Only universities and training centers can perform this action"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "Failed to create post: ..."
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Post not found"
}
```

---

## Security Notes

✅ All write operations require authentication
✅ Only APPROVED organizations can create/edit/delete posts
✅ Users can only edit/delete their own posts
✅ Feed and reading posts are public
✅ JWT tokens verified from Supabase
✅ Database uses UUID v4 for all IDs
