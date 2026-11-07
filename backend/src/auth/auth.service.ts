import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hashSync } from 'bcryptjs';
import { AppError } from '../common/exceptions/app-error';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthUser } from './interfaces/auth-user.interface';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { UserViewDto } from './dto/user-view.dto';

const INVALID_CREDENTIALS = 'Email or password is incorrect';
// Compared against when the email is unknown, so both failure paths take similar time.
const DUMMY_HASH = hashSync('timing-equaliser', 10);

export function toUserView(user: User): UserViewDto {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.users.findByEmailWithHash(dto.email);
    const passwordMatches = await compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordMatches) {
      throw AppError.unauthenticated(INVALID_CREDENTIALS);
    }
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { accessToken, user: toUserView(user) };
  }

  async me(current: AuthUser): Promise<UserViewDto> {
    const user = await this.users.findById(current.id);
    if (!user) {
      throw AppError.unauthenticated();
    }
    return toUserView(user);
  }
}
