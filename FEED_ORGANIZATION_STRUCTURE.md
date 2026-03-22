# Structure de Réponse `/feed/organization`

## Endpoint

```
GET /feed/organization?organization_id={UUID}&organization_type=universite&page=1&limit=10
```

## Structure Complète de la Réponse

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "author_id": "660e8400-e29b-41d4-a716-446655440001",
      "author_type": "universite",
      "titre": "Journée Portes Ouvertes 2026",
      "description": "Venez découvrir notre magnifique campus et nos programmes d'études. Accueil à partir de 9h du matin.",
      "contenu": "Notre université organise sa journée portes ouvertes annuelle...",
      "media_url": "https://supabase.co/storage/v1/object/public/posts/image-001.jpg",
      "media_type": "image",
      "statut": "PUBLISHED",
      "date_creation": "2026-03-15T10:30:00Z",
      "likes_count": 42,
      "comments_count": 8,
      "shares_count": 12
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "author_id": "660e8400-e29b-41d4-a716-446655440001",
      "author_type": "universite",
      "titre": "Résultats des Examens de Semestre",
      "description": "Les résultats des examens de fin de semestre sont maintenant disponibles.",
      "contenu": null,
      "media_url": null,
      "media_type": null,
      "statut": "PUBLISHED",
      "date_creation": "2026-03-10T14:20:00Z",
      "likes_count": 15,
      "comments_count": 3,
      "shares_count": 2
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "author_id": "660e8400-e29b-41d4-a716-446655440001",
      "author_type": "universite",
      "titre": "Nouveau Programme de Bourse",
      "description": "Nous sommes heureux d'annoncer le lancement de notre nouveau programme de bourses d'études pour les étudiants excellents.",
      "contenu": "Détails complets du programme...",
      "media_url": "https://supabase.co/storage/v1/object/public/posts/video-001.mp4",
      "media_type": "video",
      "statut": "PUBLISHED",
      "date_creation": "2026-03-08T09:15:00Z",
      "likes_count": 87,
      "comments_count": 24,
      "shares_count": 18
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 23
  }
}
```

## Détail des Champs

### Objet Post

| Champ | Type | Description | Exemple |
|-------|------|-------------|---------|
| `id` | UUID | ID unique du post | `550e8400-e29b-41d4-a716-446655440000` |
| `author_id` | UUID | ID de l'université/centre qui a créé le post | `660e8400-e29b-41d4-a716-446655440001` |
| `author_type` | string | Type d'auteur (`universite` ou `centre_formation`) | `universite` |
| `titre` | string | Titre du post | `Journée Portes Ouvertes 2026` |
| `description` | string/null | Description courte du post | `Venez découvrir notre campus...` |
| `contenu` | string/null | Contenu complet du post | `Notre université organise...` |
| `media_url` | string/null | URL de la photo/vidéo | `https://supabase.co/storage/...` |
| `media_type` | string/null | Type de média (`image`, `video` ou null) | `image` |
| `statut` | string | Statut du post (`PUBLISHED`, `DRAFT`, `ARCHIVED`) | `PUBLISHED` |
| `date_creation` | string (ISO 8601) | Date de création | `2026-03-15T10:30:00Z` |
| `likes_count` | number | Nombre de likes | `42` |
| `comments_count` | number | Nombre de commentaires | `8` |
| `shares_count` | number | Nombre de partages | `12` |

### Objet Pagination

| Champ | Type | Description | Exemple |
|-------|------|-------------|---------|
| `page` | number | Page actuelle | `1` |
| `limit` | number | Nombre de posts par page | `10` |
| `total` | number | Nombre total de posts | `23` |

## Cas d'Usage

### 1. Récupérer les posts d'une université

```bash
curl -X GET "http://localhost:3002/feed/organization?organization_id=660e8400-e29b-41d4-a716-446655440001&organization_type=universite&page=1&limit=10"
```

**Réponse :** Tous les posts publiés par cette université

### 2. Récupérer les posts d'un centre de formation

```bash
curl -X GET "http://localhost:3002/feed/organization?organization_id=770e8400-e29b-41d4-a716-446655440002&organization_type=centre&page=1&limit=10"
```

**Réponse :** Tous les posts publiés par ce centre de formation

### 3. Paginer les résultats

```bash
# Page 2, 20 posts par page
curl -X GET "http://localhost:3002/feed/organization?organization_id=xxx&organization_type=universite&page=2&limit=20"
```

## Gestion des Erreurs

### Erreur : Organisation non trouvée

```json
{
  "success": false,
  "error": "Organization not found"
}
```

### Erreur : Paramètres manquants

```json
{
  "success": false,
  "error": "Missing required query parameters: organization_id, organization_type"
}
```

### Erreur : Paramètres invalides

```json
{
  "success": false,
  "error": "Invalid organization_type. Must be 'universite' or 'centre_formation'"
}
```

## Intégration Flutter

```dart
class Post {
  final String id;
  final String authorId;
  final String authorType;
  final String titre;
  final String? description;
  final String? contenu;
  final String? mediaUrl;
  final String? mediaType;
  final String statut;
  final DateTime dateCreation;
  final int likesCount;
  final int commentsCount;
  final int sharesCount;

  Post({
    required this.id,
    required this.authorId,
    required this.authorType,
    required this.titre,
    this.description,
    this.contenu,
    this.mediaUrl,
    this.mediaType,
    required this.statut,
    required this.dateCreation,
    required this.likesCount,
    required this.commentsCount,
    required this.sharesCount,
  });

  factory Post.fromJson(Map<String, dynamic> json) {
    return Post(
      id: json['id'],
      authorId: json['author_id'],
      authorType: json['author_type'],
      titre: json['titre'],
      description: json['description'],
      contenu: json['contenu'],
      mediaUrl: json['media_url'],
      mediaType: json['media_type'],
      statut: json['statut'],
      dateCreation: DateTime.parse(json['date_creation']),
      likesCount: json['likes_count'] ?? 0,
      commentsCount: json['comments_count'] ?? 0,
      sharesCount: json['shares_count'] ?? 0,
    );
  }
}

class FeedOrganization {
  final bool success;
  final List<Post> data;
  final Pagination pagination;

  FeedOrganization({
    required this.success,
    required this.data,
    required this.pagination,
  });

  factory FeedOrganization.fromJson(Map<String, dynamic> json) {
    return FeedOrganization(
      success: json['success'],
      data: List<Post>.from(
        json['data'].map((post) => Post.fromJson(post))
      ),
      pagination: Pagination.fromJson(json['pagination']),
    );
  }
}

class Pagination {
  final int page;
  final int limit;
  final int total;

  Pagination({
    required this.page,
    required this.limit,
    required this.total,
  });

  int get maxPages => (total / limit).ceil();

  factory Pagination.fromJson(Map<String, dynamic> json) {
    return Pagination(
      page: json['page'],
      limit: json['limit'],
      total: json['total'],
    );
  }
}

// Utilisation
Future<FeedOrganization> fetchOrganizationFeed({
  required String organizationId,
  required String organizationType,
  int page = 1,
  int limit = 10,
}) async {
  final baseUrl = 'http://localhost:3002';
  final url = '$baseUrl/feed/organization'
      '?organization_id=$organizationId'
      '&organization_type=$organizationType'
      '&page=$page'
      '&limit=$limit';

  final response = await http.get(Uri.parse(url));

  if (response.statusCode == 200) {
    return FeedOrganization.fromJson(jsonDecode(response.body));
  } else {
    throw Exception('Failed to load organization feed');
  }
}

// Dans ton Widget
@override
void initState() {
  super.initState();
  _fetchFeed();
}

Future<void> _fetchFeed() async {
  try {
    final feed = await fetchOrganizationFeed(
      organizationId: widget.universityId,
      organizationType: 'universite',
    );
    setState(() {
      _posts = feed.data;
      _pagination = feed.pagination;
    });
  } catch (e) {
    _showError(e.toString());
  }
}
```

## Notes Importantes

✅ **Uniquement posts publiés** : Les posts en brouillon ou archivés ne sont retournés que si l'utilisateur est le propriétaire

✅ **Isolation garantie** : Les posts d'autres organisations ne seront JAMAIS retournés

✅ **Pagination sûre** : Même avec un `limit=1000`, une limite max de 50 posts par page est appliquée côté serveur

✅ **Compteurs à jour** : `likes_count`, `comments_count`, `shares_count` reflètent l'état actuel en BD
