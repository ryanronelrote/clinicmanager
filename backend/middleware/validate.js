/**
 * Lightweight request validation middleware.
 *
 * Usage:
 *   router.post('/', validate({
 *     body: {
 *       date:        { required: true,  type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/ },
 *       client_id:   { required: true,  type: 'integer', min: 1 },
 *       therapist:   { required: false, type: 'string', maxLength: 100 },
 *     }
 *   }), handler);
 *
 * Supported rule keys:
 *   required   — field must be present and not empty string
 *   type       — 'string' | 'integer' | 'number'
 *   min / max  — numeric bounds (for integer / number)
 *   minLength / maxLength — string length bounds
 *   pattern    — RegExp the string value must match
 */

function validateValue(field, value, rules) {
  const errors = [];

  // Required check
  if (rules.required) {
    if (value === undefined || value === null || value === '') {
      errors.push(`${field} is required`);
      return errors; // no point checking further
    }
  } else if (value === undefined || value === null || value === '') {
    return errors; // optional and absent — skip remaining checks
  }

  // Type coercion + check
  if (rules.type === 'integer') {
    const n = Number(value);
    if (!Number.isInteger(n)) {
      errors.push(`${field} must be an integer`);
      return errors;
    }
    if (rules.min !== undefined && n < rules.min) errors.push(`${field} must be at least ${rules.min}`);
    if (rules.max !== undefined && n > rules.max) errors.push(`${field} must be at most ${rules.max}`);
  } else if (rules.type === 'number') {
    const n = Number(value);
    if (isNaN(n)) {
      errors.push(`${field} must be a number`);
      return errors;
    }
    if (rules.min !== undefined && n < rules.min) errors.push(`${field} must be at least ${rules.min}`);
    if (rules.max !== undefined && n > rules.max) errors.push(`${field} must be at most ${rules.max}`);
  } else if (rules.type === 'string') {
    if (typeof value !== 'string') {
      errors.push(`${field} must be a string`);
      return errors;
    }
    if (rules.minLength !== undefined && value.length < rules.minLength) errors.push(`${field} must be at least ${rules.minLength} characters`);
    if (rules.maxLength !== undefined && value.length > rules.maxLength) errors.push(`${field} must be at most ${rules.maxLength} characters`);
    if (rules.pattern && !rules.pattern.test(value)) errors.push(`${field} has invalid format`);
  }

  return errors;
}

function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    if (schema.body) {
      for (const [field, rules] of Object.entries(schema.body)) {
        errors.push(...validateValue(field, req.body[field], rules));
      }
    }

    if (schema.query) {
      for (const [field, rules] of Object.entries(schema.query)) {
        errors.push(...validateValue(field, req.query[field], rules));
      }
    }

    if (schema.params) {
      for (const [field, rules] of Object.entries(schema.params)) {
        errors.push(...validateValue(field, req.params[field], rules));
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    next();
  };
}

module.exports = { validate };
