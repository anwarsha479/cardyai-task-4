import { ValidationError } from 'class-validator';
import { AppError, FieldErrors } from '../exceptions/app-error';

/** ValidationPipe exceptionFactory: turns class-validator errors into a VALIDATION_ERROR with per-field messages. */
export function validationExceptionFactory(errors: ValidationError[]): AppError {
  const fields: FieldErrors = {};
  const collect = (list: ValidationError[], prefix: string): void => {
    for (const error of list) {
      const path = prefix ? `${prefix}.${error.property}` : error.property;
      if (error.constraints) fields[path] = Object.values(error.constraints);
      if (error.children?.length) collect(error.children, path);
    }
  };
  collect(errors, '');
  return AppError.validation(fields);
}
