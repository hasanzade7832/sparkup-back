export const createPostSchema = {
  body: {
    type: 'object',
    required: ['title', 'type'],
    properties: {
      title: {
        type: 'string',
        minLength: 3,
        maxLength: 200
      },
      content: {
        type: 'string',
        maxLength: 5000
      },
      type: {
        type: 'string',
        enum: ['text', 'video', 'image', 'podcast']
      },
      thumbnail: {
        type: 'string'
      },
      media_url: {
        type: 'string'
      },
      is_featured: {
        type: 'boolean',
        default: false
      }
    }
  }
}

export const updatePostSchema = {
  body: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        minLength: 3,
        maxLength: 200
      },
      content: {
        type: 'string',
        maxLength: 5000
      },
      type: {
        type: 'string',
        enum: ['text', 'video', 'image', 'podcast']
      },
      thumbnail: {
        type: 'string'
      },
      media_url: {
        type: 'string'
      },
      is_featured: {
        type: 'boolean'
      }
    }
  }
}

export const getPostsSchema = {
  querystring: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['text', 'video', 'image', 'podcast']
      },
      page: {
        type: 'integer',
        minimum: 1,
        default: 1
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        default: 12
      }
    }
  }
}