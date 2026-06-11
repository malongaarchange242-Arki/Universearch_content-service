// src/modules/activities/activities.schema.ts

export const createActivitySchema = {
  body: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      status: {
        type: 'string',
        enum: ['active', 'completed', 'archived'],
      },
      is_public: { type: 'boolean' },
    },
    additionalProperties: false,
  },
};

export const getActivitySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export const updateActivitySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' },
    },
    additionalProperties: false,
  },
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      status: {
        type: 'string',
        enum: ['active', 'completed', 'archived'],
      },
      is_public: { type: 'boolean' },
    },
    additionalProperties: false,
  },
};
