import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService, SettingView } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOkResponse({ description: 'Current value, default, allowed range and last change for each setting' })
  getAll(): Promise<{ settings: SettingView[] }> {
    return this.settings.getAll();
  }

  /** The body is typed as unknown so the global pipe leaves it intact and unknown keys can be rejected. */
  @Patch()
  @Roles(Role.Librarian)
  @ApiBody({ type: UpdateSettingsDto })
  @ApiOkResponse({ description: 'Updated settings' })
  @ApiBadRequestResponse({ description: 'Out of range, unknown key or empty body' })
  @ApiForbiddenResponse({ description: 'Librarian role required' })
  update(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<{ settings: SettingView[] }> {
    return this.settings.update(user, body);
  }
}
