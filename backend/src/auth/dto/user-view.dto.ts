import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum';

export class UserViewDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: Role })
  role: Role;
}
