export const registerSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
      name: {
        type: 'string',
        minLength: 2,
        maxLength: 50
      },
      email: {
        type: 'string',
        format: 'email'
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
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email'
      },
      password: {
        type: 'string',
        minLength: 6
      }
    }
  }
}