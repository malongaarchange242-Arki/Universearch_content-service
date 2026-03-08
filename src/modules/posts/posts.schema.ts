// src/modules/posts/posts.schema.ts

export const createPostSchema = {
  body: {
    type: 'object',
    required: ['titre', 'description'],
    properties: {
      titre: { type: 'string', minLength: 1, maxLength: 500 },
      description: { type: 'string', minLength: 1, maxLength: 5000 },
      media_url: { type: ['string', 'null'], description: 'URL du média (si disponible)' },
      media_type: { type: ['string', 'null'], enum: ['image', 'video'], description: 'Type de média' }
    }
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            author_id: { type: 'string' },
            author_type: { type: 'string' },
            titre: { type: 'string' },
            description: { type: ['string', 'null'] },
            contenu: { type: 'string' },
            media_url: { type: ['string', 'null'] },
            media_type: { type: ['string', 'null'] },
            statut: { type: 'string' },
            date_creation: { type: 'string' }
          }
        }
      }
    }
  }
};

export const updatePostSchema = {
  body: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        minLength: 1,
        maxLength: 5000
      },
      media_url: {
        type: 'string',
        format: 'uri'
      },
      media_type: {
        type: 'string',
        enum: ['image', 'video']
      }
    }
  }
};
