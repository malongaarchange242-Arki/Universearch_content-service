# 📱 API Endpoints Documentations - Posts (Images & Vidéos) - Flutter App

## Base URL
```
https://universearch-content-service.onrender.com
```

---

## 📸 POSTS ENDPOINTS

### 1. Récupérer Tous les Posts (Public)
**GET** `/posts`

**Description:** Récupère la liste de tous les posts des universités et centres de formation approuvés

**Parameters:** 
- `limit` (query, optional): Nombre max de posts (default: 50)
- `offset` (query, optional): Pour la pagination (default: 0)

**Example Request:**
```
GET https://universearch-content-service.onrender.com/posts?limit=50&offset=0
```

**Response: 200 OK**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "author_id": "660e8400-e29b-41d4-a716-446655440001",
    "author_type": "universite",
    "titre": "Journée Portes Ouvertes 2026",
    "description": "Venez découvrir notre campus lors de la journée portes ouvertes. Accueil dès 9h du matin.",
    "contenu": "",
    "media_url": "https://storage.example.com/posts/image-001.jpg",
    "media_type": "image",
    "statut": "PUBLISHED",
    "date_creation": "2026-03-08T14:30:00Z"
  },
  
]
```

**Error Responses:**
- `500 Internal Server Error` - Erreur serveur



### 2. Récupérer Un Post par ID (Public)
**GET** `/posts/:id`

**Description:** Récupère les détails complet d'un post spécifique avec compteurs

**Parameters:**
- `id` (path, required): UUID du post

**Example Request:**
```
GET https://universearch-content-service.onrender.com/posts/550e8400-e29b-41d4-a716-446655440000
```

**Response: 200 OK**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "author_id": "660e8400-e29b-41d4-a716-446655440001",
  "author_type": "universite",
  "titre": "Journée Portes Ouvertes 2026",
  "description": "Venez découvrir notre campus lors de la journée portes ouvertes. Accueil dès 9h du matin.",
  "contenu": "",
  "media_url": "https://storage.example.com/posts/image-001.jpg",
  "media_type": "image",
  "statut": "PUBLISHED",
  "date_creation": "2026-03-08T14:30:00Z",
  "likes_count": 42,
  "comments_count": 8
}
```

**Error Responses:**
- `404 Not Found` - Post non trouvé
- `500 Internal Server Error` - Erreur serveur

---


## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | ✅ Succès |
| 201 | ✅ Créé (Post/Upload réussi) |
| 400 | ❌ Mauvaise Requête |
| 401 | ❌ Non Authentifié (Token manquant/invalide) |
| 403 | ❌ Interdit (Non propriétaire/Non approuvé) |
| 404 | ❌ Non Trouvé |
| 500 | ❌ Erreur Serveur |

---

## 🔗 Endpoints Récapitulatif

### Public (Sans Auth)
```
GET  /posts              (Lister tous les posts)
GET  /posts/:id          (Récupérer un post spécifique)
```


---

**Happy coding! 🚀**
