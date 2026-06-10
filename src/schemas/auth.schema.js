export const registerSchema = {
  body: {
    type: 'object',
    required: ['name', 'username', 'password'],
    properties: {
      name: {
        type: 'string',
        minLength: 2,
        maxLength: 50
      },
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 30,
        pattern: '^[a-zA-Z0-9_]+$'
      },
      password: {
        type: 'string',
        minLength: 6,
        maxLength: 100
      }
    }
  }
}

export const loginSchema = {
  body: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: {
        type: 'string',
        minLength: 3
      },
      password: {
        type: 'string',
        minLength: 6
      }
    }
  }
}