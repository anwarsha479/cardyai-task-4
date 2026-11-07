import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { MAX_COPIES } from '../../lending/utils/lending-rules.util';

export class CreateBookDto {
  @ApiProperty({ minLength: 1, maxLength: 200, example: 'Pride and Prejudice' })
  @Trim()
  @IsString()
  @Length(1, 200, { message: 'title must be 1 to 200 characters' })
  title: string;

  @ApiProperty({ minLength: 1, maxLength: 200, example: 'Jane Austen' })
  @Trim()
  @IsString()
  @Length(1, 200, { message: 'author must be 1 to 200 characters' })
  author: string;

  @ApiProperty({ minimum: 0, maximum: MAX_COPIES, example: 3 })
  @IsInt({ message: 'totalCopies must be a whole number' })
  @Min(0, { message: 'totalCopies cannot be negative' })
  @Max(MAX_COPIES)
  totalCopies: number;
}

export class UpdateBookDto extends PartialType(CreateBookDto) {}

export const BOOK_FILTERS = ['all', 'available', 'mine'] as const;
export type BookFilter = (typeof BOOK_FILTERS)[number];
export const MAX_BOOK_PAGE = 60;

export class ListBooksQueryDto {
  @ApiPropertyOptional({ description: 'Matches title or author, case-insensitive' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: BOOK_FILTERS, default: 'all', description: '`mine` (members only): books you have on loan or reserved' })
  @IsOptional()
  @IsIn(BOOK_FILTERS)
  filter: BookFilter = 'all';

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_BOOK_PAGE, default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BOOK_PAGE)
  limit: number = 24;

  @ApiPropertyOptional({ description: '`nextCursor` from the previous page; omit for the first page' })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  cursor?: string;
}
