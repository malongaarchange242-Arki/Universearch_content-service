# Content Service

Microservice REST pour la gestion du contenu social (posts, likes, commentaires, feed).

## Features

- ✅ Création/modification/suppression de posts pour organisations APPROVED
- ✅ Likes et commentaires
- ✅ Feed public avec pagination
- ✅ Sécurité JWT Supabase
- ✅ Stockage média Supabase

## Installation

```bash
npm install
npm run build
npm start
```

## Architecture

```
src/
├── plugins/          # Supabase, Auth
├── middleware/       # Authenticate, AuthorizeOrg
└── modules/
    ├── posts/        # CRUD posts
    ├── interactions/ # Likes, comments
    └── feed/         # Public feed
```

## API Endpoints

### Posts

- `POST /posts` - Créer un post
- `GET /posts/:id` - Voir un post
- `PUT /posts/:id` - Modifier un post
- `DELETE /posts/:id` - Supprimer un post

### Interactions

- `POST /posts/:id/like` - Aimer un post
- `DELETE /posts/:id/like` - Retirer le like
- `POST /posts/:id/comment` - Commenter
- `GET /posts/:id/comments` - Lister les commentaires

### Feed

- `GET /feed` - Feed global
- `GET /feed/universites` - Feed universités
- `GET /feed/centres` - Feed centres

## Variables d'environnement

Voir `.env.example`
"# Universearch_content-service" 
