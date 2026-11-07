import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { BooksService } from './books.service';
import { CreateBookDto, ListBooksQueryDto, UpdateBookDto } from './dto/book.dto';
import { BookPageDto, BookViewDto } from './dto/book-view.dto';

@ApiTags('books')
@ApiBearerAuth()
@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  @ApiOkResponse({ type: BookPageDto, description: 'One page of the catalogue sorted by title, with availability' })
  @ApiBadRequestResponse({ description: 'VALIDATION_ERROR, e.g. a limit over 60 or a cursor that is not valid' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListBooksQueryDto): Promise<BookPageDto> {
    return this.books.list(user, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: BookViewDto })
  @ApiNotFoundResponse({ description: 'Book not found' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<BookViewDto> {
    return this.books.get(user, id);
  }

  @Post()
  @Roles(Role.Librarian)
  @ApiCreatedResponse({ type: BookViewDto })
  @ApiBadRequestResponse({ description: 'VALIDATION_ERROR, e.g. a blank title or a negative copy count' })
  @ApiForbiddenResponse({ description: 'Librarian role required' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookDto): Promise<BookViewDto> {
    return this.books.create(user, dto);
  }

  @Patch(':id')
  @Roles(Role.Librarian)
  @ApiOkResponse({ type: BookViewDto })
  @ApiConflictResponse({ description: 'COPIES_IN_USE (a removed copy is on loan or on hold)' })
  @ApiForbiddenResponse({ description: 'Librarian role required' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookDto,
  ): Promise<BookViewDto> {
    return this.books.update(user, id, dto);
  }
}
