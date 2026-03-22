# 🔧 Flutter Posts Isolation Fix

## Problème Résolu

Chaque université pouvait voir les posts de **toutes** les autres universités. Le problème était que :

1. **Incohérence schéma** : Table `posts` utilisait `org_id`/`org_type`, mais le code attendait `author_id`/`author_type`
2. **Pas de filtrage par université** : Les endpoints `/feed` et `/feed/universites` retournaient **tous** les posts
3. **Pas d'isolation d'organisation** : Aucun endpoint pour filtrer uniquement les posts d'une université spécifique

## Solutions Implémentées

### 1. Schéma Corrigé
- Colonnes primaires : `author_id`, `author_type`, `titre`, `description`, `statut`
- Colonnes générées (alias) : `org_id`, `org_type` pour rétrocompatibilité
- Index améliorés et RLS policy pour la sécurité

### 2. Nouvel Endpoint : `/feed/organization`

**GET** `/feed/organization?organization_id={id}&organization_type={type}&page=1&limit=10`

Retourne **UNIQUEMENT** les posts d'une organisation spécifique.

#### Paramètres obligatoires
| Paramètre | Type | Description |
|-----------|------|-------------|
| `organization_id` | UUID | ID de l'université ou centre de formation |
| `organization_type` | string | `universite` ou `centre` |

#### Paramètres optionnels
| Paramètre | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Numéro de page |
| `limit` | number | 10 | Posts par page (max 50) |

#### Réponse
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "author_id": "660e8400-e29b-41d4-a716-446655440001",
      "author_type": "universite",
      "titre": "Journée Portes Ouvertes 2026",
      "description": "Venez découvrir notre campus...",
      "contenu": "",
      "media_url": "https://...",
      "media_type": "image",
      "statut": "PUBLISHED",
      "date_creation": "2026-03-08T14:30:00Z",
      "likes_count": 42,
      "comments_count": 8
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25
  }
}
```

## Mise à Jour de l'App Flutter

### Avant (Problématique)
```dart
// Récupérait TOUS les posts de TOUTES les universités
final response = await http.get(
  Uri.parse('$baseUrl/feed/universites?page=1&limit=10'),
);
```

### Après (Corrigé)
```dart
// Récupère UNIQUEMENT les posts de CETTE université
final response = await http.get(
  Uri.parse(
    '$baseUrl/feed/organization'
    '?organization_id=$universitéId'
    '&organization_type=universite'
    '&page=1&limit=10'
  ),
);
```

## Endpoints Restants

| Endpoint | Cas d'Usage |
|----------|-----------|
| `GET /feed` | Feed global (tous les posts) - **À ÉVITER** |
| `GET /feed/universites` | Tous les posts des universités - **À ÉVITER** |
| `GET /feed/centres` | Tous les posts des centres - **À ÉVITER** |
| **`GET /feed/organization`** | **✅ Posts d'UNE université/centre - À UTILISER** |
| `GET /posts?entity_id={id}&entity_type={type}` | Alternative : filtrer par entité |
| `GET /posts/entity?entity_id={id}&entity_type={type}` | Endpoint dédié |

## Migration Checklist

- [ ] Mettre à jour `db/schema.sql` en prod (via Supabase dashboard)
- [ ] Tester le nouvel endpoint `/feed/organization`
- [ ] Mettre à jour l'app Flutter pour utiliser `organization_id`
- [ ] Vérifier que chaque université voit **uniquement** ses posts
- [ ] Déployer le backend mis à jour
- [ ] Release l'app Flutter avec les changements

## Exemple cURL

```bash
# Récupérer les posts de l'université avec ID xxx
curl -X GET \
  "https://universearch-content-service.onrender.com/feed/organization?organization_id=xxx&organization_type=universite&page=1&limit=20"

# Récupérer les posts d'un centre de formation
curl -X GET \
  "https://universearch-content-service.onrender.com/feed/organization?organization_id=yyy&organization_type=centre&page=1&limit=20"
```

## Notes de Sécurité

✅ **RLS Policy activé** : Les posts non publiés sont protégés
✅ **Filtrage côté serveur** : `author_id` et `author_type` sont filtrés du côté serveur (pas de confiance au client)
✅ **Isolation garantie** : Même si l'app appelle `/feed`, c'est le problème de l'app (à éviter)
