import { ApiProperty } from '@nestjs/swagger';
import { UserViewDto } from './user-view.dto';

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: UserViewDto })
  user: UserViewDto;
}
