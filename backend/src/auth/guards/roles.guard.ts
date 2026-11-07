import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../../common/exceptions/app-error';
import { AuthenticatedRequest } from '../interfaces/auth-user.interface';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

/** Global guard: enforces @Roles() using the role from the verified token, never from the request body. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (user && required.includes(user.role)) return true;
    throw AppError.forbidden(`${required.map((r) => r[0].toUpperCase() + r.slice(1)).join(' or ')} role required`);
  }
}
