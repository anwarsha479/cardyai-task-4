import { Role } from '../enums/role.enum';

/** The caller as established by JwtAuthGuard from a verified token. */
export interface AuthUser {
  id: string;
  role: Role;
}

export interface AuthenticatedRequest {
  user?: AuthUser;
}
